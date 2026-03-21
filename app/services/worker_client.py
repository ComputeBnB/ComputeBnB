from __future__ import annotations

import asyncio
import json
from typing import AsyncGenerator, Optional

from app.models.messages import CancelJobRequest, RunJobRequest


class HostClient:
    def __init__(self, host: str, port: int):
        self.host = host
        self.port = port
        self.reader: Optional[asyncio.StreamReader] = None
        self.writer: Optional[asyncio.StreamWriter] = None

    async def connect(self) -> None:
        self.reader, self.writer = await asyncio.open_connection(self.host, self.port)

    async def disconnect(self) -> None:
        if not self.writer:
            return
        self.writer.close()
        try:
            await self.writer.wait_closed()
        finally:
            self.reader = None
            self.writer = None

    async def send_job(self, request: RunJobRequest) -> None:
        await self._send_message(request.model_dump(mode="json"))

    async def cancel_job(self, job_id: str) -> None:
        await self._send_message(CancelJobRequest(job_id=job_id).model_dump(mode="json"))

    async def stream_responses(self) -> AsyncGenerator[dict, None]:
        if not self.reader:
            raise ConnectionError("Not connected to host")

        while True:
            line = await self.reader.readline()
            if not line:
                break

            try:
                message = json.loads(line.decode().strip())
            except json.JSONDecodeError:
                continue

            yield message
            if message.get("type") in {"done", "error"}:
                break

    async def _send_message(self, payload: dict) -> None:
        if not self.writer:
            raise ConnectionError("Not connected to host")
        self.writer.write((json.dumps(payload) + "\n").encode())
        await self.writer.drain()


WorkerClient = HostClient
