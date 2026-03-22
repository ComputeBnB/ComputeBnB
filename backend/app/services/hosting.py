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
import base64
import shlex
import shutil
import tempfile
from typing import Optional, Dict, AsyncGenerator
from datetime import datetime, timedelta
from pathlib import Path
from zeroconf import Zeroconf, ServiceInfo
from app.models.messages import (
    JobRequest, SessionToken, RequestStatus, WorkerStatus, ProjectFile,
)

SERVICE_TYPE = "_compute-worker._tcp.local."
FASTAPI_PORT = 8000
TOKEN_EXPIRY_MINUTES = 5
DEFAULT_CHARGE_USD_PER_HOUR = 18.0
MINIMUM_CHARGE_USD = 0.25
IGNORED_OUTPUT_SEGMENTS = {".computebnb_deps", "__pycache__", ".pytest_cache", ".mypy_cache"}
MAX_RETURNED_FILE_BYTES = 2 * 1024 * 1024
MAX_RETURNED_FILE_COUNT = 25
TERMINAL_JOB_STATES = {"done", "failed", "timeout", "cancelled"}


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
        self.completed_jobs: Dict[str, dict] = {}

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
        self.completed_jobs.clear()

        return {"status": "hosting_stopped"}

    # ── Request management ──────────────────────────────────────────

    def create_request(
        self, guest_name: str, guest_ip: str, code: str,
        filename: str = "main.py", entrypoint: str = "main.py",
        project_name: Optional[str] = None,
        project_files: Optional[list[ProjectFile]] = None,
        timeout_secs: int = 300,
    ) -> JobRequest:
        """Create a pending job request from a guest."""
        request_id = f"req-{uuid.uuid4().hex[:8]}"
        request = JobRequest(
            request_id=request_id,
            guest_name=guest_name,
            guest_ip=guest_ip,
            code=code,
            filename=filename,
            entrypoint=entrypoint,
            project_name=project_name,
            project_files=project_files or [],
            timeout_secs=timeout_secs,
            status=RequestStatus.PENDING,
            created_at=datetime.now(),
            charge_enabled=False,
            charge_rate_usd_per_hour=0.0,
            paid=False,
            total_charge_usd=0.0,
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

    def approve_request(self, request_id: str, charge_enabled: bool = False) -> Optional[dict]:
        """Approve a pending request and generate a session token."""
        request = self.pending_requests.get(request_id)
        if not request or request.status != RequestStatus.PENDING:
            return None

        request.status = RequestStatus.ACCEPTED
        request.charge_enabled = charge_enabled
        request.charge_rate_usd_per_hour = DEFAULT_CHARGE_USD_PER_HOUR if charge_enabled else 0.0

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
            "charge_enabled": request.charge_enabled,
            "charge_rate_usd_per_hour": request.charge_rate_usd_per_hour,
        }

    def deny_request(self, request_id: str) -> Optional[dict]:
        """Deny a pending request."""
        request = self.pending_requests.get(request_id)
        if not request or request.status != RequestStatus.PENDING:
            return None

        request.status = RequestStatus.DENIED
        return {"request_id": request_id, "status": "denied"}

    def mark_paid(self, request_id: str) -> bool:
        """Mark a job request as paid."""
        record = self.completed_jobs.get(request_id)
        if not record or not record.get("charge_enabled"):
            return False

        record["paid"] = True
        record["balance_due_usd"] = 0.0
        record["payment_status"] = "paid"
        record["payment_received_at"] = datetime.now().isoformat()

        if self.active_job and self.active_job.get("request_id") == request_id:
            self.active_job["paid"] = True
            self.active_job["balance_due_usd"] = 0.0
            self.active_job["payment_status"] = "paid"
            self.active_job["payment_received_at"] = record["payment_received_at"]

        request = self.pending_requests.get(request_id)
        if request:
            request.paid = True

        return True

    def is_paid(self, request_id: str) -> bool:
        """Check if a job request is paid."""
        record = self.completed_jobs.get(request_id)
        if record:
            return bool(record.get("paid", False))
        request = self.pending_requests.get(request_id)
        return bool(request and getattr(request, 'paid', False))

    def _round_currency(self, value: float) -> float:
        return round(max(value, 0.0), 2)

    def _compute_charge_usd(self, elapsed_seconds: float, rate_usd_per_hour: float) -> float:
        if rate_usd_per_hour <= 0:
            return 0.0

        usage_charge = (elapsed_seconds / 3600) * rate_usd_per_hour
        return self._round_currency(max(MINIMUM_CHARGE_USD, usage_charge))

    def _payment_status(self, charge_enabled: bool, paid: bool, balance_due_usd: float) -> str:
        if not charge_enabled:
            return "not_required"
        if paid or balance_due_usd <= 0:
            return "paid"
        return "payment_due"

    def _payment_payload(self, job_snapshot: dict) -> dict:
        return {
            "charge_enabled": bool(job_snapshot.get("charge_enabled", False)),
            "charge_finalized": bool(job_snapshot.get("charge_finalized", False)),
            "charge_rate_usd_per_hour": float(job_snapshot.get("charge_rate_usd_per_hour", 0.0)),
            "total_charge_usd": self._round_currency(float(job_snapshot.get("total_charge_usd", 0.0))),
            "balance_due_usd": self._round_currency(float(job_snapshot.get("balance_due_usd", 0.0))),
            "paid": bool(job_snapshot.get("paid", False)),
            "payment_status": job_snapshot.get("payment_status", "not_required"),
        }

    def _update_active_job_charge(self, elapsed_seconds: float, final: bool = False) -> None:
        if not self.active_job:
            return

        charge_enabled = bool(self.active_job.get("charge_enabled", False))
        total_charge_usd = self._compute_charge_usd(
            elapsed_seconds,
            float(self.active_job.get("charge_rate_usd_per_hour", 0.0)),
        )
        self.active_job["total_charge_usd"] = total_charge_usd
        self.active_job["charge_finalized"] = final

        if final:
            balance_due_usd = 0.0 if self.active_job.get("paid") else total_charge_usd
            self.active_job["balance_due_usd"] = self._round_currency(balance_due_usd)
            self.active_job["payment_status"] = self._payment_status(
                charge_enabled,
                bool(self.active_job.get("paid", False)),
                balance_due_usd,
            )
        else:
            self.active_job["balance_due_usd"] = 0.0
            self.active_job["payment_status"] = "paid" if self.active_job.get("paid") else "not_required"

        if final:
            self.active_job["completed_at"] = datetime.now().isoformat()

    def _finalize_completed_job(self, request_id: str, start_time: float) -> dict:
        if not self.active_job:
            return self.completed_jobs.get(request_id, {})

        self._update_active_job_charge(time.time() - start_time, final=True)
        snapshot = dict(self.active_job)
        snapshot.pop("started_at_ts", None)
        self.completed_jobs[request_id] = snapshot
        return snapshot

    def get_active_job_snapshot(self) -> dict:
        if not self.active_job:
            return {"active": False}

        job_snapshot = dict(self.active_job)
        started_at_ts = job_snapshot.get("started_at_ts")
        if started_at_ts and job_snapshot.get("state") not in TERMINAL_JOB_STATES:
            elapsed_seconds = time.time() - float(started_at_ts)
            total_charge_usd = self._compute_charge_usd(
                elapsed_seconds,
                float(job_snapshot.get("charge_rate_usd_per_hour", 0.0)),
            )
            job_snapshot["total_charge_usd"] = total_charge_usd
            job_snapshot["charge_finalized"] = False
            job_snapshot["balance_due_usd"] = 0.0
            job_snapshot["payment_status"] = "paid" if job_snapshot.get("paid") else "not_required"

        job_snapshot.pop("started_at_ts", None)
        return {
            "active": True,
            **job_snapshot,
            "logs": self.active_job_logs,
        }

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

    def _record_active_log(self, message: dict) -> None:
        self.active_job_logs.append(message)

    def _build_status_message(
        self,
        request_id: str,
        state: str,
        detail: Optional[str] = None,
        runtime: str = "docker",
    ) -> dict:
        if self.active_job:
            self.active_job["state"] = state
            self.active_job["runtime"] = runtime
            self.active_job["status_detail"] = detail

        if detail:
            self._record_active_log({"type": "status", "data": f"[{state}] {detail}"})
        else:
            self._record_active_log({"type": "status", "data": f"[{state}]"})

        message = {
            "type": "status",
            "state": state,
            "job_id": request_id,
            "runtime": runtime,
        }
        if detail:
            message["detail"] = detail
        return message

    def _sanitize_relative_path(self, raw_path: str) -> str:
        normalized = raw_path.replace("\\", "/").strip()
        path = Path(normalized)
        if not normalized or normalized == "." or path.is_absolute() or ".." in path.parts:
            raise ValueError(f"Invalid project path: {raw_path}")
        return path.as_posix()

    def _resolve_requirements_path(self, workspace_root: str) -> Optional[str]:
        matches = [
            path.relative_to(workspace_root).as_posix()
            for path in Path(workspace_root).rglob("requirements.txt")
            if path.is_file()
        ]
        if not matches:
            return None
        matches.sort(key=lambda item: (item != "requirements.txt", item.count("/"), item))
        return matches[0]

    def _materialize_request_workspace(self, workspace_root: str, request: JobRequest) -> tuple[str, int, Optional[str]]:
        workspace = Path(workspace_root)

        if request.project_files:
            for project_file in request.project_files:
                relative_path = self._sanitize_relative_path(project_file.path)
                target = workspace / relative_path
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(base64.b64decode(project_file.content_b64))
            file_count = len(request.project_files)
        elif request.code:
            relative_path = self._sanitize_relative_path(request.filename)
            target = workspace / relative_path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(request.code, encoding="utf-8")
            file_count = 1
        else:
            raise ValueError("No code or project files provided")

        entrypoint = self._sanitize_relative_path(request.entrypoint or request.filename)
        if not (workspace / entrypoint).is_file():
            raise FileNotFoundError(f"Entrypoint not found in uploaded project: {entrypoint}")

        requirements_path = self._resolve_requirements_path(workspace_root)
        return entrypoint, file_count, requirements_path

    def _list_workspace_files(self, workspace_root: str) -> set[str]:
        files: set[str] = set()
        workspace = Path(workspace_root)

        for path in workspace.rglob("*"):
            if not path.is_file():
                continue

            relative_path = path.relative_to(workspace).as_posix()
            parts = Path(relative_path).parts
            if any(part in IGNORED_OUTPUT_SEGMENTS for part in parts):
                continue

            files.add(relative_path)

        return files

    def _collect_generated_files(
        self,
        workspace_root: str,
        initial_files: set[str],
    ) -> tuple[list[ProjectFile], list[str]]:
        workspace = Path(workspace_root)
        generated_paths = sorted(self._list_workspace_files(workspace_root) - initial_files)
        returned_files: list[ProjectFile] = []
        skipped_paths: list[str] = []

        for relative_path in generated_paths:
            if len(returned_files) >= MAX_RETURNED_FILE_COUNT:
                skipped_paths.append(relative_path)
                continue

            file_path = workspace / relative_path
            size_bytes = file_path.stat().st_size
            if size_bytes > MAX_RETURNED_FILE_BYTES:
                skipped_paths.append(relative_path)
                continue

            returned_files.append(
                ProjectFile(
                    path=relative_path,
                    content_b64=base64.b64encode(file_path.read_bytes()).decode("ascii"),
                    size_bytes=size_bytes,
                )
            )

        return returned_files, skipped_paths

    @staticmethod
    def _docker_volume_path(host_path: str) -> str:
        """Convert a host path to a format Docker understands on all platforms.

        On Windows, ``C:\\Users\\foo\\tmp`` must become ``/c/Users/foo/tmp``
        for Docker Desktop (which expects POSIX-style paths for bind mounts).
        On macOS/Linux the path is returned unchanged.
        """
        if platform.system() != "Windows":
            return host_path
        # C:\Users\foo -> /c/Users/foo
        path = host_path.replace("\\", "/")
        if len(path) >= 2 and path[1] == ":":
            drive = path[0].lower()
            path = f"/{drive}{path[2:]}"
        return path

    @staticmethod
    def _resolve_docker_executable() -> str:
        """Find the docker executable on the system, cross-platform."""
        docker = shutil.which("docker")
        if docker:
            return docker
        if platform.system() == "Windows":
            common_paths = [
                Path(r"C:\Program Files\Docker\Docker\resources\bin\docker.exe"),
                Path(r"C:\ProgramData\DockerDesktop\version-bin\docker.exe"),
            ]
            for p in common_paths:
                if p.is_file():
                    return str(p)
        raise FileNotFoundError(
            "Docker executable not found. Please install Docker Desktop and ensure "
            "'docker' is available in your system PATH."
        )

    async def _check_docker_available(self) -> tuple[bool, str]:
        """Verify Docker is installed and the daemon is running."""
        try:
            docker = self._resolve_docker_executable()
        except FileNotFoundError as e:
            return False, str(e)

        try:
            proc = await asyncio.create_subprocess_exec(
                docker, "info",
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.PIPE,
            )
            _, stderr = await asyncio.wait_for(proc.communicate(), timeout=15)
            if proc.returncode != 0:
                hint = stderr.decode(errors="replace").strip().split("\n")[0] if stderr else ""
                return False, f"Docker daemon is not running. {hint}"
            return True, docker
        except asyncio.TimeoutError:
            return False, "Docker daemon did not respond within 15 seconds."
        except OSError as e:
            return False, f"Failed to run Docker: {e}"

    async def _start_docker_process(
        self,
        workspace_root: str,
        container_name: str,
        shell_command: str,
        docker_exe: str = "docker",
        env: Optional[dict[str, str]] = None,
    ):
        mount_path = self._docker_volume_path(workspace_root)
        docker_command = [
            docker_exe,
            "run",
            "--rm",
            "--name",
            container_name,
            "-v",
            f"{mount_path}:/workspace",
            "-w",
            "/workspace",
        ]

        for key, value in (env or {}).items():
            docker_command.extend(["-e", f"{key}={value}"])

        docker_command.extend([
            "python:3.11-slim",
            "sh",
            "-lc",
            shell_command,
        ])

        return await asyncio.create_subprocess_exec(
            *docker_command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=workspace_root,
        )

    async def _cleanup_container(self, container_name: str, docker_exe: str = "docker") -> None:
        cleanup = await asyncio.create_subprocess_exec(
            docker_exe,
            "rm",
            "-f",
            container_name,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
        await cleanup.wait()

    async def _pump_stream(self, stream, message_type: str, queue: asyncio.Queue) -> None:
        if stream is None:
            await queue.put({"type": "__stream_closed__", "stream": message_type})
            return

        while True:
            line = await stream.readline()
            if not line:
                break
            await queue.put({"type": message_type, "data": line.decode(errors="replace")})
        await queue.put({"type": "__stream_closed__", "stream": message_type})

    async def _stream_process_output(
        self,
        process,
        deadline: float,
    ) -> AsyncGenerator[dict, None]:
        queue: asyncio.Queue = asyncio.Queue()
        stdout_task = asyncio.create_task(self._pump_stream(process.stdout, "stdout", queue))
        stderr_task = asyncio.create_task(self._pump_stream(process.stderr, "stderr", queue))
        open_streams = 2
        waiter = asyncio.create_task(process.wait())

        try:
            while True:
                remaining = deadline - time.time()
                if remaining <= 0:
                    raise asyncio.TimeoutError

                if waiter.done() and open_streams == 0 and queue.empty():
                    break

                try:
                    item = await asyncio.wait_for(queue.get(), timeout=min(0.25, remaining))
                except asyncio.TimeoutError:
                    continue

                if item["type"] == "__stream_closed__":
                    open_streams -= 1
                    continue

                self._record_active_log(item)
                yield item

            await waiter
        finally:
            await asyncio.gather(stdout_task, stderr_task, return_exceptions=True)

    async def execute_job(self, request_id: str) -> AsyncGenerator[dict, None]:
        """Execute a job inside Docker and yield streaming status and logs."""
        request = self.pending_requests.get(request_id)
        if not request:
            yield {"type": "error", "message": "Request not found"}
            return

        # Verify Docker is available before starting
        docker_ok, docker_result = await self._check_docker_available()
        if not docker_ok:
            yield {"type": "error", "message": f"Docker not available: {docker_result}"}
            return
        docker_exe = docker_result

        await self._update_advertised_status(WorkerStatus.BUSY)
        start_time = time.time()

        # Track active job for host UI
        self.active_job = {
            "request_id": request_id,
            "guest_name": request.guest_name,
            "guest_ip": request.guest_ip,
            "code": request.code,
            "filename": request.filename,
            "entrypoint": request.entrypoint,
            "project_name": request.project_name,
            "file_count": len(request.project_files) if request.project_files else 1,
            "has_requirements_txt": False,
            "runtime": "docker",
            "state": "starting",
            "status_detail": "Accepted job, preparing Docker workspace",
            "started_at": datetime.now().isoformat(),
            "started_at_ts": start_time,
            "charge_enabled": request.charge_enabled,
            "charge_rate_usd_per_hour": request.charge_rate_usd_per_hour,
            "total_charge_usd": 0.0,
            "balance_due_usd": 0.0,
            "charge_finalized": False,
            "paid": request.paid,
            "payment_status": "paid" if request.paid else "not_required",
        }
        self.active_job_logs = []

        yield self._build_status_message(
            request_id,
            "starting",
            "Accepted job, preparing Docker workspace",
        )

        temp_dir = tempfile.TemporaryDirectory()
        workspace_root = temp_dir.name
        deadline = start_time + request.timeout_secs
        stdout_output: list[str] = []
        try:
            entrypoint, file_count, requirements_path = self._materialize_request_workspace(
                workspace_root,
                request,
            )
            initial_workspace_files = self._list_workspace_files(workspace_root)

            if self.active_job:
                self.active_job["filename"] = entrypoint
                self.active_job["entrypoint"] = entrypoint
                self.active_job["file_count"] = file_count
                self.active_job["has_requirements_txt"] = requirements_path is not None
                self.active_job["requirements_path"] = requirements_path

            project_label = request.project_name or request.filename
            prep_detail = f"Prepared {file_count} file(s) from {project_label}"
            yield self._build_status_message(request_id, "preparing_project", prep_detail)

            if requirements_path:
                deps_container = f"computebnb-{request_id}-deps"
                install_detail = f"Installing dependencies from {requirements_path} inside Docker"
                yield self._build_status_message(
                    request_id,
                    "installing_dependencies",
                    install_detail,
                )

                install_command = (
                    "python -m pip install --no-cache-dir --target /workspace/.computebnb_deps "
                    f"-r {shlex.quote(requirements_path)}"
                )
                install_process = await self._start_docker_process(
                    workspace_root,
                    deps_container,
                    install_command,
                    docker_exe=docker_exe,
                )

                try:
                    async for message in self._stream_process_output(install_process, deadline):
                        if message["type"] == "stdout":
                            stdout_output.append(message["data"])
                        yield message
                except asyncio.TimeoutError:
                    install_process.kill()
                    await self._cleanup_container(deps_container, docker_exe=docker_exe)
                    yield self._build_status_message(
                        request_id,
                        "timeout",
                        "Dependency installation exceeded the configured timeout",
                    )
                    billing = self._finalize_completed_job(request_id, start_time)
                    yield {
                        "type": "error",
                        "message": "Job timed out while installing dependencies",
                        "job_id": request_id,
                        **self._payment_payload(billing),
                    }
                    return

                await install_process.wait()
                await self._cleanup_container(deps_container, docker_exe=docker_exe)

                if install_process.returncode != 0:
                    duration_ms = int((time.time() - start_time) * 1000)
                    yield self._build_status_message(
                        request_id,
                        "failed",
                        "Dependency installation failed inside Docker",
                    )
                    billing = self._finalize_completed_job(request_id, start_time)
                    yield {
                        "type": "done",
                        "job_id": request_id,
                        "exit_code": install_process.returncode,
                        "duration_ms": duration_ms,
                        **self._payment_payload(billing),
                    }
                    return

            run_container = f"computebnb-{request_id}-run"
            run_detail = f"Running {entrypoint} inside Docker"
            yield self._build_status_message(request_id, "running", run_detail)

            runtime_env = {"PYTHONPATH": "/workspace/.computebnb_deps"} if requirements_path else None
            run_process = await self._start_docker_process(
                workspace_root,
                run_container,
                f"python {shlex.quote(entrypoint)}",
                docker_exe=docker_exe,
                env=runtime_env,
            )

            try:
                async for message in self._stream_process_output(run_process, deadline):
                    if message["type"] == "stdout":
                        stdout_output.append(message["data"])
                    yield message
            except asyncio.TimeoutError:
                run_process.kill()
                await self._cleanup_container(run_container, docker_exe=docker_exe)
                yield self._build_status_message(
                    request_id,
                    "timeout",
                    "Execution exceeded the configured timeout",
                )
                billing = self._finalize_completed_job(request_id, start_time)
                yield {
                    "type": "error",
                    "message": "Job timed out",
                    "job_id": request_id,
                    **self._payment_payload(billing),
                }
                return

            await run_process.wait()
            await self._cleanup_container(run_container, docker_exe=docker_exe)

            generated_files, skipped_generated_files = self._collect_generated_files(
                workspace_root,
                initial_workspace_files,
            )

            if generated_files:
                yield self._build_status_message(
                    request_id,
                    "running",
                    f"Returning {len(generated_files)} generated file(s) to guest",
                )
                for generated_file in generated_files:
                    yield {
                        "type": "generated_file",
                        "path": generated_file.path,
                        "content_b64": generated_file.content_b64,
                        "size_bytes": generated_file.size_bytes,
                    }

            if skipped_generated_files:
                yield self._build_status_message(
                    request_id,
                    "running",
                    f"Skipped {len(skipped_generated_files)} generated file(s) because they exceeded return limits",
                )

            output_path = Path(workspace_root) / "output.txt"
            output_path.write_text("".join(stdout_output), encoding="utf-8")
            yield {
                "type": "output_file",
                "filename": "output.txt",
                "content": output_path.read_text(encoding="utf-8"),
            }

            duration_ms = int((time.time() - start_time) * 1000)
            final_state = "done" if run_process.returncode == 0 else "failed"
            final_detail = (
                "Docker execution completed successfully"
                if run_process.returncode == 0
                else f"Docker execution exited with code {run_process.returncode}"
            )
            yield self._build_status_message(request_id, final_state, final_detail)
            billing = self._finalize_completed_job(request_id, start_time)
            yield {
                "type": "done",
                "job_id": request_id,
                "exit_code": run_process.returncode,
                "duration_ms": duration_ms,
                **self._payment_payload(billing),
            }

        except Exception as e:
            yield self._build_status_message(request_id, "failed", str(e))
            billing = self._finalize_completed_job(request_id, start_time)
            yield {
                "type": "error",
                "message": str(e),
                "job_id": request_id,
                **self._payment_payload(billing),
            }
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
            # Windows may hold file locks briefly after Docker releases the mount
            for _attempt in range(3):
                try:
                    temp_dir.cleanup()
                    break
                except (PermissionError, OSError):
                    await asyncio.sleep(1)
            else:
                shutil.rmtree(temp_dir.name, ignore_errors=True)

    async def get_output_if_paid(self, request_id: str) -> dict:
        """Return output if paid, else return locked message."""
        request = self.pending_requests.get(request_id)
        if not request:
            return {"status": "error", "message": "Request not found"}
        if not getattr(request, 'paid', False):
            return {"status": "locked", "message": "Please pay to unlock the output."}
        # For demo: just return a placeholder, real output should be loaded from storage
        return {"status": "ok", "output": getattr(request, 'output', 'Output not available')}

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
