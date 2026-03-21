import React from "react";
import { File } from "lucide-react";

import type { Artifact } from "../types";

interface ResultCardProps {
  file: Artifact;
}

export const ResultCard: React.FC<ResultCardProps> = ({ file }) => {
  const getTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case "model":
        return "text-cyan-300 bg-cyan-300/10 border-cyan-300/20";
      case "metrics":
        return "text-blue-300 bg-blue-300/10 border-blue-300/20";
      case "visualization":
        return "text-emerald-300 bg-emerald-300/10 border-emerald-300/20";
      case "results":
        return "text-amber-300 bg-amber-300/10 border-amber-300/20";
      default:
        return "text-app-text-secondary bg-app-text-secondary/10 border-app-text-secondary/20";
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-lg bg-app-surface p-3 transition-all hover:border-app-border-light border border-app-border">
      <div className="rounded-md border border-app-border bg-app-surface-elevated p-2">
        <File size={20} className="text-app-text-secondary" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-app-text">{file.name}</div>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="text-xs text-app-text-tertiary">{file.size_label}</span>
          <span className="text-xs text-app-text-tertiary">•</span>
          <span className="text-xs text-app-text-tertiary">{file.path}</span>
        </div>
      </div>

      <span className={`rounded border px-1.5 py-0.5 text-xs ${getTypeColor(file.kind)}`}>
        {file.kind}
      </span>
    </div>
  );
};
