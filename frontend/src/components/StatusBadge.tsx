import React from 'react';
import { Circle, CheckCircle2, Clock, XCircle } from 'lucide-react';

interface StatusBadgeProps {
  status: 'available' | 'busy' | 'offline' | 'running' | 'completed' | 'pending' | 'failed';
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base',
  };

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16,
  };

  const config = {
    available: {
      label: 'Available',
      icon: CheckCircle2,
      classes: 'bg-app-success/10 text-app-success border border-app-success/20',
    },
    busy: {
      label: 'Busy',
      icon: Circle,
      classes: 'bg-app-warning/10 text-app-warning border border-app-warning/20',
    },
    offline: {
      label: 'Offline',
      icon: Circle,
      classes: 'bg-app-text-tertiary/10 text-app-text-tertiary border border-app-text-tertiary/20',
    },
    running: {
      label: 'Running',
      icon: Circle,
      classes: 'bg-app-accent/10 text-app-accent border border-app-accent/20 animate-pulse-subtle',
    },
    completed: {
      label: 'Completed',
      icon: CheckCircle2,
      classes: 'bg-app-success/10 text-app-success border border-app-success/20',
    },
    pending: {
      label: 'Pending',
      icon: Clock,
      classes: 'bg-app-text-secondary/10 text-app-text-secondary border border-app-text-secondary/20',
    },
    failed: {
      label: 'Failed',
      icon: XCircle,
      classes: 'bg-app-error/10 text-app-error border border-app-error/20',
    },
  };

  const { label, icon: Icon, classes } = config[status];

  return (
    <div className={`inline-flex items-center gap-1.5 rounded-md font-medium ${sizeClasses[size]} ${classes}`}>
      <Icon size={iconSizes[size]} />
      <span>{label}</span>
    </div>
  );
};
