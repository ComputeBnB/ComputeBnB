import React, { useEffect, useRef } from 'react';
import { Terminal } from 'lucide-react';

interface LogViewerProps {
  logs: string[];
  title?: string;
}

export const LogViewer: React.FC<LogViewerProps> = ({ logs, title = 'Execution Log' }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="flex flex-col h-full bg-app-surface border border-app-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-app-border bg-app-surface-elevated">
        <Terminal size={16} className="text-app-text-secondary" />
        <span className="text-sm font-medium text-app-text-secondary">{title}</span>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-app-success animate-pulse" />
            <span className="text-xs text-app-text-tertiary">Live</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 font-mono text-xs leading-relaxed">
        {logs.length === 0 ? (
          <div className="text-app-text-tertiary">Waiting for output...</div>
        ) : (
          <div className="space-y-1">
            {logs.map((log, index) => (
              <div
                key={index}
                className="whitespace-pre-wrap text-app-text-secondary transition-colors hover:text-app-text animate-fade-in"
              >
                {log}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  );
};
