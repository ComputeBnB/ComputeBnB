import React from 'react';
import { File, Download } from 'lucide-react';

interface ResultFile {
  name: string;
  size: string;
  type: string;
}

interface ResultCardProps {
  file: ResultFile;
}

export const ResultCard: React.FC<ResultCardProps> = ({ file }) => {
  const getTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'model':
        return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
      case 'metrics':
        return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      case 'visualization':
        return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'results':
        return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      default:
        return 'text-app-text-secondary bg-app-text-secondary/10 border-app-text-secondary/20';
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-app-surface border border-app-border hover:border-app-border-light transition-all group">
      <div className="p-2 rounded-md bg-app-surface-elevated border border-app-border">
        <File size={20} className="text-app-text-secondary" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-app-text truncate">{file.name}</div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-app-text-tertiary">{file.size}</span>
          <span className="text-xs text-app-text-tertiary">•</span>
          <span className={`text-xs px-1.5 py-0.5 rounded border ${getTypeColor(file.type)}`}>
            {file.type}
          </span>
        </div>
      </div>

      <button className="p-2 rounded-md hover:bg-app-surface-elevated border border-transparent hover:border-app-border transition-all opacity-0 group-hover:opacity-100">
        <Download size={16} className="text-app-text-secondary" />
      </button>
    </div>
  );
};
