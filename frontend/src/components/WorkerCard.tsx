import React from 'react';
import { Cpu, HardDrive, Layers, Shield, Clock } from 'lucide-react';
import { Worker } from '../types';
import { StatusBadge } from './StatusBadge';

interface WorkerCardProps {
  worker: Worker;
  onSelect: () => void;
  disabled?: boolean;
}

export const WorkerCard: React.FC<WorkerCardProps> = ({ worker, onSelect, disabled = false }) => {
  const isAvailable = worker.status === 'available' && !disabled;

  return (
    <button
      onClick={onSelect}
      disabled={!isAvailable}
      className={`
        w-full text-left p-4 rounded-lg border transition-all duration-200
        ${
          isAvailable
            ? 'bg-app-surface border-app-border hover:border-app-accent hover:bg-app-surface-elevated cursor-pointer'
            : 'bg-app-surface/50 border-app-border/50 cursor-not-allowed opacity-60'
        }
      `}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-semibold text-app-text">{worker.name}</h3>
            {worker.trusted && (
              <Shield size={14} className="text-app-accent" />
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-app-text-tertiary">
            <Clock size={12} />
            <span>{worker.lastSeen}</span>
          </div>
        </div>
        <StatusBadge status={worker.status} size="sm" />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <Cpu size={14} className="text-app-text-secondary flex-shrink-0" />
          <span className="text-app-text-secondary">{worker.specs.cpu}</span>
          <span className="text-app-text-tertiary ml-auto">{worker.specs.cpuCores} cores</span>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <HardDrive size={14} className="text-app-text-secondary flex-shrink-0" />
          <span className="text-app-text-secondary">RAM</span>
          <span className="text-app-text-tertiary ml-auto">{worker.specs.ram}</span>
        </div>

        {worker.specs.gpu && (
          <div className="flex items-center gap-2 text-sm">
            <Layers size={14} className="text-app-text-secondary flex-shrink-0" />
            <span className="text-app-text-secondary truncate">{worker.specs.gpu}</span>
          </div>
        )}
      </div>
    </button>
  );
};
