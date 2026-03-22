import React from "react";
import {
  Wifi,
  RefreshCw,
  Server,
  Loader2,
  Monitor,
  Cpu,
  HardDrive,
  Layers,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Worker, WorkerSpecs } from "../types";
import { WorkerCard } from "../components/WorkerCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Checkbox } from "../components/ui/checkbox";
import { Label } from "../components/ui/label";

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
          {hasActiveFilters
            ? `${filteredWorkers.length} match filters`
            : `${availableCount} available`}
        </span>
        <div className="h-4 w-px bg-app-border" />
        <span className="text-sm text-app-text-secondary">
          {hasActiveFilters
            ? `${filteredAvailableCount} available`
            : "No filters"}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-8">
        <div className="mx-auto w-full max-w-7xl space-y-6">
          <div className="rounded-xl border border-app-border bg-app-surface p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-app-accent/10">
                  <SlidersHorizontal size={15} className="text-app-accent" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-app-text">
                    Filters
                  </h3>
                  <p className="text-xs text-app-text-tertiary">
                    Narrow down by hardware specs
                  </p>
                </div>
              </div>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-app-text-secondary hover:text-app-text bg-app-surface-elevated hover:bg-app-border/50 border border-app-border transition-colors"
                >
                  <X size={12} />
                  Clear
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Cpu size={12} className="text-app-text-tertiary" />
                  Min CPU Cores
                </Label>
                <Select
                  value={String(minCpuCores)}
                  onValueChange={(v) => setMinCpuCores(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Any</SelectItem>
                    <SelectItem value="4">4+ cores</SelectItem>
                    <SelectItem value="8">8+ cores</SelectItem>
                    <SelectItem value="12">12+ cores</SelectItem>
                    <SelectItem value="16">16+ cores</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <HardDrive size={12} className="text-app-text-tertiary" />
                  Min RAM
                </Label>
                <Select
                  value={String(minRamGb)}
                  onValueChange={(v) => setMinRamGb(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Any</SelectItem>
                    <SelectItem value="8">8 GB+</SelectItem>
                    <SelectItem value="16">16 GB+</SelectItem>
                    <SelectItem value="32">32 GB+</SelectItem>
                    <SelectItem value="64">64 GB+</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Layers size={12} className="text-app-text-tertiary" />
                  GPU
                </Label>
                <div
                  className="flex items-center gap-3 h-9 rounded-lg border border-app-border bg-app-bg px-3 cursor-pointer"
                  onClick={() => setGpuOnly(!gpuOnly)}
                >
                  <Checkbox
                    id="gpu-filter"
                    checked={gpuOnly}
                    onCheckedChange={(checked) => setGpuOnly(checked === true)}
                  />
                  <Label
                    htmlFor="gpu-filter"
                    className="text-sm text-app-text cursor-pointer select-none"
                  >
                    GPU required
                  </Label>
                </div>
              </div>
            </div>

            {hasActiveFilters && (
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                {minCpuCores > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-app-accent/10 border border-app-accent/20 text-xs text-app-accent">
                    <Cpu size={10} />
                    {minCpuCores}+ cores
                    <button
                      onClick={() => setMinCpuCores(0)}
                      className="ml-0.5 hover:text-white transition-colors"
                    >
                      <X size={10} />
                    </button>
                  </span>
                )}
                {minRamGb > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-app-accent/10 border border-app-accent/20 text-xs text-app-accent">
                    <HardDrive size={10} />
                    {minRamGb} GB+
                    <button
                      onClick={() => setMinRamGb(0)}
                      className="ml-0.5 hover:text-white transition-colors"
                    >
                      <X size={10} />
                    </button>
                  </span>
                )}
                {gpuOnly && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-app-accent/10 border border-app-accent/20 text-xs text-app-accent">
                    <Layers size={10} />
                    GPU required
                    <button
                      onClick={() => setGpuOnly(false)}
                      className="ml-0.5 hover:text-white transition-colors"
                    >
                      <X size={10} />
                    </button>
                  </span>
                )}
                <span className="text-xs text-app-text-tertiary ml-1">
                  {filteredWorkers.length} of {workers.length} workers
                </span>
              </div>
            )}
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
                      <div className="text-xs text-app-text-tertiary">
                        {localSpecs.platform}
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm">
                    <Cpu size={14} className="text-app-text-tertiary" />
                    <span className="text-app-text-secondary">
                      {localSpecs.cpu}
                    </span>
                    <span className="text-app-text-tertiary ml-auto">
                      {localSpecs.cpuCores} cores
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <HardDrive size={14} className="text-app-text-tertiary" />
                    <span className="text-app-text-secondary">RAM</span>
                    <span className="text-app-text-tertiary ml-auto">
                      {localSpecs.ram}
                    </span>
                  </div>
                  {localSpecs.gpu && (
                    <div className="flex items-center gap-2 text-sm">
                      <Layers size={14} className="text-app-text-tertiary" />
                      <span className="text-app-text-secondary truncate">
                        {localSpecs.gpu}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Other Workers */}
          {loading && workers.length === 0 ? (
            <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 py-16">
              <Loader2 size={32} className="text-app-accent animate-spin" />
              <p className="text-sm text-app-text-secondary">
                Scanning local network...
              </p>
            </div>
          ) : workers.length === 0 ? (
            <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 py-16">
              <Wifi size={48} className="text-app-text-tertiary" />
              <div className="text-center">
                <p className="text-app-text-secondary mb-1">
                  No other workers found
                </p>
                <p className="text-sm text-app-text-tertiary">
                  Make sure other computers are running ComputeBnB in host mode
                </p>
              </div>
            </div>
          ) : filteredWorkers.length === 0 ? (
            <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 py-16">
              <Wifi size={48} className="text-app-text-tertiary" />
              <div className="text-center">
                <p className="text-app-text-secondary mb-1">
                  No workers match these filters
                </p>
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
