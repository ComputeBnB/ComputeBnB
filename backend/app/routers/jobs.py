"""
Jobs router - endpoints for guests to request, poll, and execute jobs on this host.
All endpoints require hosting mode to be active.
"""

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Query, Request, File, UploadFile, Form
from pydantic import BaseModel
from app.services.hosting import hosting_service

router = APIRouter(prefix="/jobs", tags=["jobs"])





@router.post("/request")
async def request_job(
    request: Request,
    file: UploadFile = File(...),
    timeout_secs: int = Form(300),
    guest_name: str = Form("anonymous")
):
    """
    Guest sends a job request to this host as a zip file.
    The host must approve it before execution can begin.
    """
    if not hosting_service.is_hosting:
        raise HTTPException(status_code=400, detail="This machine is not hosting")

    guest_ip = request.client.host if request.client else "unknown"
    file_content = await file.read()
    filename = file.filename

    job_request = hosting_service.create_request(
        guest_name=guest_name,
        guest_ip=guest_ip,
        code=None,
        filename=filename,
        timeout_secs=timeout_secs,
        file_content=file_content,
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
