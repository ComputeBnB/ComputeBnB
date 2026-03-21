import React from 'react';
import { Server, Clock, Activity } from 'lucide-react';
import { Worker } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { LogViewer } from '../components/LogViewer';

interface JobExecutionScreenProps {
  worker: Worker;
  jobName: string;
  logs: string[];
  elapsedTime: number;
}

export const JobExecutionScreen: React.FC<JobExecutionScreenProps> = ({
  worker,
  jobName,
  logs,
  elapsedTime,
}) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* Header */}
      <div className="px-8 py-6 border-b border-app-border">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-app-text mb-1">{jobName}</h1>
            <p className="text-sm text-app-text-secondary">Executing on remote worker</p>
          </div>
          <StatusBadge status="running" size="lg" />
        </div>

        {/* Job Info Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-app-surface border border-app-border">
            <div className="flex items-center gap-2 mb-2">
              <Server size={16} className="text-app-text-tertiary" />
              <span className="text-xs font-medium text-app-text-secondary uppercase tracking-wide">
                Worker
              </span>
            </div>
            <div className="text-base font-semibold text-app-text">{worker.name}</div>
            <div className="text-xs text-app-text-tertiary mt-1">
              {worker.specs.cpu} • {worker.specs.cpuCores} cores
            </div>
          </div>

          <div className="p-4 rounded-lg bg-app-surface border border-app-border">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={16} className="text-app-text-tertiary" />
              <span className="text-xs font-medium text-app-text-secondary uppercase tracking-wide">
                Elapsed Time
              </span>
            </div>
            <div className="text-2xl font-bold text-app-text font-mono">
              {formatTime(elapsedTime)}
            </div>
          </div>

          <div className="p-4 rounded-lg bg-app-surface border border-app-border">
            <div className="flex items-center gap-2 mb-2">
              <Activity size={16} className="text-app-text-tertiary" />
              <span className="text-xs font-medium text-app-text-secondary uppercase tracking-wide">
                Progress
              </span>
            </div>
            <div className="text-base font-semibold text-app-text">
              {logs.length} / ~25 steps
            </div>
            <div className="mt-2 h-1 bg-app-surface-elevated rounded-full overflow-hidden">
              <div
                className="h-full bg-app-accent transition-all duration-500"
                style={{ width: `${Math.min((logs.length / 25) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Log Viewer */}
      <div className="flex-1 overflow-hidden p-8">
        <LogViewer logs={logs} />
      </div>
    </div>
  );
};
