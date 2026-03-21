import uuid
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from app.models.messages import RunJobRequest
from app.services.discovery import discovery_service
from app.services.worker_client import WorkerClient

router = APIRouter(prefix="/jobs", tags=["jobs"])


class SubmitJobRequest(BaseModel):
    worker_id: str
    code: str
    filename: str = "main.py"
    timeout_secs: int = 300


@router.post("/submit")
async def submit_job(request: SubmitJobRequest):
    """Submit a job to a worker. Returns job_id for tracking."""
    workers = discovery_service.get_workers()
    if request.worker_id not in workers:
        raise HTTPException(status_code=404, detail="Worker not found")

    job_id = str(uuid.uuid4())
    worker = workers[request.worker_id]

    return {
        "job_id": job_id,
        "worker_id": request.worker_id,
        "worker_host": worker.host,
        "worker_port": worker.port,
        "message": "Use WebSocket /jobs/ws/{job_id} to execute and stream logs"
    }


@router.websocket("/ws/{worker_id}")
async def job_websocket(websocket: WebSocket, worker_id: str):
    """
    WebSocket endpoint for job execution and log streaming.

    Client sends: {"code": "...", "filename": "main.py", "timeout_secs": 300}
    Server streams: stdout, stderr, status, metrics, done/error messages
    """
    await websocket.accept()

    workers = discovery_service.get_workers()
    if worker_id not in workers:
        await websocket.send_json({"type": "error", "message": "Worker not found"})
        await websocket.close()
        return

    worker = workers[worker_id]
    client = WorkerClient(worker.host, worker.port)

    try:
        await client.connect()

        # Receive job request from GUI
        data = await websocket.receive_json()
        job_id = str(uuid.uuid4())

        job_request = RunJobRequest(
            job_id=job_id,
            code=data.get("code", ""),
            filename=data.get("filename", "main.py"),
            timeout_secs=data.get("timeout_secs", 300),
        )

        await websocket.send_json({"type": "status", "state": "starting", "job_id": job_id})
        await client.send_job(job_request)

        # Stream responses from worker to GUI
        async for message in client.stream_responses():
            await websocket.send_json(message)

    except WebSocketDisconnect:
        await client.cancel_job(job_id)
    except Exception as e:
        await websocket.send_json({"type": "error", "message": str(e)})
    finally:
        await client.disconnect()
        await websocket.close()
