import React from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, Clock3, Server } from "lucide-react";

import { LogViewer } from "../components/LogViewer";
import { ResultCard } from "../components/ResultCard";
import { StatusBadge } from "../components/StatusBadge";
import type { Host, JobResult } from "../types";

interface JobCompleteScreenProps {
  worker: Host;
  jobName: string;
  result: JobResult;
  logs: string[];
  onReturn: () => void;
}

export const JobCompleteScreen: React.FC<JobCompleteScreenProps> = ({
  worker,
  jobName,
  result,
  logs,
  onReturn,
}) => {
  const isSuccess = result.state === "done";
  const isTimeout = result.state === "timeout";
  const Icon = isSuccess ? CheckCircle2 : isTimeout ? Clock3 : AlertCircle;
  const title = isSuccess ? "Job Finished" : isTimeout ? "Job Timed Out" : "Job Ended With Errors";

  return (
    <div className="flex h-full flex-col animate-fade-in">
      <div className="border-b border-app-border px-8 py-6">
        <div className="mb-6 flex items-center justify-center">
          <div
            className={`rounded-full border-2 p-4 ${
              isSuccess
                ? "border-app-success/30 bg-app-success/10"
                : isTimeout
                  ? "border-app-warning/30 bg-app-warning/10"
                  : "border-app-error/30 bg-app-error/10"
            }`}
          >
            <Icon
              size={44}
              className={isSuccess ? "text-app-success" : isTimeout ? "text-app-warning" : "text-app-error"}
            />
          </div>
        </div>
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-bold text-app-text">{title}</h1>
          <p className="text-sm text-app-text-secondary">{jobName}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-app-border bg-app-surface p-4">
              <div className="mb-2 flex items-center gap-2">
                <Server size={16} className="text-app-text-tertiary" />
                <span className="text-xs font-medium uppercase tracking-wide text-app-text-secondary">
                  Host
                </span>
              </div>
              <div className="text-base font-semibold text-app-text">{worker.display_name}</div>
              <div className="mt-1 text-xs text-app-text-tertiary">{worker.host}:{worker.port}</div>
            </div>

            <div className="rounded-lg border border-app-border bg-app-surface p-4">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-app-text-secondary">
                Final State
              </div>
              <StatusBadge status={result.state === "done" ? "completed" : result.state} />
            </div>

            <div className="rounded-lg border border-app-border bg-app-surface p-4">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-app-text-secondary">
                Runtime Backend
              </div>
              <div className="text-base font-semibold text-app-text">{result.backend}</div>
              <div className="mt-1 text-xs text-app-text-tertiary">
                {(result.duration_ms / 1000).toFixed(1)} seconds
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-app-border bg-app-surface p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-app-text">Result Summary</h3>
            <p className="text-sm leading-relaxed text-app-text-secondary">{result.summary}</p>
            {result.error ? (
              <p className="mt-3 rounded-md border border-app-error/20 bg-app-error/5 p-3 text-sm text-app-error">
                {result.error}
              </p>
            ) : null}
          </div>

          <div className="rounded-lg border border-app-border bg-app-surface p-5">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-app-text">
              Output Files ({result.artifacts.length})
            </h3>
            <div className="space-y-2">
              {result.artifacts.length > 0 ? (
                result.artifacts.map((file) => <ResultCard key={`${file.path}-${file.name}`} file={file} />)
              ) : (
                <p className="text-sm text-app-text-secondary">No output files were produced by this run.</p>
              )}
            </div>
          </div>

          <div className="h-[320px]">
            <LogViewer logs={logs} title="Final Output Stream" />
          </div>

          <div className="flex justify-center pt-2">
            <button
              onClick={onReturn}
              className="flex items-center gap-2 rounded-lg bg-app-accent px-6 py-3 font-medium text-white shadow-lg shadow-app-accent/20 transition-all hover:bg-app-accent-hover"
            >
              <ArrowLeft size={20} />
              <span>Back to Hosts</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
