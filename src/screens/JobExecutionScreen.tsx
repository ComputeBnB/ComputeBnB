import React from "react";
import { Activity, Clock, Server, Wifi } from "lucide-react";

import { LogViewer } from "../components/LogViewer";
import { StatusBadge } from "../components/StatusBadge";
import type { Host, JobState } from "../types";

interface JobExecutionScreenProps {
  worker: Host;
  jobName: string;
  logs: string[];
  elapsedTime: number;
  state: JobState;
}

export const JobExecutionScreen: React.FC<JobExecutionScreenProps> = ({
  worker,
  jobName,
  logs,
  elapsedTime,
  state,
}) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const displayStatus = state === "done" ? "completed" : state;

  return (
    <div className="flex h-full flex-col animate-fade-in">
      <div className="border-b border-app-border px-8 py-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="mb-1 text-2xl font-bold text-app-text">{jobName}</h1>
            <p className="text-sm text-app-text-secondary">
              Live TCP stream from the remote host. The connection closes automatically after the final
              result.
            </p>
          </div>
          <StatusBadge status={displayStatus} size="lg" />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <div className="rounded-lg border border-app-border bg-app-surface p-4">
            <div className="mb-2 flex items-center gap-2">
              <Server size={16} className="text-app-text-tertiary" />
              <span className="text-xs font-medium uppercase tracking-wide text-app-text-secondary">
                Host
              </span>
            </div>
            <div className="text-base font-semibold text-app-text">{worker.display_name}</div>
            <div className="mt-1 text-xs text-app-text-tertiary">{worker.platform || "Unknown platform"}</div>
          </div>

          <div className="rounded-lg border border-app-border bg-app-surface p-4">
            <div className="mb-2 flex items-center gap-2">
              <Wifi size={16} className="text-app-text-tertiary" />
              <span className="text-xs font-medium uppercase tracking-wide text-app-text-secondary">
                Target
              </span>
            </div>
            <div className="text-base font-semibold text-app-text">{worker.host}</div>
            <div className="mt-1 text-xs text-app-text-tertiary">TCP port {worker.port}</div>
          </div>

          <div className="rounded-lg border border-app-border bg-app-surface p-4">
            <div className="mb-2 flex items-center gap-2">
              <Clock size={16} className="text-app-text-tertiary" />
              <span className="text-xs font-medium uppercase tracking-wide text-app-text-secondary">
                Elapsed
              </span>
            </div>
            <div className="font-mono text-2xl font-bold text-app-text">{formatTime(elapsedTime)}</div>
          </div>

          <div className="rounded-lg border border-app-border bg-app-surface p-4">
            <div className="mb-2 flex items-center gap-2">
              <Activity size={16} className="text-app-text-tertiary" />
              <span className="text-xs font-medium uppercase tracking-wide text-app-text-secondary">
                Feed
              </span>
            </div>
            <div className="text-base font-semibold text-app-text">{logs.length} messages</div>
            <div className="mt-1 text-xs text-app-text-tertiary">Status, stdout, stderr, and metrics</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-8">
        <LogViewer logs={logs} title="Live Host Stream" />
      </div>
    </div>
  );
};
