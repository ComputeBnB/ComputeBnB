from __future__ import annotations

import asyncio
import contextlib
import shutil
import sys
import tempfile
from pathlib import Path
from time import monotonic
from typing import Awaitable, Callable, Optional

from app.models.messages import (
    ArtifactInfo,
    DoneMessage,
    JobState,
    MetricsMessage,
    RunJobRequest,
    StderrMessage,
    StatusMessage,
    StdoutMessage,
)
from app.services.system_info import getenv_bool, human_bytes

DOCKER_IMAGE = "python:3.11-slim"
MessageSender = Callable[[object], Awaitable[None]]


class ExecutionRunner:
    def __init__(self) -> None:
        self._docker_available: Optional[bool] = None
        self._docker_lock = asyncio.Lock()

    async def run_job(
        self,
        request: RunJobRequest,
        send_message: MessageSender,
        cancel_event: asyncio.Event,
    ) -> DoneMessage:
        workspace = Path(tempfile.mkdtemp(prefix=f"computebnb-{request.job_id[:8]}-"))
        process: Optional[asyncio.subprocess.Process] = None
        container_name = f"computebnb-{request.job_id[:8]}"
        backend = "subprocess"
        start_time = monotonic()

        try:
            entrypoint = workspace / request.filename
            entrypoint.parent.mkdir(parents=True, exist_ok=True)
            entrypoint.write_text(request.code, encoding="utf-8")

            use_docker = await self._docker_is_available()
            backend = "docker" if use_docker else "subprocess"
            command = self._build_command(backend, container_name, workspace, request.filename)

            if backend == "subprocess":
                await send_message(
                    StderrMessage(
                        job_id=request.job_id,
                        data="Docker unavailable; running in trusted-demo subprocess mode.\n",
                    )
                )

            process = await asyncio.create_subprocess_exec(
                *command,
                cwd=str(workspace),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            await send_message(
                StatusMessage(
                    job_id=request.job_id,
                    state=JobState.RUNNING,
                    message=f"Running on {backend}.",
                )
            )

            stdout_task = asyncio.create_task(
                self._pump_stream(process.stdout, request.job_id, "stdout", send_message)
            )
            stderr_task = asyncio.create_task(
                self._pump_stream(process.stderr, request.job_id, "stderr", send_message)
            )
            metrics_task = asyncio.create_task(
                self._emit_metrics(request.job_id, send_message, start_time)
            )

            wait_task = asyncio.create_task(process.wait())
            timeout_task = asyncio.create_task(asyncio.sleep(request.timeout_secs))
            cancel_task = asyncio.create_task(cancel_event.wait())

            done, pending = await asyncio.wait(
                {wait_task, timeout_task, cancel_task},
                return_when=asyncio.FIRST_COMPLETED,
            )

            state = JobState.DONE
            error: Optional[str] = None
            exit_code = 0

            if wait_task in done:
                exit_code = await wait_task
                state = JobState.DONE if exit_code == 0 else JobState.FAILED
            elif timeout_task in done:
                state = JobState.TIMEOUT
                exit_code = -1
                error = f"Timed out after {request.timeout_secs} seconds"
                await self._stop_process(process, backend, container_name)
                await wait_task
            else:
                state = JobState.CANCELLED
                exit_code = -1
                error = "Guest closed the connection before the job finished"
                await self._stop_process(process, backend, container_name)
                await wait_task

            for task in pending:
                task.cancel()

            metrics_task.cancel()
            await asyncio.gather(stdout_task, stderr_task, metrics_task, return_exceptions=True)

            duration_ms = int((monotonic() - start_time) * 1000)
            artifacts = self._collect_artifacts(workspace, request.filename)
            return DoneMessage(
                job_id=request.job_id,
                state=state,
                exit_code=exit_code,
                duration_ms=duration_ms,
                backend=backend,
                artifacts=artifacts,
                summary=self._build_summary(state, backend, artifacts, error),
                error=error,
            )
        except Exception as exc:
            if process is not None:
                await self._stop_process(process, backend, container_name)
            return DoneMessage(
                job_id=request.job_id,
                state=JobState.FAILED,
                exit_code=-1,
                duration_ms=int((monotonic() - start_time) * 1000),
                backend=backend,
                artifacts=[],
                summary="Job setup failed before execution started.",
                error=str(exc),
            )
        finally:
            shutil.rmtree(workspace, ignore_errors=True)

    async def _docker_is_available(self) -> bool:
        if getenv_bool("COMPUTEBNB_DISABLE_DOCKER"):
            return False
        async with self._docker_lock:
            if self._docker_available is not None:
                return self._docker_available

            try:
                process = await asyncio.create_subprocess_exec(
                    "docker",
                    "info",
                    stdout=asyncio.subprocess.DEVNULL,
                    stderr=asyncio.subprocess.DEVNULL,
                )
            except FileNotFoundError:
                self._docker_available = False
                return False

            try:
                await asyncio.wait_for(process.wait(), timeout=5)
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()
                self._docker_available = False
                return False

            self._docker_available = process.returncode == 0
            return self._docker_available

    def _build_command(
        self,
        backend: str,
        container_name: str,
        workspace: Path,
        filename: str,
    ) -> list[str]:
        if backend == "docker":
            return [
                "docker",
                "run",
                "--rm",
                "--name",
                container_name,
                "--network",
                "none",
                "-v",
                f"{workspace.resolve()}:/workspace",
                "-w",
                "/workspace",
                DOCKER_IMAGE,
                "python",
                "-u",
                filename,
            ]

        return [sys.executable, "-u", filename]

    async def _pump_stream(
        self,
        stream: Optional[asyncio.StreamReader],
        job_id: str,
        stream_type: str,
        send_message: MessageSender,
    ) -> None:
        if stream is None:
            return

        while True:
            chunk = await stream.readline()
            if not chunk:
                break

            text = chunk.decode(errors="replace")
            if stream_type == "stdout":
                await send_message(StdoutMessage(job_id=job_id, data=text))
            else:
                await send_message(StderrMessage(job_id=job_id, data=text))

    async def _emit_metrics(
        self,
        job_id: str,
        send_message: MessageSender,
        start_time: float,
    ) -> None:
        while True:
            await asyncio.sleep(1)
            await send_message(
                MetricsMessage(
                    job_id=job_id,
                    elapsed_secs=round(monotonic() - start_time, 1),
                )
            )

    async def _stop_process(
        self,
        process: asyncio.subprocess.Process,
        backend: str,
        container_name: str,
    ) -> None:
        if process.returncode is None:
            process.terminate()
            try:
                await asyncio.wait_for(process.wait(), timeout=5)
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()

        if backend == "docker":
            cleanup = await asyncio.create_subprocess_exec(
                "docker",
                "rm",
                "-f",
                container_name,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL,
            )
            with contextlib.suppress(Exception):
                await asyncio.wait_for(cleanup.wait(), timeout=5)

    def _collect_artifacts(self, workspace: Path, filename: str) -> list[ArtifactInfo]:
        artifacts: list[ArtifactInfo] = []
        for path in sorted(workspace.rglob("*")):
            if not path.is_file():
                continue
            relative = path.relative_to(workspace).as_posix()
            if relative == filename:
                continue
            size_bytes = path.stat().st_size
            artifacts.append(
                ArtifactInfo(
                    name=path.name,
                    path=relative,
                    size_bytes=size_bytes,
                    size_label=human_bytes(size_bytes),
                    kind=self._classify_artifact(path),
                )
            )
        return artifacts

    def _classify_artifact(self, path: Path) -> str:
        suffix = path.suffix.lower()
        if suffix in {".json", ".yaml", ".yml"}:
            return "Metrics"
        if suffix in {".png", ".jpg", ".jpeg", ".svg"}:
            return "Visualization"
        if suffix in {".csv", ".txt", ".md"}:
            return "Results"
        if suffix in {".pkl", ".pt", ".bin"}:
            return "Model"
        return "Output"

    def _build_summary(
        self,
        state: JobState,
        backend: str,
        artifacts: list[ArtifactInfo],
        error: Optional[str],
    ) -> str:
        if state == JobState.DONE:
            if artifacts:
                return f"Finished on {backend} and collected {len(artifacts)} output file(s)."
            return f"Finished successfully on {backend} with no output files produced."
        if state == JobState.TIMEOUT:
            return error or "The host stopped the job after it hit the timeout limit."
        if state == JobState.CANCELLED:
            return error or "The guest disconnected before the job finished."
        return error or f"The job exited unsuccessfully on {backend}."


execution_runner = ExecutionRunner()
