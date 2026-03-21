import React, { useState } from "react";
import { Globe, RefreshCw, Server, Wifi } from "lucide-react";

import { WorkerCard } from "../components/WorkerCard";
import type { Host, ManualHostInput } from "../types";

interface WorkerListScreenProps {
  workers: Host[];
  onSelectWorker: (worker: Host) => void;
  onStartHosting: () => void;
  onRefresh: () => void;
  errorMessage?: string | null;
  onManualConnect: (host: ManualHostInput) => void;
}

export const WorkerListScreen: React.FC<WorkerListScreenProps> = ({
  workers,
  onSelectWorker,
  onStartHosting,
  onRefresh,
  errorMessage,
  onManualConnect,
}) => {
  const [manualName, setManualName] = useState("Manual Host");
  const [manualHost, setManualHost] = useState("");
  const [manualPort, setManualPort] = useState("9000");

  const availableCount = workers.filter((worker) => worker.status === "idle").length;

  const handleManualSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const port = Number(manualPort);
    if (!manualHost || Number.isNaN(port)) {
      return;
    }
    onManualConnect({
      display_name: manualName || "Manual Host",
      host: manualHost,
      port,
    });
  };

  return (
    <div className="flex h-full flex-col animate-fade-in">
      <div className="flex items-center justify-between border-b border-app-border px-8 py-6">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-app-text">Discover Hosts</h1>
          <p className="text-sm text-app-text-secondary">
            Pick a host on your LAN, or enter an IP manually if discovery is blocked.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onStartHosting}
            className="flex items-center gap-2 rounded-lg bg-app-accent px-4 py-2 text-sm font-medium text-white shadow-lg shadow-app-accent/20 transition-all hover:bg-app-accent/90"
          >
            <Server size={16} />
            <span>Host This Computer</span>
          </button>
          <button
            onClick={onRefresh}
            className="flex items-center gap-2 rounded-lg border border-app-border bg-app-surface px-4 py-2 text-sm text-app-text-secondary transition-all hover:bg-app-surface-elevated hover:text-app-text"
          >
            <RefreshCw size={16} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-6 border-b border-app-border/50 bg-app-surface/50 px-8 py-4">
        <div className="flex items-center gap-2">
          <Wifi size={16} className="text-app-accent" />
          <span className="text-sm text-app-text-secondary">{workers.length} hosts found</span>
        </div>
        <div className="h-4 w-px bg-app-border" />
        <span className="text-sm text-app-text-secondary">{availableCount} idle</span>
        {errorMessage ? <span className="text-sm text-app-error">{errorMessage}</span> : null}
      </div>

      <div className="grid flex-1 grid-cols-1 gap-6 overflow-y-auto p-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <div className="grid max-w-6xl grid-cols-1 gap-4 lg:grid-cols-2">
            {workers.map((worker) => (
              <WorkerCard
                key={worker.host_id}
                worker={worker}
                onSelect={() => onSelectWorker(worker)}
                disabled={worker.status !== "idle"}
              />
            ))}
          </div>
          {workers.length === 0 ? (
            <div className="mt-6 rounded-lg border border-dashed border-app-border p-6 text-sm text-app-text-secondary">
              No hosts are visible yet. Start host mode on another machine or use the manual IP form.
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-app-border bg-app-surface p-5">
          <div className="mb-4 flex items-center gap-2">
            <Globe size={18} className="text-app-accent" />
            <h2 className="text-base font-semibold text-app-text">Manual Connect</h2>
          </div>
          <p className="mb-4 text-sm text-app-text-secondary">
            Use this when mDNS does not show the host, but you know its IP and TCP port.
          </p>

          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-app-text">Label</label>
              <input
                value={manualName}
                onChange={(event) => setManualName(event.target.value)}
                className="w-full rounded-lg border border-app-border bg-app-surface-elevated px-4 py-2.5 text-app-text focus:border-app-accent focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-app-text">Host IP</label>
              <input
                value={manualHost}
                onChange={(event) => setManualHost(event.target.value)}
                placeholder="192.168.1.42"
                className="w-full rounded-lg border border-app-border bg-app-surface-elevated px-4 py-2.5 text-app-text focus:border-app-accent focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-app-text">TCP Port</label>
              <input
                value={manualPort}
                onChange={(event) => setManualPort(event.target.value)}
                placeholder="9000"
                className="w-full rounded-lg border border-app-border bg-app-surface-elevated px-4 py-2.5 text-app-text focus:border-app-accent focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-app-accent px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-app-accent-hover"
            >
              Continue to Job Setup
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
