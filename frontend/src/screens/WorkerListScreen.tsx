import React from "react";
import { Wifi, RefreshCw, Server, Loader2, Monitor, Cpu, HardDrive, Layers } from "lucide-react";
import { Worker, WorkerSpecs } from "../types";
import { WorkerCard } from "../components/WorkerCard";

function parseRamToGb(ram: string | undefined): number {
  if (!ram) return 0;

  const match = ram.match(/(\d+(?:\.\d+)?)/);
  if (!match) return 0;

  const value = Number(match[1]);
  const normalized = ram.toLowerCase();

  if (normalized.includes("tb")) return value * 1024;
  if (normalized.includes("mb")) return value / 1024;

  return value;
}

interface WorkerListScreenProps {
  workers: Worker[];
  loading: boolean;
  localSpecs: (WorkerSpecs & { platform?: string }) | null;
  onSelectWorker: (worker: Worker) => void;
  onStartHosting: () => void;
  onRefresh: () => void;
}

export const WorkerListScreen: React.FC<WorkerListScreenProps> = ({
  workers,
  loading,
  localSpecs,
  onSelectWorker,
  onStartHosting,
  onRefresh,
}) => {
  const [minCpuCores, setMinCpuCores] = React.useState(0);
  const [minRamGb, setMinRamGb] = React.useState(0);
  const [gpuOnly, setGpuOnly] = React.useState(false);

  const hasActiveFilters = minCpuCores > 0 || minRamGb > 0 || gpuOnly;
  const filteredWorkers = React.useMemo(
    () =>
      workers.filter((worker) => {
        if (!hasActiveFilters) return true;
        if (!worker.specs) return false;

        const cpuCores = worker.specs.cpuCores || 0;
        const ramGb = parseRamToGb(worker.specs.ram);

        if (minCpuCores > 0 && cpuCores < minCpuCores) return false;
        if (minRamGb > 0 && ramGb < minRamGb) return false;
        if (gpuOnly && !worker.specs.gpu) return false;

        return true;
      }),
    [gpuOnly, hasActiveFilters, minCpuCores, minRamGb, workers],
  );

  const availableCount = workers.filter((w) => w.status === "available").length;
  const filteredAvailableCount = filteredWorkers.filter(
    (w) => w.status === "available",
  ).length;

  const clearFilters = () => {
    setMinCpuCores(0);
    setMinRamGb(0);
    setGpuOnly(false);
  };

  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-6 border-b border-app-border">
        <div>
          <h1 className="text-2xl font-bold text-app-text mb-1">
            Discover Workers
          </h1>
          <p className="text-sm text-app-text-secondary">
            Select a computer on your local network to run your job
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onStartHosting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-app-accent hover:bg-app-accent/90 transition-all text-sm text-white font-medium shadow-lg shadow-app-accent/20"
          >
            <Server size={16} />
            <span>Host Computer</span>
          </button>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-app-border bg-app-surface hover:bg-app-surface-elevated transition-all text-sm text-app-text-secondary hover:text-app-text disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex items-center gap-6 px-8 py-4 bg-app-surface/50 border-b border-app-border/50">
        <div className="flex items-center gap-2">
          <Wifi size={16} className="text-app-accent" />
          <span className="text-sm text-app-text-secondary">
            {workers.length} workers found
          </span>
        </div>
        <div className="h-4 w-px bg-app-border" />
        <span className="text-sm text-app-text-secondary">
          {hasActiveFilters ? `${filteredWorkers.length} match filters` : `${availableCount} available`}
        </span>
        <div className="h-4 w-px bg-app-border" />
        <span className="text-sm text-app-text-secondary">
          {hasActiveFilters ? `${filteredAvailableCount} available` : "No filters"}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-8">
        <div className="max-w-7xl space-y-6">
          <div className="rounded-lg border border-app-border bg-app-surface p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-app-text">Filter by specs</h3>
                <p className="text-sm text-app-text-secondary">
                  Narrow the list to computers that fit your job.
                </p>
              </div>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-app-accent hover:text-app-accent-hover transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="space-y-2 text-sm">
                <span className="block text-app-text-secondary">Min CPU cores</span>
                <select
                  value={minCpuCores}
                  onChange={(e) => setMinCpuCores(Number(e.target.value))}
                  className="w-full rounded-lg border border-app-border bg-app-bg px-3 py-2 text-app-text focus:outline-none focus:border-app-accent"
                >
                  <option value={0}>Any</option>
                  <option value={4}>4+</option>
                  <option value={8}>8+</option>
                  <option value={12}>12+</option>
                  <option value={16}>16+</option>
                </select>
              </label>

              <label className="space-y-2 text-sm">
                <span className="block text-app-text-secondary">Min RAM</span>
                <select
                  value={minRamGb}
                  onChange={(e) => setMinRamGb(Number(e.target.value))}
                  className="w-full rounded-lg border border-app-border bg-app-bg px-3 py-2 text-app-text focus:outline-none focus:border-app-accent"
                >
                  <option value={0}>Any</option>
                  <option value={8}>8 GB+</option>
                  <option value={16}>16 GB+</option>
                  <option value={32}>32 GB+</option>
                  <option value={64}>64 GB+</option>
                </select>
              </label>

              <label className="flex items-center gap-3 rounded-lg border border-app-border bg-app-bg px-3 py-2.5 text-sm text-app-text">
                <input
                  type="checkbox"
                  checked={gpuOnly}
                  onChange={(e) => setGpuOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-app-border bg-app-surface text-app-accent focus:ring-app-accent"
                />
                <span>Only show workers with a GPU</span>
              </label>
            </div>
          </div>

          {/* Your Computer Card */}
          {localSpecs && (
            <div>
              <h3 className="text-xs font-semibold text-app-text-secondary uppercase tracking-wide mb-3">
                Your Computer
              </h3>
              <div className="p-4 rounded-lg bg-app-surface border border-app-accent/30 max-w-md">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-app-accent/10 flex items-center justify-center">
                    <Monitor size={16} className="text-app-accent" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-app-text">
                      {window.location.hostname || "This Machine"}
                    </div>
                    {localSpecs.platform && (
                      <div className="text-xs text-app-text-tertiary">{localSpecs.platform}</div>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm">
                    <Cpu size={14} className="text-app-text-tertiary" />
                    <span className="text-app-text-secondary">{localSpecs.cpu}</span>
                    <span className="text-app-text-tertiary ml-auto">{localSpecs.cpuCores} cores</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <HardDrive size={14} className="text-app-text-tertiary" />
                    <span className="text-app-text-secondary">RAM</span>
                    <span className="text-app-text-tertiary ml-auto">{localSpecs.ram}</span>
                  </div>
                  {localSpecs.gpu && (
                    <div className="flex items-center gap-2 text-sm">
                      <Layers size={14} className="text-app-text-tertiary" />
                      <span className="text-app-text-secondary truncate">{localSpecs.gpu}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Other Workers */}
          {loading && workers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 size={32} className="text-app-accent animate-spin" />
              <p className="text-sm text-app-text-secondary">
                Scanning local network...
              </p>
            </div>
          ) : workers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Wifi size={48} className="text-app-text-tertiary" />
              <div className="text-center">
                <p className="text-app-text-secondary mb-1">No other workers found</p>
                <p className="text-sm text-app-text-tertiary">
                  Make sure other computers are running ComputeBnB in host mode
                </p>
              </div>
            </div>
          ) : filteredWorkers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Wifi size={48} className="text-app-text-tertiary" />
              <div className="text-center">
                <p className="text-app-text-secondary mb-1">No workers match these filters</p>
                <p className="text-sm text-app-text-tertiary">
                  Try lowering the CPU or RAM minimum, or turn off GPU only.
                </p>
              </div>
            </div>
          ) : (
            <div>
              <h3 className="text-xs font-semibold text-app-text-secondary uppercase tracking-wide mb-3">
                Available Workers
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredWorkers.map((worker) => (
                  <WorkerCard
                    key={worker.id}
                    worker={worker}
                    onSelect={() => onSelectWorker(worker)}
                    disabled={worker.status !== "available"}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
