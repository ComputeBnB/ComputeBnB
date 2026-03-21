"""
Jobs router - endpoints for guests to request, poll, and execute jobs on this host.
All endpoints require hosting mode to be active.
"""

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Query, Request
from pydantic import BaseModel, Field
from typing import Optional
from app.models.messages import ProjectFile
from app.services.hosting import hosting_service

router = APIRouter(prefix="/jobs", tags=["jobs"])


class JobRequestBody(BaseModel):
    code: str
    filename: str = "main.py"
    entrypoint: Optional[str] = None
    project_name: Optional[str] = None
    project_files: list[ProjectFile] = Field(default_factory=list)
    timeout_secs: int = 300
    guest_name: str = "anonymous"


@router.post("/request")
async def request_job(body: JobRequestBody, request: Request):
    """
    Guest sends a job request to this host.
    The host must approve it before execution can begin.
    """
    if not hosting_service.is_hosting:
        raise HTTPException(status_code=400, detail="This machine is not hosting")

    guest_ip = request.client.host if request.client else "unknown"

    job_request = hosting_service.create_request(
        guest_name=body.guest_name,
        guest_ip=guest_ip,
        code=body.code,
        filename=body.filename,
        entrypoint=body.entrypoint or body.filename,
        project_name=body.project_name,
        project_files=body.project_files,
        timeout_secs=body.timeout_secs,
    )

    return {
        "request_id": job_request.request_id,
        "status": job_request.status.value,
        "message": "Request submitted. Poll GET /jobs/request/{request_id}/status for approval.",
    }


@router.get("/request/{request_id}/status")
async def get_request_status(request_id: str):
    """
    Guest polls this endpoint to check if their job request was approved/denied.
    When approved, the response includes a session token for WebSocket execution.
    """
    if not hosting_service.is_hosting:
        raise HTTPException(status_code=400, detail="This machine is not hosting")

    job_request = hosting_service.get_request(request_id)
    if not job_request:
        raise HTTPException(status_code=404, detail="Request not found")

    result = {
        "request_id": request_id,
        "status": job_request.status.value,
    }

    # If accepted, find the token for this request
    if job_request.status.value == "accepted":
        for token, session in hosting_service.active_tokens.items():
            if session.request_id == request_id:
                result["token"] = token
                result["ws_url"] = f"/jobs/execute/{request_id}?token={token}"
                break

    return result


@router.websocket("/execute/{request_id}")
async def execute_job(websocket: WebSocket, request_id: str, token: str = Query(...)):
    """
    Authenticated WebSocket for job execution.
    Guest must provide a valid session token (from approval) to connect.
    Host executes the job and streams stdout/stderr/done back.
    """
    # Validate the token before accepting the WebSocket
    session = hosting_service.validate_token(token)
    if not session or session.request_id != request_id:
        await websocket.close(code=4001, reason="Invalid or expired token")
        return

    await websocket.accept()

    try:
        # Execute the job and stream results
        async for message in hosting_service.execute_job(request_id):
            await websocket.send_json(message)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
