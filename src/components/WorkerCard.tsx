import React from "react";
import { Clock, Globe, Server } from "lucide-react";

import type { Host } from "../types";
import { StatusBadge } from "./StatusBadge";

interface WorkerCardProps {
  worker: Host;
  onSelect: () => void;
  disabled?: boolean;
}

export const WorkerCard: React.FC<WorkerCardProps> = ({ worker, onSelect, disabled = false }) => {
  const selectable = !disabled && worker.status === "idle";

  return (
    <button
      onClick={onSelect}
      disabled={!selectable}
      className={`w-full rounded-lg border p-4 text-left transition-all duration-200 ${
        selectable
          ? "cursor-pointer border-app-border bg-app-surface hover:border-app-accent hover:bg-app-surface-elevated"
          : "cursor-not-allowed border-app-border/50 bg-app-surface/50 opacity-70"
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <h3 className="truncate text-base font-semibold text-app-text">{worker.display_name}</h3>
          </div>
          <div className="flex items-center gap-2 text-xs text-app-text-tertiary">
            <Clock size={12} />
            <span>{worker.last_seen}</span>
          </div>
        </div>
        <StatusBadge status={worker.status} size="sm" />
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-app-text-secondary">
          <Globe size={14} className="flex-shrink-0" />
          <span className="truncate">
            {worker.host}:{worker.port}
          </span>
        </div>

        <div className="flex items-center gap-2 text-app-text-secondary">
          <Server size={14} className="flex-shrink-0" />
          <span className="truncate">{worker.platform || "Unknown platform"}</span>
        </div>

        <div className="text-xs text-app-text-tertiary">
          Runtime: <span className="text-app-text-secondary">{worker.runtime}</span>
        </div>
      </div>
    </button>
  );
};
