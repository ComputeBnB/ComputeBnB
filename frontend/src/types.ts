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

export interface ProjectFileUpload {
  path: string;
  content_b64: string;
  size_bytes: number;
}

export interface ProjectUpload {
  name: string;
  entrypoint: string;
  fileCount: number;
  hasRequirementsTxt: boolean;
  files: ProjectFileUpload[];
}

export interface Job {
  id: string;
  name: string;
  worker: Worker;
  code: string;
  filename: string;
  entrypoint: string;
  projectName?: string;
  projectFileCount?: number;
  hasRequirementsTxt?: boolean;
  projectFiles?: ProjectFileUpload[];
  requestId: string;
  timeoutSecs: number;
  status: "pending" | "running" | "completed" | "failed";
  phase?: string;
  phaseDetail?: string;
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
  entrypoint?: string;
  project_name?: string;
  file_count?: number;
  has_requirements_txt?: boolean;
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
  entrypoint?: string;
  project_name?: string;
  file_count?: number;
  has_requirements_txt?: boolean;
  requirements_path?: string | null;
  state?: string;
  status_detail?: string | null;
  runtime?: string;
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
  | "error"
  | "timeout";
