import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Server,
  Clock,
  ArrowLeft,
  Terminal,
  FileOutput,
  Download,
  DollarSign,
  Loader2,
} from 'lucide-react';
import { Worker, JobResult, ProjectFileUpload } from '../types';
import { LogViewer } from '../components/LogViewer';

type TauriDialogModule = typeof import('@tauri-apps/api/dialog');
type TauriFsModule = typeof import('@tauri-apps/api/fs');

let tauriDialog: TauriDialogModule | null = null;
let tauriFs: TauriFsModule | null = null;

try {
  import('@tauri-apps/api/dialog').then((module) => {
    tauriDialog = module;
  });
  import('@tauri-apps/api/fs').then((module) => {
    tauriFs = module;
  });
} catch {
  // Not running in Tauri.
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function previewText(file: ProjectFileUpload): string | null {
  if (file.size_bytes > 32 * 1024) return null;

  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(base64ToBytes(file.content_b64));
    const trimmed = text.trim();
    if (!trimmed) return '(empty file)';
    return trimmed.length > 320 ? `${trimmed.slice(0, 320)}...` : trimmed;
  } catch {
    return null;
  }
}

function joinPath(basePath: string, relativePath: string): string {
  const normalizedBase = basePath.replace(/[\\/]+$/, '');
  const normalizedRelative = relativePath.replace(/\\/g, '/');
  return `${normalizedBase}/${normalizedRelative}`;
}

function parentDirectory(relativePath: string): string | null {
  const normalized = relativePath.replace(/\\/g, '/');
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length <= 1) return null;
  return segments.slice(0, -1).join('/');
}

interface JobCompleteScreenProps {
  worker: Worker;
  jobName: string;
  result: JobResult | null;
  isPaying: boolean;
  onPay: () => void;
  onReturn: () => void;
}

export const JobCompleteScreen: React.FC<JobCompleteScreenProps> = ({
  worker,
  jobName,
  result,
  isPaying,
  onPay,
  onReturn,
}) => {
  const isSuccess = result?.exitCode === 0;
  const [isSavingFiles, setIsSavingFiles] = useState(false);
  const generatedFiles = result?.generatedFiles ?? [];

  const filePreviews = useMemo(
    () =>
      generatedFiles.map((file) => ({
        file,
        preview: previewText(file),
      })),
    [generatedFiles],
  );

  const formatRuntime = (seconds: number) => {
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${mins}m ${secs}s`;
  };

  const formatUsd = (amount: number) => `$${amount.toFixed(2)}`;

  const handleSaveFiles = async () => {
    if (!generatedFiles.length) return;

    if (!tauriDialog || !tauriFs) {
      alert('Saving returned files is only available in the desktop app.');
      return;
    }

    try {
      setIsSavingFiles(true);
      const selected = await tauriDialog.open({
        directory: true,
        multiple: false,
        recursive: true,
        title: 'Choose where to save returned files',
      });

      if (!selected || typeof selected !== 'string') return;

      for (const file of generatedFiles) {
        const parent = parentDirectory(file.path);
        if (parent) {
          await tauriFs.createDir(joinPath(selected, parent), { recursive: true });
        }
        await tauriFs.writeBinaryFile(joinPath(selected, file.path), base64ToBytes(file.content_b64));
      }

      alert(`Saved ${generatedFiles.length} file(s) to ${selected}`);
    } catch (error) {
      console.error('Failed to save returned files:', error);
      alert('Failed to save returned files.');
    } finally {
      setIsSavingFiles(false);
    }
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
          <div className={`grid gap-4 ${result?.chargeEnabled ? 'grid-cols-4' : 'grid-cols-3'}`}>
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

            {result?.chargeEnabled && (
              <div className="p-4 rounded-lg bg-app-surface border border-emerald-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign size={16} className="text-emerald-400" />
                  <span className="text-xs font-medium text-app-text-secondary uppercase tracking-wide">
                    Amount To Pay
                  </span>
                </div>
                <div className="text-2xl font-bold text-app-text font-mono">
                  {formatUsd(result.balanceDueUsd)}
                </div>
                <div className="text-xs text-app-text-tertiary mt-1">
                  {result.paid
                    ? `Paid · total compute ${formatUsd(result.totalChargeUsd)}`
                    : `${formatUsd(result.chargeRateUsdPerHour)}/hr host rate · $0.25 minimum`}
                </div>
              </div>
            )}
          </div>

          {result?.chargeEnabled && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-app-text uppercase tracking-wide">
                    Demo Payment
                  </h3>
                  <p className="mt-1 text-sm text-app-text-secondary">
                    {result.paid
                      ? `Payment sent to the host. Amount due is now ${formatUsd(result.balanceDueUsd)}.`
                      : `You should pay ${formatUsd(result.balanceDueUsd)} for this run. This is a fake payment flow for the demo only.`}
                  </p>
                  {!result.paid && (
                    <p className="mt-1 text-xs text-app-text-tertiary">
                      Rate: {formatUsd(result.chargeRateUsdPerHour)}/hr with a $0.25 minimum demo charge.
                    </p>
                  )}
                </div>
                {!result.paid ? (
                  <button
                    onClick={onPay}
                    disabled={isPaying}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isPaying ? <Loader2 size={16} className="animate-spin" /> : <DollarSign size={16} />}
                    <span>{isPaying ? 'Sending payment...' : `Pay ${formatUsd(result.balanceDueUsd)}`}</span>
                  </button>
                ) : (
                  <div className="rounded-lg border border-green-500/20 bg-green-500/10 px-4 py-2 text-sm font-medium text-green-400">
                    Payment received
                  </div>
                )}
              </div>
            </div>
          )}

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

          {generatedFiles.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 rounded-xl border border-app-border bg-app-surface p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-app-text uppercase tracking-wide">
                    Returned Files
                  </h3>
                  <p className="mt-1 text-sm text-app-text-secondary">
                    The host sent back {generatedFiles.length} generated file(s) from the Docker workspace.
                  </p>
                </div>
                <button
                  onClick={handleSaveFiles}
                  disabled={isSavingFiles}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-app-border px-4 py-2 text-sm font-medium text-app-text transition-all hover:bg-app-surface-elevated disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download size={16} />
                  <span>{isSavingFiles ? 'Saving...' : 'Save returned files'}</span>
                </button>
              </div>

              <div className="space-y-3">
                {filePreviews.map(({ file, preview }) => (
                  <div key={file.path} className="rounded-xl border border-app-border bg-app-surface p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-app-text">
                          <FileOutput size={16} className="shrink-0 text-app-text-tertiary" />
                          <span className="truncate font-mono text-sm">{file.path}</span>
                        </div>
                        <div className="mt-1 text-xs text-app-text-tertiary">
                          {formatBytes(file.size_bytes)}
                        </div>
                      </div>
                    </div>
                    {preview && (
                      <pre className="mt-3 overflow-x-auto rounded-lg border border-app-border/70 bg-app-bg px-3 py-2 text-xs leading-relaxed text-app-text-secondary whitespace-pre-wrap break-words">
                        {preview}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
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
