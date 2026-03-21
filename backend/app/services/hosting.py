"""
Hosting service - manages this machine's worker advertisement, job approval, and execution.
When hosting is enabled, this machine advertises itself via mDNS and accepts jobs
through authenticated HTTP/WebSocket only (no raw TCP port).
"""

import socket
import uuid
import platform
import asyncio
import secrets
import time
from typing import Optional, Dict, AsyncGenerator
from datetime import datetime, timedelta
from zeroconf import Zeroconf, ServiceInfo
from app.models.messages import (
    JobRequest, SessionToken, RequestStatus, WorkerStatus,
)

SERVICE_TYPE = "_compute-worker._tcp.local."
FASTAPI_PORT = 8000
TOKEN_EXPIRY_MINUTES = 5


class HostingService:
    def __init__(self):
        self.is_hosting = False
        self.worker_id = f"worker-{uuid.uuid4().hex[:8]}"
        self.zeroconf: Optional[Zeroconf] = None
        self.service_info: Optional[ServiceInfo] = None
        self.status: WorkerStatus = WorkerStatus.IDLE

        # Pending job requests from guests (request_id -> JobRequest)
        self.pending_requests: Dict[str, JobRequest] = {}
        # Active session tokens (token -> SessionToken)
        self.active_tokens: Dict[str, SessionToken] = {}

        # Active job tracking (for host UI)
        self.active_job: Optional[dict] = None
        self.active_job_logs: list = []

    async def _update_advertised_status(self, status: WorkerStatus) -> None:
        self.status = status

        if not self.is_hosting or not self.zeroconf or not self.service_info:
            return

        properties = dict(self.service_info.properties)
        properties["status"] = status.value

        updated_info = ServiceInfo(
            SERVICE_TYPE,
            self.service_info.name,
            addresses=self.service_info.addresses,
            port=self.service_info.port,
            properties=properties,
            server=self.service_info.server,
        )

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self.zeroconf.update_service, updated_info)
        self.service_info = updated_info

    def get_local_ip(self) -> str:
        """Get local IP address."""
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            s.connect(("8.8.8.8", 80))
            local_ip = s.getsockname()[0]
            return local_ip
        finally:
            s.close()

    async def start_hosting(self):
        """Enable hosting mode - advertise via mDNS on the FastAPI port."""
        if self.is_hosting:
            return {"status": "already_hosting", "worker_id": self.worker_id}

        self.is_hosting = True
        local_ip = self.get_local_ip()
        hostname = socket.gethostname()

        # Register mDNS service - advertise FastAPI port, not a raw TCP port
        loop = asyncio.get_event_loop()
        self.zeroconf = Zeroconf()
        self.service_info = ServiceInfo(
            SERVICE_TYPE,
            f"{self.worker_id}.{SERVICE_TYPE}",
            addresses=[socket.inet_aton(local_ip)],
            port=FASTAPI_PORT,
            properties={
                "worker_id": self.worker_id,
                "display_name": hostname,
                "status": "idle",
                "platform": platform.system(),
            },
        )
        await loop.run_in_executor(None, self.zeroconf.register_service, self.service_info)
        await self._update_advertised_status(WorkerStatus.IDLE)

        return {
            "status": "hosting_started",
            "worker_id": self.worker_id,
            "ip": local_ip,
            "port": FASTAPI_PORT,
        }

    async def stop_hosting(self):
        """Disable hosting mode - stop advertising and reject new requests."""
        if not self.is_hosting:
            return {"status": "not_hosting"}

        self.is_hosting = False
        self.status = WorkerStatus.OFFLINE

        # Unregister mDNS service
        if self.zeroconf and self.service_info:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, self.zeroconf.unregister_service, self.service_info)
            await loop.run_in_executor(None, self.zeroconf.close)
            self.zeroconf = None
            self.service_info = None

        # Clear pending requests and tokens
        self.pending_requests.clear()
        self.active_tokens.clear()
        self.active_job = None
        self.active_job_logs = []

        return {"status": "hosting_stopped"}

    # ── Request management ──────────────────────────────────────────

    def create_request(
        self, guest_name: str, guest_ip: str, code: str,
        filename: str = "main.py", timeout_secs: int = 300,
    ) -> JobRequest:
        """Create a pending job request from a guest."""
        request_id = f"req-{uuid.uuid4().hex[:8]}"
        request = JobRequest(
            request_id=request_id,
            guest_name=guest_name,
            guest_ip=guest_ip,
            code=code,
            filename=filename,
            timeout_secs=timeout_secs,
            status=RequestStatus.PENDING,
            created_at=datetime.now(),
        )
        self.pending_requests[request_id] = request
        return request

    def get_request(self, request_id: str) -> Optional[JobRequest]:
        """Get a job request by ID."""
        return self.pending_requests.get(request_id)

    def get_all_pending(self) -> list:
        """Get all pending requests (for host UI)."""
        return [
            r for r in self.pending_requests.values()
            if r.status == RequestStatus.PENDING
        ]

    def approve_request(self, request_id: str) -> Optional[dict]:
        """Approve a pending request and generate a session token."""
        request = self.pending_requests.get(request_id)
        if not request or request.status != RequestStatus.PENDING:
            return None

        request.status = RequestStatus.ACCEPTED

        # Generate a secure session token
        token = secrets.token_urlsafe(32)
        session = SessionToken(
            token=token,
            request_id=request_id,
            expires_at=datetime.now() + timedelta(minutes=TOKEN_EXPIRY_MINUTES),
        )
        self.active_tokens[token] = session

        return {
            "request_id": request_id,
            "status": "accepted",
            "token": token,
            "expires_at": session.expires_at.isoformat(),
        }

    def deny_request(self, request_id: str) -> Optional[dict]:
        """Deny a pending request."""
        request = self.pending_requests.get(request_id)
        if not request or request.status != RequestStatus.PENDING:
            return None

        request.status = RequestStatus.DENIED
        return {"request_id": request_id, "status": "denied"}

    # ── Token validation ────────────────────────────────────────────

    def validate_token(self, token: str) -> Optional[SessionToken]:
        """Validate a session token. Returns the session if valid, None if not."""
        session = self.active_tokens.get(token)
        if not session:
            return None
        if datetime.now() > session.expires_at:
            # Expired - clean up
            del self.active_tokens[token]
            return None
        return session

    # ── Job execution ───────────────────────────────────────────────

    async def execute_job(self, request_id: str) -> AsyncGenerator[dict, None]:
        """Execute a job and yield streaming messages (stdout, stderr, done/error). Accepts either code as string or a file upload."""
        import tempfile
        import os
        request = self.pending_requests.get(request_id)
        if not request:
            yield {"type": "error", "message": "Request not found"}
            return

        await self._update_advertised_status(WorkerStatus.BUSY)
        start_time = time.time()

        # Track active job for host UI
        self.active_job = {
            "request_id": request_id,
            "guest_name": request.guest_name,
            "guest_ip": request.guest_ip,
            "code": request.code,
            "filename": request.filename,
            "state": "starting",
            "started_at": datetime.now().isoformat(),
        }
        self.active_job_logs = []

        yield {"type": "status", "state": "starting", "job_id": request_id}

        temp_dir = tempfile.TemporaryDirectory()
        code_path = os.path.join(temp_dir.name, request.filename)
        output_path = os.path.join(temp_dir.name, "output.txt")
        try:
            # If request.code is not empty, write it to a file
            if getattr(request, "code", None):
                with open(code_path, "w") as f:
                    f.write(request.code)
            # If request has file_content, write it to a file (for future extension)
            elif getattr(request, "file_content", None):
                with open(code_path, "wb") as f:
                    f.write(request.file_content)
            else:
                yield {"type": "error", "message": "No code or file provided", "job_id": request_id}
                return

            # Run the code as a subprocess, redirect output to output.txt
            process = await asyncio.create_subprocess_exec(
                "python3", code_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=temp_dir.name,
            )

            if self.active_job:
                self.active_job["state"] = "running"
            yield {"type": "status", "state": "running", "job_id": request_id}

            stdout_lines = []
            stderr_lines = []

            async def collect_stdout():
                while True:
                    line = await process.stdout.readline()
                    if not line:
                        break
                    msg = {"type": "stdout", "data": line.decode()}
                    stdout_lines.append(msg)
                    self.active_job_logs.append(msg)

            async def collect_stderr():
                while True:
                    line = await process.stderr.readline()
                    if not line:
                        break
                    msg = {"type": "stderr", "data": line.decode()}
                    stderr_lines.append(msg)
                    self.active_job_logs.append(msg)

            try:
                await asyncio.wait_for(
                    asyncio.gather(collect_stdout(), collect_stderr()),
                    timeout=request.timeout_secs,
                )
            except asyncio.TimeoutError:
                process.kill()
                yield {"type": "error", "message": "Job timed out", "job_id": request_id}
                return

            await process.wait()

            # Write stdout to output.txt
            with open(output_path, "w") as out_f:
                for msg in stdout_lines:
                    out_f.write(msg["data"])

            # Yield collected output
            for msg in stdout_lines:
                yield msg
            for msg in stderr_lines:
                yield msg

            # Send the output file content back to the client
            with open(output_path, "r") as out_f:
                output_content = out_f.read()
            yield {"type": "output_file", "filename": "output.txt", "content": output_content}

            duration_ms = int((time.time() - start_time) * 1000)
            yield {
                "type": "done",
                "job_id": request_id,
                "exit_code": process.returncode,
                "duration_ms": duration_ms,
            }

        except Exception as e:
            yield {"type": "error", "message": str(e), "job_id": request_id}
        finally:
            await self._update_advertised_status(WorkerStatus.IDLE)
            if request_id in self.pending_requests:
                del self.pending_requests[request_id]
            to_remove = [
                t for t, s in self.active_tokens.items()
                if s.request_id == request_id
            ]
            for t in to_remove:
                del self.active_tokens[t]
            self.active_job = None
            self.active_job_logs = []
            temp_dir.cleanup()

    def get_status(self):
        """Get current hosting status."""
        return {
            "is_hosting": self.is_hosting,
            "worker_id": self.worker_id if self.is_hosting else None,
            "port": FASTAPI_PORT if self.is_hosting else None,
            "status": self.status.value,
            "pending_requests": len(self.get_all_pending()),
        }


# Global instance
hosting_service = HostingService()
