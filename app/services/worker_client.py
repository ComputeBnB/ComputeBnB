import asyncio
import json
from typing import AsyncGenerator, Optional
from app.models.messages import RunJobRequest, CancelJobRequest


class WorkerClient:
    """TCP client for communicating with worker nodes."""

    def __init__(self, host: str, port: int):
        self.host = host
        self.port = port
        self.reader: Optional[asyncio.StreamReader] = None
        self.writer: Optional[asyncio.StreamWriter] = None

    async def connect(self) -> None:
        self.reader, self.writer = await asyncio.open_connection(
            self.host, self.port
        )

    async def disconnect(self) -> None:
        if self.writer:
            self.writer.close()
            await self.writer.wait_closed()
            self.writer = None
            self.reader = None

    async def send_job(self, request: RunJobRequest) -> None:
        if not self.writer:
            raise ConnectionError("Not connected to worker")

        message = request.model_dump_json() + "\n"
        self.writer.write(message.encode())
        await self.writer.drain()

    async def cancel_job(self, job_id: str) -> None:
        if not self.writer:
            raise ConnectionError("Not connected to worker")

        request = CancelJobRequest(job_id=job_id)
        message = request.model_dump_json() + "\n"
        self.writer.write(message.encode())
        await self.writer.drain()

    async def stream_responses(self) -> AsyncGenerator[dict, None]:
        if not self.reader:
            raise ConnectionError("Not connected to worker")

        while True:
            line = await self.reader.readline()
            if not line:
                break

            try:
                data = json.loads(line.decode().strip())
                yield data

                if data.get("type") in ("done", "error"):
                    break
            except json.JSONDecodeError:
                continue
