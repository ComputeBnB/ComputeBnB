from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models.messages import HostDecisionRequest, LocalHostState, StartHostRequest
from app.services.host_service import host_service

router = APIRouter(prefix="/api/local-host", tags=["local-host"])


@router.get("", response_model=LocalHostState)
async def get_local_host_state() -> LocalHostState:
    return host_service.get_state()


@router.post("/start", response_model=LocalHostState)
async def start_local_host(request: StartHostRequest) -> LocalHostState:
    return await host_service.start(request.display_name)


@router.post("/stop", response_model=LocalHostState)
async def stop_local_host() -> LocalHostState:
    return await host_service.stop()


@router.post("/decisions/{job_id}", response_model=LocalHostState)
async def decide_pending_job(job_id: str, request: HostDecisionRequest) -> LocalHostState:
    try:
        return await host_service.decide_job(job_id, request.decision == "accept")
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
