"""
Hosting service - manages this machine's worker advertisement and job execution.
When hosting is enabled, this machine advertises itself via mDNS and accepts jobs.
"""

import socket
import uuid
import platform
import asyncio
import json
from typing import Optional
from zeroconf import Zeroconf, ServiceInfo

SERVICE_TYPE = "_compute-worker._tcp.local."
WORKER_PORT = 9000


class HostingService:
    def __init__(self):
        self.is_hosting = False
        self.worker_id = f"worker-{uuid.uuid4().hex[:8]}"
        self.zeroconf: Optional[Zeroconf] = None
        self.service_info: Optional[ServiceInfo] = None
        self.server_task: Optional[asyncio.Task] = None
        self.server_socket: Optional[socket.socket] = None

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
        """Enable hosting mode - advertise via mDNS and start accepting jobs."""
        if self.is_hosting:
            return {"status": "already_hosting", "worker_id": self.worker_id}

        self.is_hosting = True
        local_ip = self.get_local_ip()
        hostname = socket.gethostname()

        # Register mDNS service
        self.zeroconf = Zeroconf()
        self.service_info = ServiceInfo(
            SERVICE_TYPE,
            f"{self.worker_id}.{SERVICE_TYPE}",
            addresses=[socket.inet_aton(local_ip)],
            port=WORKER_PORT,
            properties={
                "worker_id": self.worker_id,
                "display_name": hostname,
                "status": "idle",
                "platform": platform.system(),
            },
        )
        self.zeroconf.register_service(self.service_info)

        # Start TCP server for job execution
        self.server_task = asyncio.create_task(self._run_server())

        return {
            "status": "hosting_started",
            "worker_id": self.worker_id,
            "ip": local_ip,
            "port": WORKER_PORT
        }

    async def stop_hosting(self):
        """Disable hosting mode - stop advertising and accepting jobs."""
        if not self.is_hosting:
            return {"status": "not_hosting"}

        self.is_hosting = False

        # Unregister mDNS service
        if self.zeroconf and self.service_info:
            self.zeroconf.unregister_service(self.service_info)
            self.zeroconf.close()
            self.zeroconf = None
            self.service_info = None

        # Stop TCP server
        if self.server_task:
            self.server_task.cancel()
            try:
                await self.server_task
            except asyncio.CancelledError:
                pass
            self.server_task = None

        if self.server_socket:
            self.server_socket.close()
            self.server_socket = None

        return {"status": "hosting_stopped"}

    async def _run_server(self):
        """Run the TCP server to accept job connections."""
        loop = asyncio.get_event_loop()

        # Create TCP server socket
        self.server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.server_socket.bind(("0.0.0.0", WORKER_PORT))
        self.server_socket.listen(5)
        self.server_socket.setblocking(False)

        print(f"[Hosting] TCP server listening on port {WORKER_PORT}")

        try:
            while self.is_hosting:
                # Accept connections asynchronously
                conn, addr = await loop.sock_accept(self.server_socket)
                print(f"[Hosting] Connection from {addr}")

                # Handle connection in background
                asyncio.create_task(self._handle_connection(conn, addr))
        except asyncio.CancelledError:
            print("[Hosting] Server stopped")
        finally:
            if self.server_socket:
                self.server_socket.close()

    async def _handle_connection(self, conn: socket.socket, addr):
        """Handle an incoming job connection."""
        loop = asyncio.get_event_loop()

        try:
            conn.setblocking(False)

            # Read incoming data
            data = await loop.sock_recv(conn, 4096)
            if data:
                message = data.decode()
                print(f"[Hosting] Received: {message}")

                # Parse the job request
                try:
                    job_data = json.loads(message)
                    print(f"[Hosting] Job type: {job_data.get('type')}")

                    # Send acknowledgment
                    response = json.dumps({"type": "status", "state": "connected"}) + "\n"
                    await loop.sock_sendall(conn, response.encode())

                    # TODO: Execute the job here
                    # For now, just acknowledge

                except json.JSONDecodeError:
                    error_response = json.dumps({"type": "error", "message": "invalid_json"}) + "\n"
                    await loop.sock_sendall(conn, error_response.encode())

        except Exception as e:
            print(f"[Hosting] Error handling connection: {e}")
        finally:
            conn.close()
            print(f"[Hosting] Connection closed")

    def get_status(self):
        """Get current hosting status."""
        return {
            "is_hosting": self.is_hosting,
            "worker_id": self.worker_id if self.is_hosting else None,
            "port": WORKER_PORT if self.is_hosting else None
        }


# Global instance
hosting_service = HostingService()
