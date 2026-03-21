export interface WorkerSpecs {
  cpu: string;
  cpuCores: number;
  ram: string;
  gpu?: string;
}

export interface Worker {
  id: string;
  name: string;
  host: string;
  port: number;
  status: "available" | "busy" | "offline";
  platform?: string;
  specs?: WorkerSpecs;
}

export interface Job {
  id: string;
  name: string;
  worker: Worker;
  code: string;
  requestId: string;
  timeoutSecs: number;
  status: "pending" | "running" | "completed" | "failed";
  startTime?: Date;
  endTime?: Date;
  logs: string[];
  result?: JobResult;
}

export interface JobResult {
  exitCode: number;
  runtime: number;
  output: string;
}

export interface HostingRequest {
  request_id: string;
  guest_name: string;
  guest_ip: string;
  filename: string;
  timeout_secs: number;
  code_preview: string;
  created_at: string;
}

export interface ActiveJob {
  active: boolean;
  request_id?: string;
  guest_name?: string;
  guest_ip?: string;
  code?: string;
  filename?: string;
  state?: string;
  started_at?: string;
  logs?: { type: string; data: string }[];
}

export type AppStage = "discover" | "submit" | "execution" | "complete";

export type AppMode = "guest" | "host";

export type JobStatus =
  | "pending"
  | "approved"
  | "denied"
  | "running"
  | "done"
  | "error";
