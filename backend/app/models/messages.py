from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum
from datetime import datetime


class JobState(str, Enum):
    PENDING = "pending"
    STARTING = "starting"
    PREPARING_PROJECT = "preparing_project"
    INSTALLING_DEPENDENCIES = "installing_dependencies"
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


class ProjectFile(BaseModel):
    path: str
    content_b64: str
    size_bytes: int = 0


# Job request from guest to host (handshake)
class JobRequest(BaseModel):
    request_id: str
    guest_name: str
    guest_ip: str
    code: str
    filename: str = "main.py"
    entrypoint: str = "main.py"
    project_name: Optional[str] = None
    project_files: list[ProjectFile] = Field(default_factory=list)
    timeout_secs: int = 300
    status: RequestStatus = RequestStatus.PENDING
    created_at: datetime = datetime.now()
    paid: bool = False  # Added for mock payment system


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
    detail: Optional[str] = None
    runtime: Optional[str] = None


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


class GeneratedFileMessage(BaseModel):
    type: str = "generated_file"
    path: str
    content_b64: str
    size_bytes: int


# Worker info for discovery
class WorkerInfo(BaseModel):
    worker_id: str
    display_name: str
    host: str
    port: int
    status: WorkerStatus
    platform: Optional[str] = None
