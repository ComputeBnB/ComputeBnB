import React from "react";
import { Wifi, RefreshCw, Server, Loader2 } from "lucide-react";
import { Worker } from "../types";
import { WorkerCard } from "../components/WorkerCard";

interface WorkerListScreenProps {
  workers: Worker[];
  loading: boolean;
  onSelectWorker: (worker: Worker) => void;
  onStartHosting: () => void;
  onRefresh: () => void;
}

export const WorkerListScreen: React.FC<WorkerListScreenProps> = ({
  workers,
  loading,
  onSelectWorker,
  onStartHosting,
  onRefresh,
}) => {
  const availableCount = workers.filter((w) => w.status === "available").length;

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
          {availableCount} available
        </span>
      </div>

      {/* Worker Grid */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-8">
        {loading && workers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Loader2 size={32} className="text-app-accent animate-spin" />
            <p className="text-sm text-app-text-secondary">
              Scanning local network...
            </p>
          </div>
        ) : workers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Wifi size={48} className="text-app-text-tertiary" />
            <div className="text-center">
              <p className="text-app-text-secondary mb-1">No workers found</p>
              <p className="text-sm text-app-text-tertiary">
                Make sure other computers are running ComputeBnB in host mode
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 max-w-7xl">
            {workers.map((worker) => (
              <WorkerCard
                key={worker.id}
                worker={worker}
                onSelect={() => onSelectWorker(worker)}
                disabled={worker.status !== "available"}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
