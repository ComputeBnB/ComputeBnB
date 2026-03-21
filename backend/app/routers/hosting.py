"""
Hosting router - endpoints to control this machine's hosting state
and manage job approval/denial.
"""

from fastapi import APIRouter, HTTPException
from app.services.hosting import hosting_service

router = APIRouter(prefix="/hosting", tags=["hosting"])


@router.post("/start")
async def start_hosting():
    """Enable hosting mode - advertise this machine and accept job requests."""
    result = await hosting_service.start_hosting()
    return result


@router.post("/stop")
async def stop_hosting():
    """Disable hosting mode - stop advertising and reject new requests."""
    result = await hosting_service.stop_hosting()
    return result


@router.get("/status")
async def get_hosting_status():
    """Get current hosting status of this machine."""
    return hosting_service.get_status()


@router.get("/requests")
async def get_pending_requests():
    """Get all pending job requests (for host UI to display)."""
    if not hosting_service.is_hosting:
        raise HTTPException(status_code=400, detail="Not in hosting mode")
    pending = hosting_service.get_all_pending()
    return [
        {
            "request_id": r.request_id,
            "guest_name": r.guest_name,
            "guest_ip": r.guest_ip,
            "filename": r.filename,
            "timeout_secs": r.timeout_secs,
            "code_preview": r.code[:200] + ("..." if len(r.code) > 200 else ""),
            "created_at": r.created_at.isoformat(),
        }
        for r in pending
    ]


@router.post("/requests/{request_id}/approve")
async def approve_request(request_id: str):
    """Approve a pending job request. Returns a session token for the guest."""
    if not hosting_service.is_hosting:
        raise HTTPException(status_code=400, detail="Not in hosting mode")

    result = hosting_service.approve_request(request_id)
    if not result:
        raise HTTPException(status_code=404, detail="Request not found or not pending")
    return result


@router.get("/active-job")
async def get_active_job():
    """Get the currently running job info and logs (for host UI)."""
    if not hosting_service.is_hosting:
        raise HTTPException(status_code=400, detail="Not in hosting mode")

    if not hosting_service.active_job:
        return {"active": False}

    return {
        "active": True,
        **hosting_service.active_job,
        "logs": hosting_service.active_job_logs,
    }


@router.post("/requests/{request_id}/deny")
async def deny_request(request_id: str):
    """Deny a pending job request."""
    if not hosting_service.is_hosting:
        raise HTTPException(status_code=400, detail="Not in hosting mode")

    result = hosting_service.deny_request(request_id)
    if not result:
        raise HTTPException(status_code=404, detail="Request not found or not pending")
    return result
