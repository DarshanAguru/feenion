import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, PlayCircle, HelpCircle } from 'lucide-react';

interface StatusBadgeProps {
  status: 'ok' | 'error' | 'running' | 'warning' | 'healthy' | 'degraded' | string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  label?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showIcon = true,
  label,
}) => {
  const normalized = status.toLowerCase();

  let bg = 'bg-slate-800/80 text-slate-300 border-slate-700';
  let icon = <HelpCircle className="w-3.5 h-3.5" />;
  let text = label || status;

  if (normalized === 'ok' || normalized === 'success' || normalized === 'healthy') {
    bg = 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60';
    icon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
    text = label || (normalized === 'ok' ? 'OK' : 'Healthy');
  } else if (normalized === 'error' || normalized === 'failed' || normalized === 'degraded') {
    bg = 'bg-rose-950/60 text-rose-400 border-rose-800/60';
    icon = <XCircle className="w-3.5 h-3.5 text-rose-400" />;
    text = label || (normalized === 'error' ? 'Error' : 'Degraded');
  } else if (normalized === 'warning') {
    bg = 'bg-amber-950/60 text-amber-400 border-amber-800/60';
    icon = <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
    text = label || 'Warning';
  } else if (normalized === 'running') {
    bg = 'bg-indigo-950/60 text-indigo-400 border-indigo-800/60';
    icon = <PlayCircle className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />;
    text = label || 'Running';
  }

  const sizeClass =
    size === 'sm'
      ? 'px-1.5 py-0.5 text-[11px] gap-1'
      : size === 'lg'
      ? 'px-3 py-1.5 text-sm gap-2 font-medium'
      : 'px-2 py-0.5 text-xs gap-1.5 font-medium';

  return (
    <span
      className={`inline-flex items-center rounded-md border font-mono tracking-tight ${bg} ${sizeClass}`}
    >
      {showIcon && icon}
      <span>{text}</span>
    </span>
  );
};

