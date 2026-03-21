import React, { useState } from "react";
import { ArrowLeft, FileCode2, PlayCircle, Server, TimerReset } from "lucide-react";

import type { Host } from "../types";

interface SubmitJobPayload {
  name: string;
  code: string;
  filename: string;
  timeoutSecs: number;
}

interface SubmitJobScreenProps {
  worker: Host;
  onBack: () => void;
  onSubmit: (jobData: SubmitJobPayload) => void;
}

const SAMPLE_CODE = [
  "import json",
  "from pathlib import Path",
  "",
  "print('ComputeBnB job started')",
  "numbers = [1, 2, 3, 4]",
  "result = {'sum': sum(numbers), 'count': len(numbers)}",
  "Path('result.json').write_text(json.dumps(result, indent=2), encoding='utf-8')",
  "print('Saved result.json')",
].join("\n");

export const SubmitJobScreen: React.FC<SubmitJobScreenProps> = ({ worker, onBack, onSubmit }) => {
  const [jobName, setJobName] = useState("Quick Python Job");
  const [filename, setFilename] = useState("main.py");
  const [timeoutSecs, setTimeoutSecs] = useState("120");
  const [code, setCode] = useState(SAMPLE_CODE);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit({
      name: jobName || "Untitled Job",
      code,
      filename: filename || "main.py",
      timeoutSecs: Number(timeoutSecs) || 120,
    });
  };

  return (
    <div className="flex h-full flex-col animate-fade-in">
      <div className="flex items-center gap-4 border-b border-app-border px-8 py-6">
        <button
          onClick={onBack}
          className="rounded-lg border border-transparent p-2 transition-all hover:border-app-border hover:bg-app-surface-elevated"
        >
          <ArrowLeft size={20} className="text-app-text-secondary" />
        </button>
        <div>
          <h1 className="mb-1 text-2xl font-bold text-app-text">Submit Python Job</h1>
          <p className="text-sm text-app-text-secondary">
            Single-file Python only for this MVP. The host must approve before execution starts.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="h-fit rounded-xl border border-app-border bg-app-surface p-5">
            <div className="mb-4 flex items-center gap-2">
              <Server size={18} className="text-app-accent" />
              <h2 className="text-base font-semibold text-app-text">Selected Host</h2>
            </div>
            <div className="space-y-2 text-sm text-app-text-secondary">
              <div className="text-lg font-semibold text-app-text">{worker.display_name}</div>
              <div>
                {worker.host}:{worker.port}
              </div>
              <div>{worker.platform || "Unknown platform"}</div>
              <div>Runtime: {worker.runtime}</div>
            </div>

            <div className="mt-5 rounded-lg border border-app-accent/20 bg-app-accent/5 p-4 text-sm text-app-text-secondary">
              Docker is the preferred runtime. If it is not available on the host, the job falls back to
              trusted-demo subprocess mode.
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-app-border bg-app-surface p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-app-text">Job Name</label>
                <input
                  type="text"
                  value={jobName}
                  onChange={(event) => setJobName(event.target.value)}
                  className="w-full rounded-lg border border-app-border bg-app-surface-elevated px-4 py-2.5 text-app-text focus:border-app-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-app-text">Filename</label>
                <input
                  type="text"
                  value={filename}
                  onChange={(event) => setFilename(event.target.value)}
                  className="w-full rounded-lg border border-app-border bg-app-surface-elevated px-4 py-2.5 text-app-text focus:border-app-accent focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-app-text">Timeout (seconds)</label>
              <div className="relative">
                <TimerReset size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-tertiary" />
                <input
                  type="number"
                  min={1}
                  max={3600}
                  value={timeoutSecs}
                  onChange={(event) => setTimeoutSecs(event.target.value)}
                  className="w-full rounded-lg border border-app-border bg-app-surface-elevated py-2.5 pl-10 pr-4 text-app-text focus:border-app-accent focus:outline-none"
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-sm font-medium text-app-text">Python Code</label>
                <button
                  type="button"
                  onClick={() => setCode(SAMPLE_CODE)}
                  className="text-xs text-app-accent transition-colors hover:text-app-accent-hover"
                >
                  Load sample
                </button>
              </div>
              <div className="relative">
                <FileCode2 size={18} className="absolute left-3 top-3 text-app-text-tertiary" />
                <textarea
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  rows={18}
                  spellCheck={false}
                  className="w-full resize-none rounded-lg border border-app-border bg-app-surface-elevated py-3 pl-10 pr-4 font-mono text-sm text-app-text focus:border-app-accent focus:outline-none"
                />
              </div>
            </div>

            <div className="rounded-lg border border-app-border bg-app-surface-elevated p-4 text-sm text-app-text-secondary">
              The host receives a newline-delimited JSON run request, asks the local user to approve it,
              then streams stdout, stderr, and final results back over the same TCP connection.
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="flex items-center gap-2 rounded-lg bg-app-accent px-6 py-3 font-medium text-white shadow-lg shadow-app-accent/20 transition-all hover:bg-app-accent-hover"
              >
                <PlayCircle size={20} />
                <span>Request Execution</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
