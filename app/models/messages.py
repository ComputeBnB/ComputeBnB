from pydantic import BaseModel
from typing import Optional
from enum import Enum


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


# Client -> Worker messages
class RunJobRequest(BaseModel):
    type: str = "run"
    job_id: str
    timeout_secs: int = 300
    filename: str = "main.py"
    code: str


class CancelJobRequest(BaseModel):
    type: str = "cancel"
    job_id: str


# Worker -> Client messages
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
