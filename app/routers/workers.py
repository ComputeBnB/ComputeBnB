from __future__ import annotations

from typing import List

from fastapi import APIRouter, HTTPException

from app.models.messages import HostInfo
from app.services.discovery import discovery_service

router = APIRouter(tags=["hosts"])


@router.get("/api/hosts", response_model=List[HostInfo])
@router.get("/workers", response_model=List[HostInfo])
async def list_hosts() -> list[HostInfo]:
    hosts = discovery_service.get_hosts()
    return list(hosts.values())


@router.get("/api/hosts/{host_id}", response_model=HostInfo)
@router.get("/workers/{host_id}", response_model=HostInfo)
async def get_host(host_id: str) -> HostInfo:
    hosts = discovery_service.get_hosts()
    if host_id not in hosts:
        raise HTTPException(status_code=404, detail="Host not found")
    return hosts[host_id]
