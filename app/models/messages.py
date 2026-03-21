from pydantic import BaseModel
from typing import Optional
from enum import Enum
from datetime import datetime


class JobState(str, Enum):
    PENDING = "pending"
    STARTING = "starting"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"
    TIMEOUT = "timeout"
    CANCELLED = "cancelled"


class WorkerStatus(str, Enum):
    IDLE = "idle"
    BUSY = "busy"
    OFFLINE = "offline"


class RequestStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DENIED = "denied"
    EXPIRED = "expired"


# Job request from guest to host (handshake)
class JobRequest(BaseModel):
    request_id: str
    guest_name: str
    guest_ip: str
    code: str
    filename: str = "main.py"
    timeout_secs: int = 300
    status: RequestStatus = RequestStatus.PENDING
    created_at: datetime = datetime.now()


# Session token issued after host approves a request
class SessionToken(BaseModel):
    token: str
    request_id: str
    expires_at: datetime


# Cancel request
class CancelJobRequest(BaseModel):
    type: str = "cancel"
    job_id: str


# Streaming messages (host -> guest over WebSocket)
class StatusMessage(BaseModel):
    type: str = "status"
    state: JobState


class StdoutMessage(BaseModel):
    type: str = "stdout"
    data: str


class StderrMessage(BaseModel):
    type: str = "stderr"
    data: str


class MetricsMessage(BaseModel):
    type: str = "metrics"
    cpu_pct: float
    mem_mb: float


class DoneMessage(BaseModel):
    type: str = "done"
    exit_code: int
    duration_ms: int


class ErrorMessage(BaseModel):
    type: str = "error"
    message: str


# Worker info for discovery
class WorkerInfo(BaseModel):
    worker_id: str
    display_name: str
    host: str
    port: int
    status: WorkerStatus
    platform: Optional[str] = None
