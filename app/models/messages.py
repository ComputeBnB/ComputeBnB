from __future__ import annotations

from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, Field


class JobState(str, Enum):
    PENDING = "pending"
    AWAITING_ACCEPT = "awaiting_accept"
    STARTING = "starting"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"
    TIMEOUT = "timeout"
    CANCELLED = "cancelled"
    DENIED = "denied"


class HostStatus(str, Enum):
    IDLE = "idle"
    AWAITING_ACCEPT = "awaiting_accept"
    BUSY = "busy"
    OFFLINE = "offline"


class RunJobRequest(BaseModel):
    type: Literal["run"] = "run"
    job_id: str
    job_name: str = "Untitled Job"
    guest_name: Optional[str] = None
    timeout_secs: int = Field(default=300, ge=1, le=3600)
    filename: str = "main.py"
    code: str


class CancelJobRequest(BaseModel):
    type: Literal["cancel"] = "cancel"
    job_id: str


class StatusMessage(BaseModel):
    type: Literal["status"] = "status"
    job_id: str
    state: JobState
    message: Optional[str] = None


class StdoutMessage(BaseModel):
    type: Literal["stdout"] = "stdout"
    job_id: str
    data: str


class StderrMessage(BaseModel):
    type: Literal["stderr"] = "stderr"
    job_id: str
    data: str


class MetricsMessage(BaseModel):
    type: Literal["metrics"] = "metrics"
    job_id: str
    cpu_pct: float = 0.0
    mem_mb: float = 0.0
    elapsed_secs: float = 0.0


class ArtifactInfo(BaseModel):
    name: str
    path: str
    size_bytes: int
    size_label: str
    kind: str


class DoneMessage(BaseModel):
    type: Literal["done"] = "done"
    job_id: str
    state: JobState = JobState.DONE
    exit_code: int
    duration_ms: int
    backend: str
    artifacts: list[ArtifactInfo] = Field(default_factory=list)
    summary: str
    error: Optional[str] = None


class ErrorMessage(BaseModel):
    type: Literal["error"] = "error"
    job_id: Optional[str] = None
    message: str


class HostInfo(BaseModel):
    host_id: str
    display_name: str
    host: str
    port: int
    status: HostStatus
    platform: Optional[str] = None
    runtime: str = "docker-first"
    last_seen: str = "just now"


class PendingJobInfo(BaseModel):
    job_id: str
    job_name: str
    guest_name: str
    filename: str
    timeout_secs: int
    remote_address: str
    submitted_at: str


class ActiveJobInfo(BaseModel):
    job_id: str
    job_name: str
    guest_name: str
    state: JobState
    backend: Optional[str] = None
    started_at: Optional[str] = None


class ActivityItem(BaseModel):
    timestamp: str
    level: Literal["info", "warn", "error"] = "info"
    message: str


class LocalHostState(BaseModel):
    running: bool = False
    host: Optional[HostInfo] = None
    pending_job: Optional[PendingJobInfo] = None
    active_job: Optional[ActiveJobInfo] = None
    activity: list[ActivityItem] = Field(default_factory=list)
    recent_results: list[DoneMessage] = Field(default_factory=list)


class StartHostRequest(BaseModel):
    display_name: Optional[str] = None


class HostDecisionRequest(BaseModel):
    decision: Literal["accept", "deny"]


# Backward-compatible aliases while the older API paths still exist.
WorkerInfo = HostInfo
WorkerStatus = HostStatus
