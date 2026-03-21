"""
Hosting router - endpoints to control this machine's hosting state.
"""

from fastapi import APIRouter
from app.services.hosting import hosting_service

router = APIRouter(prefix="/hosting", tags=["hosting"])


@router.post("/start")
async def start_hosting():
    """
    Enable hosting mode - advertise this machine as a worker and accept jobs.
    """
    result = await hosting_service.start_hosting()
    return result


@router.post("/stop")
async def stop_hosting():
    """
    Disable hosting mode - stop advertising and accepting jobs.
    """
    result = await hosting_service.stop_hosting()
    return result


@router.get("/status")
async def get_hosting_status():
    """
    Get current hosting status of this machine.
    """
    return hosting_service.get_status()
