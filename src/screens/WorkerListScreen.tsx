import React from 'react';
import { Wifi, RefreshCw } from 'lucide-react';
import { Worker } from '../types';
import { WorkerCard } from '../components/WorkerCard';

interface WorkerListScreenProps {
  workers: Worker[];
  onSelectWorker: (worker: Worker) => void;
}

export const WorkerListScreen: React.FC<WorkerListScreenProps> = ({ workers, onSelectWorker }) => {
  const availableCount = workers.filter(w => w.status === 'available').length;

  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-6 border-b border-app-border">
        <div>
          <h1 className="text-2xl font-bold text-app-text mb-1">Discover Workers</h1>
          <p className="text-sm text-app-text-secondary">
            Select a computer on your local network to run your job
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-app-border bg-app-surface hover:bg-app-surface-elevated transition-all text-sm text-app-text-secondary hover:text-app-text">
          <RefreshCw size={16} />
          <span>Refresh</span>
        </button>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 max-w-7xl">
          {workers.map((worker) => (
            <WorkerCard
              key={worker.id}
              worker={worker}
              onSelect={() => onSelectWorker(worker)}
              disabled={worker.status !== 'available'}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
