import React, { useState } from 'react';
import { ArrowLeft, Upload, PlayCircle, Cpu, HardDrive, Layers, Clock, Globe } from 'lucide-react';
import { Worker } from '../types';

// Tauri APIs — only available when running as a Tauri app
let tauriDialog: typeof import('@tauri-apps/api/dialog') | null = null;
let tauriFs: typeof import('@tauri-apps/api/fs') | null = null;

try {
  import('@tauri-apps/api/dialog').then((m) => { tauriDialog = m; });
  import('@tauri-apps/api/fs').then((m) => { tauriFs = m; });
} catch {
  // Not in Tauri — file browse won't be available
}

interface SubmitJobScreenProps {
  worker: Worker;
  onBack: () => void;
  onSubmit: (jobData: {
    name: string;
    code: string;
    timeoutSecs: number;
  }) => void;
}

export const SubmitJobScreen: React.FC<SubmitJobScreenProps> = ({ worker, onBack, onSubmit }) => {
  const [jobName, setJobName] = useState('');
  const [code, setCode] = useState('');
  const [timeoutSecs, setTimeoutSecs] = useState(300);
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    onSubmit({
      name: jobName || 'Untitled Job',
      code,
      timeoutSecs,
    });
  };

  const handleBrowseFile = async () => {
    if (!tauriDialog || !tauriFs) {
      alert('File browsing is only available in the desktop app.');
      return;
    }

    try {
      const selected = await tauriDialog.open({
        multiple: false,
        filters: [{ name: 'Python', extensions: ['py'] }],
      });

      if (selected && typeof selected === 'string') {
        const contents = await tauriFs.readTextFile(selected);
        setCode(contents);
        const fileName = selected.split('/').pop() || selected.split('\\').pop() || selected;
        setLoadedFileName(fileName);
      }
    } catch (err) {
      console.error('File browse error:', err);
    }
  };

  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 px-8 py-6 border-b border-app-border">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-app-surface-elevated border border-transparent hover:border-app-border transition-all"
        >
          <ArrowLeft size={20} className="text-app-text-secondary" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-app-text mb-1">Submit Job</h1>
          <p className="text-sm text-app-text-secondary">
            Send Python code to execute on the selected worker
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Selected Worker Summary */}
          <div className="p-4 rounded-lg bg-app-surface border border-app-border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-app-text-secondary uppercase tracking-wide">
                Selected Worker
              </h3>
              <button
                onClick={onBack}
                className="text-xs text-app-accent hover:text-app-accent-hover transition-colors"
              >
                Change
              </button>
            </div>
            <div className="space-y-2">
              <div className="text-base font-semibold text-app-text">{worker.name}</div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                {worker.specs ? (
                  <>
                    <div className="flex items-center gap-2">
                      <Cpu size={14} className="text-app-text-tertiary" />
                      <span className="text-app-text-secondary">{worker.specs.cpuCores} cores</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <HardDrive size={14} className="text-app-text-tertiary" />
                      <span className="text-app-text-secondary">{worker.specs.ram}</span>
                    </div>
                    {worker.specs.gpu && (
                      <div className="flex items-center gap-2">
                        <Layers size={14} className="text-app-text-tertiary" />
                        <span className="text-app-text-secondary">GPU</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <Globe size={14} className="text-app-text-tertiary" />
                    <span className="text-app-text-secondary">{worker.host}:{worker.port}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Job Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Job Name */}
            <div>
              <label className="block text-sm font-medium text-app-text mb-2">
                Job Name
              </label>
              <input
                type="text"
                value={jobName}
                onChange={(e) => setJobName(e.target.value)}
                placeholder="e.g., ML Model Training"
                className="w-full px-4 py-2.5 rounded-lg bg-app-surface border border-app-border text-app-text placeholder:text-app-text-tertiary focus:outline-none focus:border-app-accent transition-colors"
              />
            </div>

            {/* Python Code */}
            <div>
              <label className="block text-sm font-medium text-app-text mb-2">
                Python Code <span className="text-app-error">*</span>
              </label>
              <textarea
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setLoadedFileName(null);
                }}
                placeholder={'# Write your Python code here\nprint("Hello from ComputeBnB!")'}
                rows={12}
                className="w-full px-4 py-3 rounded-lg bg-app-surface border border-app-border text-app-text placeholder:text-app-text-tertiary focus:outline-none focus:border-app-accent transition-colors font-mono text-sm leading-relaxed resize-none"
              />
              <div className="flex items-center gap-3 mt-2">
                <button
                  type="button"
                  onClick={handleBrowseFile}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-app-text-secondary hover:text-app-text border border-app-border hover:bg-app-surface-elevated transition-all"
                >
                  <Upload size={14} />
                  <span>Load from file</span>
                </button>
                {loadedFileName && (
                  <span className="text-xs text-app-text-tertiary">
                    Loaded: {loadedFileName}
                  </span>
                )}
              </div>
            </div>

            {/* Timeout */}
            <div>
              <label className="block text-sm font-medium text-app-text mb-2">
                Timeout
              </label>
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-xs">
                  <input
                    type="number"
                    value={timeoutSecs}
                    onChange={(e) => setTimeoutSecs(Math.max(10, parseInt(e.target.value) || 300))}
                    min={10}
                    max={3600}
                    className="w-full px-4 py-2.5 pl-10 rounded-lg bg-app-surface border border-app-border text-app-text focus:outline-none focus:border-app-accent transition-colors"
                  />
                  <Clock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-tertiary" />
                </div>
                <span className="text-sm text-app-text-secondary">seconds</span>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={!code.trim()}
                className="flex items-center gap-2 px-6 py-3 rounded-lg bg-app-accent hover:bg-app-accent-hover text-white font-medium transition-all shadow-lg shadow-app-accent/20 hover:shadow-app-accent/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PlayCircle size={20} />
                <span>Run Job</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
