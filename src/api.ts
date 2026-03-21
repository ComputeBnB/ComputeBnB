import type { Host, LocalHostState } from "./types";

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export function fetchHosts(): Promise<Host[]> {
  return requestJson<Host[]>("/api/hosts");
}

export function fetchLocalHostState(): Promise<LocalHostState> {
  return requestJson<LocalHostState>("/api/local-host");
}

export function startLocalHost(displayName?: string): Promise<LocalHostState> {
  return requestJson<LocalHostState>("/api/local-host/start", {
    method: "POST",
    body: JSON.stringify({ display_name: displayName || null }),
  });
}

export function stopLocalHost(): Promise<LocalHostState> {
  return requestJson<LocalHostState>("/api/local-host/stop", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function decidePendingJob(
  jobId: string,
  decision: "accept" | "deny",
): Promise<LocalHostState> {
  return requestJson<LocalHostState>(`/api/local-host/decisions/${jobId}`, {
    method: "POST",
    body: JSON.stringify({ decision }),
  });
}

export function createJobSocket(hostId: string): WebSocket {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return new WebSocket(
    `${protocol}//${window.location.host}/api/jobs/ws/${encodeURIComponent(hostId)}`,
  );
}
