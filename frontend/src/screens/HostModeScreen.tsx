import React, { useRef, useEffect } from 'react';
import { Server, Wifi, Monitor, X, Check, XCircle, Code, Clock, User, Play } from 'lucide-react';
import { HostingRequest, ActiveJob } from '../types';

interface HostModeScreenProps {
  onStopHosting: () => void;
  requests: HostingRequest[];
  onApprove: (requestId: string) => void;
  onDeny: (requestId: string) => void;
  hostIp: string | null;
  activeJob: ActiveJob | null;
}

export const HostModeScreen: React.FC<HostModeScreenProps> = ({
  onStopHosting,
  requests,
  onApprove,
  onDeny,
  hostIp,
  activeJob,
}) => {
  const logEndRef = useRef<HTMLDivElement>(null);

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeJob?.logs?.length]);

  const isJobRunning = activeJob?.active && activeJob.state !== 'done';

  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-6 border-b border-app-border">
        <div>
          <h1 className="text-2xl font-bold text-app-text mb-1">Host Mode</h1>
          <p className="text-sm text-app-text-secondary">
            Your computer is available for others to run jobs
          </p>
        </div>
        <button
          onClick={onStopHosting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition-all text-sm text-red-400 hover:text-red-300"
        >
          <X size={16} />
          <span>Stop Hosting</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Status Card */}
          <div className="bg-app-surface border border-app-border rounded-xl p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-app-accent to-blue-600 flex items-center justify-center">
                  <Server size={28} className="text-white" />
                </div>
                <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-3 border-app-surface flex items-center justify-center ${
                  isJobRunning ? 'bg-yellow-500 animate-pulse' : 'bg-green-500 animate-pulse'
                }`}>
                  <div className="w-2.5 h-2.5 bg-white rounded-full" />
                </div>
              </div>
              <div>
                <h2 className="text-lg font-bold text-app-text">
                  {isJobRunning ? 'Running Job' : 'Hosting Active'}
                </h2>
                <p className="text-sm text-app-text-secondary">
                  {isJobRunning
                    ? `Executing Docker job from ${activeJob?.guest_name}`
                    : 'Discoverable on the local network'}
                </p>
              </div>
            </div>

            {/* Connection Info */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-app-surface-elevated rounded-lg border border-app-border">
                <Wifi size={18} className="text-app-accent" />
                <div className="flex-1">
                  <div className="text-xs text-app-text-tertiary">Network Status</div>
                  <div className="text-sm font-medium text-app-text">Connected & Discoverable</div>
                </div>
                <div className="px-2 py-1 rounded bg-green-500/10 border border-green-500/30">
                  <span className="text-xs text-green-400 font-medium">Active</span>
                </div>
              </div>

              {hostIp && (
                <div className="flex items-center gap-3 p-3 bg-app-surface-elevated rounded-lg border border-app-border">
                  <Monitor size={18} className="text-app-accent" />
                  <div className="flex-1">
                    <div className="text-xs text-app-text-tertiary">Your IP Address</div>
                    <div className="text-sm font-medium text-app-text font-mono">{hostIp}:8000</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Active Job Execution */}
          {activeJob?.active && (
            <div className="bg-app-surface border border-app-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-app-text uppercase tracking-wide flex items-center gap-2">
                  <Play size={14} className="text-yellow-400" />
                  Active Job
                  {isJobRunning && (
                    <span className="px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 text-xs font-medium">
                      Running
                    </span>
                  )}
                  {activeJob.state === 'done' && (
                    <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 text-xs font-medium">
                      Done
                    </span>
                  )}
                </h3>
              </div>

              {/* Job Info */}
              <div className="flex items-center gap-4 mb-4 text-xs text-app-text-secondary">
                <div className="flex items-center gap-1">
                  <User size={12} />
                  <span>{activeJob.guest_name}</span>
                </div>
                <span className="text-app-text-tertiary">{activeJob.guest_ip}</span>
                {activeJob.runtime && (
                  <span className="px-2 py-0.5 rounded-full bg-app-accent/10 text-app-accent border border-app-accent/20 uppercase tracking-wide">
                    {activeJob.runtime}
                  </span>
                )}
                {activeJob.started_at && (
                  <div className="flex items-center gap-1">
                    <Clock size={12} />
                    <span>{formatTime(activeJob.started_at)}</span>
                  </div>
                )}
              </div>

              {activeJob.status_detail && (
                <div className="mb-4 p-3 bg-app-bg rounded-md border border-app-border/50 text-xs text-app-text-secondary">
                  {activeJob.status_detail}
                </div>
              )}

              {/* Code being executed */}
              {activeJob.code && (
                <div className="mb-4 p-3 bg-app-bg rounded-md border border-app-border/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Code size={12} className="text-app-text-tertiary" />
                    <span className="text-xs text-app-text-tertiary font-medium">
                      {activeJob.entrypoint || activeJob.filename || 'main.py'}
                    </span>
                    {activeJob.project_name && (
                      <span className="text-xs text-app-text-tertiary">
                        · {activeJob.project_name}
                      </span>
                    )}
                    {activeJob.has_requirements_txt && (
                      <span className="text-xs text-emerald-400">
                        · requirements.txt detected
                      </span>
                    )}
                  </div>
                  <pre className="text-xs text-app-text-secondary font-mono whitespace-pre-wrap break-all leading-relaxed max-h-32 overflow-y-auto">
                    {activeJob.code}
                  </pre>
                </div>
              )}

              {/* Live Output */}
              {activeJob.logs && activeJob.logs.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-app-text-secondary uppercase tracking-wide">
                      Output
                    </span>
                    {isJobRunning && (
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                        <span className="text-xs text-green-400">Live</span>
                      </div>
                    )}
                  </div>
                  <div className="bg-app-bg rounded-md border border-app-border/50 p-3 max-h-64 overflow-y-auto font-mono text-xs">
                    {activeJob.logs.map((log, i) => (
                      <div
                        key={i}
                        className={
                          log.type === 'stderr'
                            ? 'text-red-400'
                            : 'text-app-text-secondary'
                        }
                      >
                        {log.type === 'status' ? <span className="text-yellow-300">{log.data}</span> : log.data}
                      </div>
                    ))}
                    <div ref={logEndRef} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Pending Requests */}
          <div className="bg-app-surface border border-app-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-app-text uppercase tracking-wide">
                Incoming Requests
                {requests.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 rounded-full bg-app-accent/10 text-app-accent text-xs font-medium">
                    {requests.length}
                  </span>
                )}
              </h3>
            </div>

            {requests.length === 0 ? (
              <div className="text-center py-12">
                <Server size={32} className="mx-auto text-app-text-tertiary mb-3" />
                <p className="text-sm text-app-text-tertiary">No pending requests</p>
                <p className="text-xs text-app-text-tertiary mt-1">
                  Requests from other computers will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map((req) => (
                  <div
                    key={req.request_id}
                    className="p-4 bg-app-surface-elevated rounded-lg border border-app-border"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-app-accent/10 flex items-center justify-center">
                          <User size={16} className="text-app-accent" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-app-text">
                            {req.guest_name}
                          </div>
                          <div className="text-xs text-app-text-tertiary">
                            {req.guest_ip}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-app-text-tertiary">
                        <Clock size={12} />
                        <span>{formatTime(req.created_at)}</span>
                      </div>
                    </div>

                    {/* Code Preview */}
                    <div className="mb-3 p-3 bg-app-bg rounded-md border border-app-border/50">
                      <div className="flex items-center gap-2 mb-2">
                        <Code size={12} className="text-app-text-tertiary" />
                        <span className="text-xs text-app-text-tertiary font-medium">
                          {req.project_name || req.entrypoint || req.filename}
                        </span>
                        {req.file_count && req.file_count > 1 && (
                          <span className="text-xs text-app-text-tertiary">
                            · {req.file_count} files
                          </span>
                        )}
                        {req.has_requirements_txt && (
                          <span className="text-xs text-emerald-400">
                            · requirements.txt included
                          </span>
                        )}
                        <span className="text-xs text-app-text-tertiary">
                          · timeout {req.timeout_secs}s
                        </span>
                      </div>
                      <pre className="text-xs text-app-text-secondary font-mono whitespace-pre-wrap break-all leading-relaxed">
                        {req.code_preview}
                      </pre>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => onDeny(req.request_id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-all"
                      >
                        <XCircle size={14} />
                        Deny
                      </button>
                      <button
                        onClick={() => onApprove(req.request_id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-green-500/10 border border-green-500/30 hover:bg-green-500/20 text-green-400 hover:text-green-300 transition-all"
                      >
                        <Check size={14} />
                        Approve
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info Box */}
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <span className="text-blue-400 text-sm">i</span>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-app-text mb-1">While Hosting</h3>
                <ul className="text-xs text-app-text-secondary space-y-1">
                  <li>· You cannot use guest mode to run jobs on other computers</li>
                  <li>· Review each request before approving — check the code preview</li>
                  <li>· Click "Stop Hosting" anytime to return to guest mode</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
