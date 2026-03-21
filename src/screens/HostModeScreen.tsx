import React from "react";
import { Check, Monitor, Server, Wifi, X } from "lucide-react";

import { StatusBadge } from "../components/StatusBadge";
import type { LocalHostState } from "../types";

interface HostModeScreenProps {
  state: LocalHostState;
  onStopHosting: () => void;
  onDecision: (jobId: string, decision: "accept" | "deny") => void;
  errorMessage?: string | null;
}

export const HostModeScreen: React.FC<HostModeScreenProps> = ({
  state,
  onStopHosting,
  onDecision,
  errorMessage,
}) => {
  const hostStatus = state.host?.status ?? "offline";

  return (
    <div className="flex h-full flex-col animate-fade-in">
      <div className="flex items-center justify-between border-b border-app-border px-8 py-6">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-app-text">Host Mode</h1>
          <p className="text-sm text-app-text-secondary">
            This machine advertises itself on the LAN and waits for guest approval requests.
          </p>
        </div>
        <button
          onClick={onStopHosting}
          className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300 transition-all hover:bg-red-500/20"
        >
          <X size={16} />
          <span>Stop Hosting</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-6">
            <div className="rounded-xl border border-app-border bg-app-surface p-6">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-app-text">{state.host?.display_name || "Starting host..."}</h2>
                  <p className="mt-1 text-sm text-app-text-secondary">
                    {state.host ? `${state.host.host}:${state.host.port}` : "Preparing listener"}
                  </p>
                </div>
                <StatusBadge status={hostStatus} size="lg" />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <InfoCard
                  icon={<Wifi size={18} className="text-app-accent" />}
                  label="Discovery"
                  value={state.running ? "Advertising over mDNS" : "Stopped"}
                  subvalue="Service updates broadcast automatically"
                />
                <InfoCard
                  icon={<Server size={18} className="text-app-accent" />}
                  label="Runtime"
                  value={state.host?.runtime || "docker-first"}
                  subvalue={state.host?.platform || "Unknown platform"}
                />
                <InfoCard
                  icon={<Monitor size={18} className="text-app-accent" />}
                  label="Policy"
                  value="One active job"
                  subvalue="Every run needs local approval"
                />
              </div>
            </div>

            <div className="rounded-xl border border-app-border bg-app-surface p-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-app-text">
                Pending Approval
              </h3>
              {state.pending_job ? (
                <div className="space-y-4 rounded-lg border border-app-warning/20 bg-app-warning/5 p-4">
                  <div>
                    <div className="text-lg font-semibold text-app-text">{state.pending_job.job_name}</div>
                    <div className="mt-1 text-sm text-app-text-secondary">
                      From {state.pending_job.guest_name} via {state.pending_job.remote_address}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 text-sm text-app-text-secondary md:grid-cols-3">
                    <div>Filename: {state.pending_job.filename}</div>
                    <div>Timeout: {state.pending_job.timeout_secs}s</div>
                    <div>Received: {new Date(state.pending_job.submitted_at).toLocaleTimeString()}</div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => onDecision(state.pending_job!.job_id, "accept")}
                      className="flex items-center gap-2 rounded-lg bg-app-success px-4 py-2 text-sm font-medium text-white transition-all hover:opacity-90"
                    >
                      <Check size={16} />
                      <span>Accept</span>
                    </button>
                    <button
                      onClick={() => onDecision(state.pending_job!.job_id, "deny")}
                      className="flex items-center gap-2 rounded-lg border border-app-error/30 bg-app-error/10 px-4 py-2 text-sm text-app-error transition-all hover:bg-app-error/20"
                    >
                      <X size={16} />
                      <span>Deny</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-app-border p-5 text-sm text-app-text-secondary">
                  No guest is waiting right now. Leave this screen open to approve the next request.
                </div>
              )}
            </div>

            <div className="rounded-xl border border-app-border bg-app-surface p-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-app-text">
                Recent Activity
              </h3>
              <div className="space-y-3">
                {state.activity.length > 0 ? (
                  state.activity.map((item) => (
                    <div key={`${item.timestamp}-${item.message}`} className="rounded-lg border border-app-border bg-app-surface-elevated p-3">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm text-app-text">{item.message}</span>
                        <span className="text-xs text-app-text-tertiary">
                          {new Date(item.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-app-text-secondary">No host events yet.</p>
                )}
              </div>
              {errorMessage ? (
                <p className="mt-4 text-sm text-app-error">{errorMessage}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border border-app-border bg-app-surface p-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-app-text">
                Current Job
              </h3>
              {state.active_job ? (
                <div className="space-y-3">
                  <div className="text-lg font-semibold text-app-text">{state.active_job.job_name}</div>
                  <div className="text-sm text-app-text-secondary">Guest: {state.active_job.guest_name}</div>
                  <StatusBadge status={state.active_job.state} />
                </div>
              ) : (
                <p className="text-sm text-app-text-secondary">No active job. The host will return here after each TCP session closes.</p>
              )}
            </div>

            <div className="rounded-xl border border-app-border bg-app-surface p-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-app-text">
                Recent Results
              </h3>
              <div className="space-y-3">
                {state.recent_results.length > 0 ? (
                  state.recent_results.map((result) => (
                    <div key={result.job_id} className="rounded-lg border border-app-border bg-app-surface-elevated p-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-app-text">{result.summary}</span>
                        <StatusBadge status={result.state === "done" ? "completed" : result.state} size="sm" />
                      </div>
                      <div className="text-xs text-app-text-tertiary">
                        {result.backend} • {(result.duration_ms / 1000).toFixed(1)}s • {result.artifacts.length} file(s)
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-app-text-secondary">Finished jobs will show up here after the guest returns to the main UI.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface InfoCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subvalue: string;
}

const InfoCard: React.FC<InfoCardProps> = ({ icon, label, value, subvalue }) => (
  <div className="rounded-lg border border-app-border bg-app-surface-elevated p-4">
    <div className="mb-2 flex items-center gap-2">
      {icon}
      <span className="text-xs font-medium uppercase tracking-wide text-app-text-secondary">{label}</span>
    </div>
    <div className="text-base font-semibold text-app-text">{value}</div>
    <div className="mt-1 text-xs text-app-text-tertiary">{subvalue}</div>
  </div>
);
