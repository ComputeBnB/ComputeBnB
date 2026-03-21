import {
  Worker,
  WorkerSpecs,
  HostingRequest,
  ActiveJob,
  ProjectFileUpload,
} from "./types";

const LOCAL_API = "http://localhost:8000";

function workerApi(worker: { host: string; port: number }): string {
  return `http://${worker.host}:${worker.port}`;
}

function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 5000,
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(id),
  );
}

// ── Discovery ───────────────────────────────────────────────────────

interface BackendWorker {
  worker_id: string;
  display_name: string;
  host: string;
  port: number;
  status: "idle" | "busy" | "offline";
  platform?: string;
}

export async function fetchWorkers(): Promise<Worker[]> {
  const res = await fetchWithTimeout(`${LOCAL_API}/workers`);
  if (!res.ok) throw new Error("Failed to fetch workers");
  const data: BackendWorker[] = await res.json();
  return data.map((w) => ({
    id: w.worker_id,
    name: w.display_name,
    host: w.host,
    port: w.port,
    status: w.status === "idle" ? "available" : w.status,
    platform: w.platform,
  }));
}

export async function fetchWorkerSpecs(
  host: string,
  port: number,
): Promise<WorkerSpecs> {
  const res = await fetchWithTimeout(`http://${host}:${port}/specs`, {}, 3000);
  if (!res.ok) throw new Error("Failed to fetch specs");
  const data = await res.json();
  return {
    cpu: data.cpu,
    cpuCores: data.cpu_cores,
    ram: data.ram,
    gpu: data.gpu ?? undefined,
  };
}

export async function fetchLocalSpecs(): Promise<
  WorkerSpecs & { platform?: string }
> {
  const res = await fetchWithTimeout(`${LOCAL_API}/specs`);
  if (!res.ok) throw new Error("Failed to fetch local specs");
  const data = await res.json();
  return {
    cpu: data.cpu,
    cpuCores: data.cpu_cores,
    ram: data.ram,
    gpu: data.gpu ?? undefined,
    platform: data.platform ?? undefined,
  };
}

// ── Hosting ─────────────────────────────────────────────────────────

export async function startHosting(): Promise<{
  status: string;
  worker_id?: string;
  ip?: string;
  port?: number;
}> {
  const res = await fetch(`${LOCAL_API}/hosting/start`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to start hosting");
  return res.json();
}

export async function stopHosting(): Promise<{ status: string }> {
  const res = await fetch(`${LOCAL_API}/hosting/stop`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to stop hosting");
  return res.json();
}

export async function fetchHostingStatus(): Promise<{
  is_hosting: boolean;
  worker_id: string | null;
  port: number | null;
  status: string;
  pending_requests: number;
}> {
  const res = await fetch(`${LOCAL_API}/hosting/status`);
  if (!res.ok) throw new Error("Failed to fetch hosting status");
  return res.json();
}

export async function fetchActiveJob(): Promise<ActiveJob> {
  const res = await fetchWithTimeout(`${LOCAL_API}/hosting/active-job`);
  if (!res.ok) throw new Error("Failed to fetch active job");
  return res.json();
}

export async function fetchHostingRequests(): Promise<HostingRequest[]> {
  const res = await fetch(`${LOCAL_API}/hosting/requests`);
  if (!res.ok) throw new Error("Failed to fetch requests");
  return res.json();
}

export async function approveRequest(
  requestId: string,
): Promise<{ request_id: string; status: string; token: string }> {
  const res = await fetch(
    `${LOCAL_API}/hosting/requests/${requestId}/approve`,
    { method: "POST" },
  );
  if (!res.ok) throw new Error("Failed to approve request");
  return res.json();
}

export async function denyRequest(
  requestId: string,
): Promise<{ request_id: string; status: string }> {
  const res = await fetch(`${LOCAL_API}/hosting/requests/${requestId}/deny`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to deny request");
  return res.json();
}

// ── Jobs (guest-facing, calls remote worker) ────────────────────────

export async function submitJob(
  worker: { host: string; port: number },
  job: {
    code: string;
    filename: string;
    entrypoint: string;
    projectName?: string;
    projectFiles?: ProjectFileUpload[];
    guestName: string;
    timeoutSecs?: number;
  },
): Promise<{ request_id: string; status: string }> {
  const res = await fetch(`${workerApi(worker)}/jobs/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: job.code,
      filename: job.filename,
      entrypoint: job.entrypoint,
      project_name: job.projectName,
      project_files: job.projectFiles ?? [],
      guest_name: job.guestName,
      timeout_secs: job.timeoutSecs ?? 300,
    }),
  });
  if (!res.ok) throw new Error("Failed to submit job");
  return res.json();
}

export async function pollJobStatus(
  worker: { host: string; port: number },
  requestId: string,
): Promise<{
  request_id: string;
  status: "pending" | "accepted" | "denied";
  token?: string;
  ws_url?: string;
}> {
  const res = await fetch(
    `${workerApi(worker)}/jobs/request/${requestId}/status`,
  );
  if (!res.ok) throw new Error("Failed to poll job status");
  return res.json();
}

export function createJobWebSocket(
  worker: { host: string; port: number },
  requestId: string,
  token: string,
): WebSocket {
  const url = `ws://${worker.host}:${worker.port}/jobs/execute/${requestId}?token=${token}`;
  return new WebSocket(url);
}
