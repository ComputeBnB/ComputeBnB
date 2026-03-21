import React, { useState } from 'react';
import { ArrowLeft, Upload, FileCode, FileText, PlayCircle, Cpu, HardDrive, Layers } from 'lucide-react';
import { Worker } from '../types';

interface SubmitJobScreenProps {
  worker: Worker;
  onBack: () => void;
  onSubmit: (jobData: {
    name: string;
    pythonFile: string;
    configFile?: string;
    arguments?: string;
    notes?: string;
  }) => void;
}

export const SubmitJobScreen: React.FC<SubmitJobScreenProps> = ({ worker, onBack, onSubmit }) => {
  const [jobName, setJobName] = useState('');
  const [pythonFile, setPythonFile] = useState('');
  const [configFile, setConfigFile] = useState('');
  const [args, setArgs] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: jobName || 'Untitled Job',
      pythonFile: pythonFile || 'training_pipeline.py',
      configFile: configFile || undefined,
      arguments: args || undefined,
      notes: notes || undefined,
    });
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
            Configure and run your Python job on the selected worker
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

            {/* Python File Upload */}
            <div>
              <label className="block text-sm font-medium text-app-text mb-2">
                Python Script <span className="text-app-error">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={pythonFile}
                  onChange={(e) => setPythonFile(e.target.value)}
                  placeholder="training_pipeline.py"
                  className="w-full px-4 py-2.5 pl-10 rounded-lg bg-app-surface border border-app-border text-app-text placeholder:text-app-text-tertiary focus:outline-none focus:border-app-accent transition-colors"
                />
                <FileCode size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-tertiary" />
              </div>
              <button
                type="button"
                className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-app-text-secondary hover:text-app-text border border-app-border hover:bg-app-surface-elevated transition-all"
              >
                <Upload size={14} />
                <span>Browse files</span>
              </button>
            </div>

            {/* Config File (Optional) */}
            <div>
              <label className="block text-sm font-medium text-app-text mb-2">
                Configuration File <span className="text-app-text-tertiary text-xs">(optional)</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={configFile}
                  onChange={(e) => setConfigFile(e.target.value)}
                  placeholder="config.json, requirements.txt, etc."
                  className="w-full px-4 py-2.5 pl-10 rounded-lg bg-app-surface border border-app-border text-app-text placeholder:text-app-text-tertiary focus:outline-none focus:border-app-accent transition-colors"
                />
                <FileText size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-tertiary" />
              </div>
              <button
                type="button"
                className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-app-text-secondary hover:text-app-text border border-app-border hover:bg-app-surface-elevated transition-all"
              >
                <Upload size={14} />
                <span>Browse files</span>
              </button>
            </div>

            {/* Arguments */}
            <div>
              <label className="block text-sm font-medium text-app-text mb-2">
                Command Line Arguments <span className="text-app-text-tertiary text-xs">(optional)</span>
              </label>
              <input
                type="text"
                value={args}
                onChange={(e) => setArgs(e.target.value)}
                placeholder="--epochs 100 --batch-size 32"
                className="w-full px-4 py-2.5 rounded-lg bg-app-surface border border-app-border text-app-text placeholder:text-app-text-tertiary focus:outline-none focus:border-app-accent transition-colors font-mono text-sm"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-app-text mb-2">
                Notes <span className="text-app-text-tertiary text-xs">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes or comments about this job..."
                rows={3}
                className="w-full px-4 py-2.5 rounded-lg bg-app-surface border border-app-border text-app-text placeholder:text-app-text-tertiary focus:outline-none focus:border-app-accent transition-colors resize-none"
              />
            </div>

            {/* Capability Hint */}
            <div className="p-4 rounded-lg bg-app-accent/5 border border-app-accent/20">
              <h4 className="text-sm font-medium text-app-text mb-2">Estimated Capabilities</h4>
              <div className="text-sm text-app-text-secondary space-y-1">
                <div>• Can handle compute-intensive ML training tasks</div>
                <div>• Recommended for jobs under 2 hours runtime</div>
                <div>• GPU acceleration available for compatible frameworks</div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-4">
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-3 rounded-lg bg-app-accent hover:bg-app-accent-hover text-white font-medium transition-all shadow-lg shadow-app-accent/20 hover:shadow-app-accent/30"
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
