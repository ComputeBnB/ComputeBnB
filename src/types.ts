export type HostStatus = "idle" | "awaiting_accept" | "busy" | "offline";

export type JobState =
  | "pending"
  | "awaiting_accept"
  | "starting"
  | "running"
  | "done"
  | "failed"
  | "timeout"
  | "cancelled"
  | "denied";

export interface Host {
  host_id: string;
  display_name: string;
  host: string;
  port: number;
  status: HostStatus;
  platform?: string | null;
  runtime: string;
  last_seen: string;
  manual?: boolean;
}

export interface Artifact {
  name: string;
  path: string;
  size_bytes: number;
  size_label: string;
  kind: string;
}

export interface JobResult {
  type: "done";
  job_id: string;
  state: JobState;
  exit_code: number;
  duration_ms: number;
  backend: string;
  artifacts: Artifact[];
  summary: string;
  error?: string | null;
}

export interface JobSession {
  id: string;
  name: string;
  host: Host;
  state: JobState;
  filename: string;
}

export interface ActivityItem {
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
}

export interface PendingJobInfo {
  job_id: string;
  job_name: string;
  guest_name: string;
  filename: string;
  timeout_secs: number;
  remote_address: string;
  submitted_at: string;
}

export interface ActiveJobInfo {
  job_id: string;
  job_name: string;
  guest_name: string;
  state: JobState;
  backend?: string | null;
  started_at?: string | null;
}

export interface LocalHostState {
  running: boolean;
  host?: Host | null;
  pending_job?: PendingJobInfo | null;
  active_job?: ActiveJobInfo | null;
  activity: ActivityItem[];
  recent_results: JobResult[];
}

export interface LogEntry {
  kind: "stdout" | "stderr" | "status" | "metrics";
  line: string;
}

export interface ManualHostInput {
  display_name: string;
  host: string;
  port: number;
}

export type AppStage = "discover" | "submit" | "execution" | "complete";

export type AppMode = "guest" | "host";
