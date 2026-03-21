from __future__ import annotations

import asyncio
import json
import uuid
from collections import deque
from typing import Deque, Optional, cast

from pydantic import BaseModel

from app.models.messages import (
    ActivityItem,
    ActiveJobInfo,
    DoneMessage,
    ErrorMessage,
    HostInfo,
    HostStatus,
    JobState,
    LocalHostState,
    PendingJobInfo,
    RunJobRequest,
    StatusMessage,
)
from app.services.discovery import discovery_service
from app.services.execution import execution_runner
from app.services.system_info import get_display_name, get_platform_label, resolve_local_ip, utc_now


class HostService:
    def __init__(self) -> None:
        self.server: Optional[asyncio.AbstractServer] = None
        self.host: Optional[HostInfo] = None
        self.pending_job: Optional[PendingJobInfo] = None
        self.active_job: Optional[ActiveJobInfo] = None
        self.activity: Deque[ActivityItem] = deque(maxlen=20)
        self.recent_results: Deque[DoneMessage] = deque(maxlen=6)
        self._state_lock = asyncio.Lock()
        self._decision_future: Optional[asyncio.Future[bool]] = None
        self._cancel_event: Optional[asyncio.Event] = None
        self._active_writer: Optional[asyncio.StreamWriter] = None

    async def start(self, display_name: Optional[str] = None) -> LocalHostState:
        async with self._state_lock:
            if self.server and self.host:
                return self.get_state()

            self.server = await asyncio.start_server(self._handle_connection, "0.0.0.0", 0)
            port = self.server.sockets[0].getsockname()[1]
            self.host = HostInfo(
                host_id=f"host-{uuid.uuid4().hex[:8]}",
                display_name=display_name or get_display_name(),
                host=resolve_local_ip(),
                port=port,
                status=HostStatus.IDLE,
                platform=get_platform_label(),
            )
            discovery_service.register_host(self.host)
            self._record_activity(
                f"Host mode enabled on {self.host.host}:{self.host.port}.",
            )
            return self.get_state()

    async def stop(self) -> LocalHostState:
        async with self._state_lock:
            if self._decision_future and not self._decision_future.done():
                self._decision_future.set_result(False)
            if self._cancel_event:
                self._cancel_event.set()
            if self._active_writer:
                self._active_writer.close()

            if self.server:
                self.server.close()
                await self.server.wait_closed()
                self.server = None

            discovery_service.unregister_host()
            self.host = None
            self.pending_job = None
            self.active_job = None
            self._decision_future = None
            self._cancel_event = None
            self._active_writer = None
            self._record_activity("Host mode disabled.")
            return self.get_state()

    async def decide_job(self, job_id: str, accept: bool) -> LocalHostState:
        async with self._state_lock:
            if not self.pending_job or self.pending_job.job_id != job_id:
                raise ValueError("No pending job with that id")
            if not self._decision_future or self._decision_future.done():
                raise ValueError("Job no longer awaits a decision")

            self._decision_future.set_result(accept)
            decision = "accepted" if accept else "denied"
            self._record_activity(f"Host {decision} job {job_id}.")
            return self.get_state()

    def get_state(self) -> LocalHostState:
        return LocalHostState(
            running=self.server is not None and self.host is not None,
            host=self.host.model_copy() if self.host else None,
            pending_job=self.pending_job.model_copy() if self.pending_job else None,
            active_job=self.active_job.model_copy() if self.active_job else None,
            activity=[item.model_copy() for item in self.activity],
            recent_results=[item.model_copy() for item in self.recent_results],
        )

    async def _handle_connection(
        self,
        reader: asyncio.StreamReader,
        writer: asyncio.StreamWriter,
    ) -> None:
        owns_slot = False
        remote = writer.get_extra_info("peername")
        remote_address = f"{remote[0]}:{remote[1]}" if remote else "unknown"

        try:
            payload = await self._read_json_line(reader)
            if payload is None:
                return

            if payload.get("type") != "run":
                await self._send(writer, ErrorMessage(message="Expected a run request first."))
                return

            request = RunJobRequest.model_validate(payload)
            guest_name = request.guest_name or remote_address

            async with self._state_lock:
                if not self.host:
                    await self._send(writer, ErrorMessage(job_id=request.job_id, message="Host mode is not running."))
                    return
                if self.pending_job or self.active_job:
                    await self._send(writer, ErrorMessage(job_id=request.job_id, message="Host is busy."))
                    return

                self.pending_job = PendingJobInfo(
                    job_id=request.job_id,
                    job_name=request.job_name,
                    guest_name=guest_name,
                    filename=request.filename,
                    timeout_secs=request.timeout_secs,
                    remote_address=remote_address,
                    submitted_at=utc_now(),
                )
                owns_slot = True
                self._active_writer = writer
                self._decision_future = asyncio.get_running_loop().create_future()
                await self._set_host_status(HostStatus.AWAITING_ACCEPT)
                self._record_activity(
                    f"Awaiting approval for {request.job_name} from {guest_name}.",
                )

            await self._send(
                writer,
                StatusMessage(
                    job_id=request.job_id,
                    state=JobState.AWAITING_ACCEPT,
                    message="Waiting for the host to accept this job.",
                ),
            )

            accepted = await self._wait_for_decision(request.job_id)
            if not accepted:
                await self._send(
                    writer,
                    ErrorMessage(
                        job_id=request.job_id,
                        message="The host declined the job or did not respond in time.",
                    ),
                )
                async with self._state_lock:
                    self.pending_job = None
                    self._decision_future = None
                    if self.host:
                        await self._set_host_status(HostStatus.IDLE)
                return

            async with self._state_lock:
                self._cancel_event = asyncio.Event()
                self.active_job = ActiveJobInfo(
                    job_id=request.job_id,
                    job_name=request.job_name,
                    guest_name=guest_name,
                    state=JobState.STARTING,
                    started_at=utc_now(),
                )
                self.pending_job = None
                self._decision_future = None
                self.active_job.state = JobState.RUNNING
                await self._set_host_status(HostStatus.BUSY)

            await self._send(
                writer,
                StatusMessage(
                    job_id=request.job_id,
                    state=JobState.STARTING,
                    message="Host accepted the job and is preparing execution.",
                ),
            )

            cancel_task = asyncio.create_task(
                self._watch_for_cancel(reader, request.job_id, self._cancel_event)
            )

            done_message = await execution_runner.run_job(
                request,
                lambda message: self._send(writer, message),
                self._cancel_event,
            )

            if done_message.state != JobState.DONE:
                await self._send(
                    writer,
                    StatusMessage(
                        job_id=request.job_id,
                        state=done_message.state,
                        message=done_message.summary,
                    ),
                )

            await self._send(writer, done_message)
            self.recent_results.appendleft(done_message)
            self._record_activity(
                f"Job {request.job_name} finished with state {done_message.state.value}.",
                level="warn" if done_message.state != JobState.DONE else "info",
            )

            cancel_task.cancel()
            await asyncio.gather(cancel_task, return_exceptions=True)
        except Exception as exc:
            await self._safe_send_error(writer, f"Host error: {exc}")
            self._record_activity(f"Connection failed: {exc}", level="error")
        finally:
            if owns_slot:
                async with self._state_lock:
                    self.pending_job = None
                    self.active_job = None
                    self._decision_future = None
                    self._cancel_event = None
                    if self.host:
                        await self._set_host_status(HostStatus.IDLE)

                self._active_writer = None
            writer.close()
            try:
                await writer.wait_closed()
            except Exception:
                pass

    async def _wait_for_decision(self, job_id: str) -> bool:
        future = self._decision_future
        if not future:
            return False
        try:
            return await asyncio.wait_for(future, timeout=90)
        except asyncio.TimeoutError:
            self._record_activity(f"Timed out waiting for approval on {job_id}.", level="warn")
            return False

    async def _watch_for_cancel(
        self,
        reader: asyncio.StreamReader,
        job_id: str,
        cancel_event: asyncio.Event,
    ) -> None:
        while True:
            payload = await self._read_json_line(reader)
            if payload is None:
                cancel_event.set()
                return
            if payload.get("type") == "cancel" and payload.get("job_id") == job_id:
                cancel_event.set()
                self._record_activity(f"Guest cancelled job {job_id}.", level="warn")
                return

    async def _read_json_line(self, reader: asyncio.StreamReader) -> Optional[dict]:
        line = await reader.readline()
        if not line:
            return None
        try:
            return json.loads(line.decode().strip())
        except json.JSONDecodeError:
            return None

    async def _send(self, writer: asyncio.StreamWriter, message: object) -> None:
        if isinstance(message, BaseModel):
            payload = cast(BaseModel, message).model_dump_json()
        else:
            payload = json.dumps(message)
        writer.write((payload + "\n").encode())
        await writer.drain()

    async def _safe_send_error(self, writer: asyncio.StreamWriter, message: str) -> None:
        try:
            await self._send(writer, ErrorMessage(message=message))
        except Exception:
            pass

    async def _set_host_status(self, status: HostStatus) -> None:
        if not self.host:
            return
        self.host.status = status
        discovery_service.update_host(self.host)

    def _record_activity(self, message: str, level: str = "info") -> None:
        self.activity.appendleft(
            ActivityItem(timestamp=utc_now(), level=level, message=message)
        )


host_service = HostService()
