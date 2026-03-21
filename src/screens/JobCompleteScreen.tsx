import React from 'react';
import { CheckCircle2, Server, Clock, ArrowLeft, Download } from 'lucide-react';
import { Worker, JobResult } from '../types';
import { ResultCard } from '../components/ResultCard';

interface JobCompleteScreenProps {
  worker: Worker;
  jobName: string;
  result: JobResult;
  onReturn: () => void;
}

export const JobCompleteScreen: React.FC<JobCompleteScreenProps> = ({
  worker,
  jobName,
  result,
  onReturn,
}) => {
  const formatRuntime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* Header */}
      <div className="px-8 py-6 border-b border-app-border">
        <div className="flex items-center justify-center mb-6">
          <div className="p-4 rounded-full bg-app-success/10 border-2 border-app-success/30">
            <CheckCircle2 size={48} className="text-app-success" />
          </div>
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-app-text mb-2">Job Completed Successfully</h1>
          <p className="text-sm text-app-text-secondary">{jobName}</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-app-surface border border-app-border">
              <div className="flex items-center gap-2 mb-2">
                <Server size={16} className="text-app-text-tertiary" />
                <span className="text-xs font-medium text-app-text-secondary uppercase tracking-wide">
                  Executed On
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
                  Total Runtime
                </span>
              </div>
              <div className="text-2xl font-bold text-app-text font-mono">
                {formatRuntime(result.runtime)}
              </div>
            </div>
          </div>

          {/* Result Summary */}
          <div className="p-5 rounded-lg bg-gradient-to-br from-app-success/5 to-app-success/10 border border-app-success/20">
            <h3 className="text-sm font-semibold text-app-text mb-3 uppercase tracking-wide">
              Result Summary
            </h3>
            <p className="text-sm text-app-text-secondary leading-relaxed">
              {result.summary}
            </p>
          </div>

          {/* Output Files */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-app-text uppercase tracking-wide">
                Output Files ({result.outputFiles.length})
              </h3>
              <button className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-app-text-secondary hover:text-app-text border border-app-border hover:bg-app-surface-elevated transition-all">
                <Download size={14} />
                <span>Download All</span>
              </button>
            </div>
            <div className="space-y-2">
              {result.outputFiles.map((file, index) => (
                <ResultCard key={index} file={file} />
              ))}
            </div>
          </div>

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
