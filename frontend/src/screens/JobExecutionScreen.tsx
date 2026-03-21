import React from 'react';
import { Server, Clock, Loader2, XCircle, ArrowLeft } from 'lucide-react';
import { Worker, JobStatus } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { LogViewer } from '../components/LogViewer';

interface JobExecutionScreenProps {
  worker: Worker;
  jobName: string;
  logs: string[];
  elapsedTime: number;
  jobStatus: JobStatus;
  phase: string;
  phaseDetail: string | null;
  onReturn: () => void;
}

export const JobExecutionScreen: React.FC<JobExecutionScreenProps> = ({
  worker,
  jobName,
  logs,
  elapsedTime,
  jobStatus,
  phase,
  phaseDetail,
  onReturn,
}) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Waiting for host approval
  if (jobStatus === 'pending') {
    return (
      <div className="h-full flex flex-col animate-fade-in">
        <div className="flex items-center gap-4 px-8 py-6 border-b border-app-border">
          <button
            onClick={onReturn}
            className="p-2 rounded-lg hover:bg-app-surface-elevated border border-transparent hover:border-app-border transition-all"
          >
            <ArrowLeft size={20} className="text-app-text-secondary" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-app-text mb-1">{jobName}</h1>
            <p className="text-sm text-app-text-secondary">Waiting for host approval</p>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 size={48} className="text-app-accent animate-spin mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-app-text mb-2">Awaiting Approval</h2>
            <p className="text-sm text-app-text-secondary max-w-md">
              Your job request has been sent to <span className="font-medium">{worker.name}</span>.
              The host needs to approve it before execution begins.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const formatPhaseLabel = (value: string) =>
    value
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

  const badgeStatus =
    jobStatus === 'done'
      ? 'completed'
      : jobStatus === 'error' || jobStatus === 'timeout'
        ? 'failed'
        : jobStatus === 'approved'
          ? 'pending'
          : 'running';

  // Host denied the request
  if (jobStatus === 'denied') {
    return (
      <div className="h-full flex flex-col animate-fade-in">
        <div className="px-8 py-6 border-b border-app-border">
          <h1 className="text-2xl font-bold text-app-text mb-1">{jobName}</h1>
          <p className="text-sm text-app-text-secondary">Job request denied</p>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <XCircle size={48} className="text-red-400 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-app-text mb-2">Request Denied</h2>
            <p className="text-sm text-app-text-secondary max-w-md mb-6">
              The host at <span className="font-medium">{worker.name}</span> denied your job request.
            </p>
            <button
              onClick={onReturn}
              className="flex items-center gap-2 px-6 py-3 rounded-lg bg-app-accent hover:bg-app-accent-hover text-white font-medium transition-all mx-auto"
            >
              <ArrowLeft size={20} />
              <span>Return to Worker List</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Running / approved — show logs
  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* Header */}
      <div className="px-8 py-6 border-b border-app-border">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-app-text mb-1">{jobName}</h1>
            <p className="text-sm text-app-text-secondary">Running inside Docker on {worker.name}</p>
          </div>
          <StatusBadge status={badgeStatus} size="lg" />
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
              {worker.host}:{worker.port}
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
              <Loader2 size={16} className="text-app-text-tertiary" />
              <span className="text-xs font-medium text-app-text-secondary uppercase tracking-wide">
                Phase
              </span>
            </div>
            <div className="text-base font-semibold text-app-text">
              {formatPhaseLabel(phase)}
            </div>
            {phaseDetail && (
              <div className="text-xs text-app-text-tertiary mt-1">{phaseDetail}</div>
            )}
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
