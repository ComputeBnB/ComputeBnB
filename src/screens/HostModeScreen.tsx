import React from 'react';
import { Server, Wifi, Monitor, X } from 'lucide-react';

interface HostModeScreenProps {
  onStopHosting: () => void;
}

export const HostModeScreen: React.FC<HostModeScreenProps> = ({ onStopHosting }) => {
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
      <div className="flex-1 overflow-y-auto flex items-center justify-center p-8">
        <div className="max-w-2xl w-full">
          <div className="bg-app-surface border border-app-border rounded-xl p-8">
            {/* Status Indicator */}
            <div className="flex flex-col items-center text-center mb-8">
              <div className="relative mb-6">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-app-accent to-blue-600 flex items-center justify-center">
                  <Server size={40} className="text-white" />
                </div>
                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 rounded-full border-4 border-app-surface flex items-center justify-center animate-pulse">
                  <div className="w-3 h-3 bg-white rounded-full" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-app-text mb-2">Waiting for Connection</h2>
              <p className="text-sm text-app-text-secondary max-w-md">
                Your computer is now discoverable on the local network. Other users can connect and submit jobs to run on your machine.
              </p>
            </div>

            {/* Connection Info */}
            <div className="space-y-4 mb-6">
              <div className="flex items-center gap-3 p-4 bg-app-surface-elevated rounded-lg border border-app-border">
                <Wifi size={20} className="text-app-accent" />
                <div className="flex-1">
                  <div className="text-xs text-app-text-tertiary mb-1">Network Status</div>
                  <div className="text-sm font-medium text-app-text">Connected & Discoverable</div>
                </div>
                <div className="px-2 py-1 rounded bg-green-500/10 border border-green-500/30">
                  <span className="text-xs text-green-400 font-medium">Active</span>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-app-surface-elevated rounded-lg border border-app-border">
                <Monitor size={20} className="text-app-accent" />
                <div className="flex-1">
                  <div className="text-xs text-app-text-tertiary mb-1">Your Computer</div>
                  <div className="text-sm font-medium text-app-text">{getComputerName()}</div>
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <span className="text-blue-400 text-sm">ℹ</span>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-app-text mb-1">While Hosting</h3>
                  <ul className="text-xs text-app-text-secondary space-y-1">
                    <li>• You cannot use guest mode to run jobs on other computers</li>
                    <li>• Your computer resources will be available to trusted users</li>
                    <li>• Click "Stop Hosting" anytime to return to guest mode</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Activity Log (placeholder for future) */}
          <div className="mt-6 bg-app-surface border border-app-border rounded-xl p-6">
            <h3 className="text-sm font-semibold text-app-text mb-3">Recent Activity</h3>
            <div className="text-center py-8">
              <p className="text-sm text-app-text-tertiary">No connections yet</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function getComputerName(): string {
  return window.navigator.platform || 'Unknown Computer';
}
