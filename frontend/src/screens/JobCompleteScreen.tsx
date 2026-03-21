import React from 'react';
import { CheckCircle2, XCircle, Server, Clock, ArrowLeft, Terminal } from 'lucide-react';
import { Worker, JobResult } from '../types';
import { LogViewer } from '../components/LogViewer';

interface JobCompleteScreenProps {
  worker: Worker;
  jobName: string;
  result: JobResult | null;
  onReturn: () => void;
}

export const JobCompleteScreen: React.FC<JobCompleteScreenProps> = ({
  worker,
  jobName,
  result,
  onReturn,
}) => {
  const isSuccess = result?.exitCode === 0;

  const formatRuntime = (seconds: number) => {
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* Header */}
      <div className="px-8 py-6 border-b border-app-border">
        <div className="flex items-center justify-center mb-6">
          <div className={`p-4 rounded-full border-2 ${
            isSuccess
              ? 'bg-app-success/10 border-app-success/30'
              : 'bg-red-500/10 border-red-500/30'
          }`}>
            {isSuccess ? (
              <CheckCircle2 size={48} className="text-app-success" />
            ) : (
              <XCircle size={48} className="text-red-400" />
            )}
          </div>
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-app-text mb-2">
            {isSuccess ? 'Job Completed Successfully' : 'Job Failed'}
          </h1>
          <p className="text-sm text-app-text-secondary">{jobName}</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-app-surface border border-app-border">
              <div className="flex items-center gap-2 mb-2">
                <Server size={16} className="text-app-text-tertiary" />
                <span className="text-xs font-medium text-app-text-secondary uppercase tracking-wide">
                  Executed On
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
                  Total Runtime
                </span>
              </div>
              <div className="text-2xl font-bold text-app-text font-mono">
                {result ? formatRuntime(result.runtime) : '--'}
              </div>
            </div>

            <div className="p-4 rounded-lg bg-app-surface border border-app-border">
              <div className="flex items-center gap-2 mb-2">
                <Terminal size={16} className="text-app-text-tertiary" />
                <span className="text-xs font-medium text-app-text-secondary uppercase tracking-wide">
                  Exit Code
                </span>
              </div>
              <div className={`text-2xl font-bold font-mono ${
                isSuccess ? 'text-app-success' : 'text-red-400'
              }`}>
                {result?.exitCode ?? '--'}
              </div>
            </div>
          </div>

          {/* Output */}
          {result?.output && (
            <div>
              <h3 className="text-sm font-semibold text-app-text uppercase tracking-wide mb-3">
                Output
              </h3>
              <LogViewer
                logs={result.output.split('\n').filter((l) => l)}
                title="Program Output"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-center pt-6">
            <button
              onClick={onReturn}
              className="flex items-center gap-2 px-6 py-3 rounded-lg bg-app-accent hover:bg-app-accent-hover text-white font-medium transition-all shadow-lg shadow-app-accent/20 hover:shadow-app-accent/30"
            >
              <ArrowLeft size={20} />
              <span>Return to Worker List</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
