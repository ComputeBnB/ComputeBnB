from __future__ import annotations

import uuid
from typing import Optional, Tuple

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from app.models.messages import ErrorMessage, RunJobRequest
from app.services.discovery import discovery_service
from app.services.system_info import get_display_name
from app.services.worker_client import HostClient

router = APIRouter(tags=["jobs"])


class WebJobRequest(BaseModel):
    job_name: str = "Untitled Job"
    code: str
    filename: str = "main.py"
    timeout_secs: int = Field(default=300, ge=1, le=3600)
    host: Optional[str] = None
    port: Optional[int] = None


@router.websocket("/api/jobs/ws/{host_id}")
@router.websocket("/jobs/ws/{host_id}")
async def job_websocket(websocket: WebSocket, host_id: str) -> None:
    await websocket.accept()
    client: Optional[HostClient] = None
    job_id: Optional[str] = None

    try:
        payload = WebJobRequest.model_validate(await websocket.receive_json())
        target_host, target_port = _resolve_target(host_id, payload.host, payload.port)
        client = HostClient(target_host, target_port)
        await client.connect()

        job_id = str(uuid.uuid4())
        await client.send_job(
            RunJobRequest(
                job_id=job_id,
                job_name=payload.job_name,
                guest_name=get_display_name(),
                filename=payload.filename,
                timeout_secs=payload.timeout_secs,
                code=payload.code,
            )
        )

        async for message in client.stream_responses():
            await websocket.send_json(message)
    except WebSocketDisconnect:
        if client and job_id:
            try:
                await client.cancel_job(job_id)
            except Exception:
                pass
    except Exception as exc:
        await websocket.send_json(ErrorMessage(job_id=job_id, message=str(exc)).model_dump(mode="json"))
    finally:
        if client:
            await client.disconnect()
        await websocket.close()


def _resolve_target(host_id: str, manual_host: Optional[str], manual_port: Optional[int]) -> Tuple[str, int]:
    if host_id == "manual":
        if not manual_host or not manual_port:
            raise ValueError("Manual host selection requires both host and port.")
        return manual_host, manual_port

    hosts = discovery_service.get_hosts()
    host = hosts.get(host_id)
    if not host:
        raise ValueError("Host not found.")
    return host.host, host.port
