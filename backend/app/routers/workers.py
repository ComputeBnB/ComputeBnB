from fastapi import APIRouter, HTTPException
from typing import List
from app.models.messages import WorkerInfo
from app.services.discovery import discovery_service
from app.services.hosting import hosting_service

router = APIRouter(prefix="/workers", tags=["workers"])


@router.get("", response_model=List[WorkerInfo])
async def list_workers():
    """List all discovered workers on the LAN, excluding this machine."""
    workers = discovery_service.get_workers()
    own_id = hosting_service.worker_id
    return [w for w in workers.values() if w.worker_id != own_id]


@router.get("/{worker_id}", response_model=WorkerInfo)
async def get_worker(worker_id: str):
    """Get a specific worker by ID."""
    workers = discovery_service.get_workers()
    if worker_id not in workers:
        raise HTTPException(status_code=404, detail="Worker not found")
    return workers[worker_id]
