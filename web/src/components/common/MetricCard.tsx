import React from 'react';
import { ArrowUpRight, ArrowDownRight, ArrowRight, Minus } from 'lucide-react';
import { Sparkline } from './Sparkline';

interface MetricCardProps {
  title: string;
  value: string | number;
  delta?: number;
  deltaLabel?: string;
  sparklineData?: number[];
  sparklineColor?: string;
  status?: 'healthy' | 'warning' | 'degraded' | 'neutral';
  secondaryInfo?: string;
  onInvestigate?: () => void;
  tooltip?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  delta,
  deltaLabel = 'vs prev period',
  sparklineData,
  sparklineColor = '#6366f1',
  status = 'neutral',
  secondaryInfo,
  onInvestigate,
  tooltip,
}) => {
  const isPositiveDelta = delta !== undefined && delta > 0;
  const isNegativeDelta = delta !== undefined && delta < 0;
  const isZeroDelta = delta !== undefined && delta === 0;

  // Choose delta badge color based on metric context
  let deltaColorClass = 'text-slate-400 bg-slate-800/60';
  let deltaIcon = <Minus className="w-3 h-3" />;

  // Note: For latency/errors, delta > 0 is bad. We can customize if needed.
  const isErrorOrLatency = title.toLowerCase().includes('error') || title.toLowerCase().includes('latency');

  if (isPositiveDelta) {
    deltaIcon = <ArrowUpRight className="w-3.5 h-3.5" />;
    deltaColorClass = isErrorOrLatency
      ? 'text-rose-400 bg-rose-950/40 border border-rose-800/40'
      : 'text-emerald-400 bg-emerald-950/40 border border-emerald-800/40';
  } else if (isNegativeDelta) {
    deltaIcon = <ArrowDownRight className="w-3.5 h-3.5" />;
    deltaColorClass = isErrorOrLatency
      ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-800/40'
      : 'text-slate-400 bg-slate-800/40 border border-slate-700/40';
  }

  let statusBorder = 'border-[#1e2330]';
  if (status === 'warning') statusBorder = 'border-amber-800/50';
  if (status === 'degraded') statusBorder = 'border-rose-800/50';

  return (
    <div
      className={`relative flex flex-col justify-between p-4 rounded-lg bg-[#0d111a] border ${statusBorder} hover:border-[#2d3548] transition-all group`}
      title={tooltip}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 font-mono">
          {title}
        </span>
        {onInvestigate && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onInvestigate();
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 cursor-pointer"
          >
            Investigate <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="flex items-baseline justify-between gap-3 my-1">
        <div className="text-2xl font-bold font-mono tracking-tight text-slate-100">
          {value}
        </div>

        {sparklineData && sparklineData.length > 0 && (
          <div className="shrink-0">
            <Sparkline data={sparklineData} color={sparklineColor} width={75} height={22} />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-800/50 text-[11px] text-slate-400">
        {delta !== undefined ? (
          <div className="flex items-center gap-1.5">
            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${deltaColorClass}`}>
              {deltaIcon}
              {Math.abs(delta)}%
            </span>
            <span className="truncate text-slate-400">{deltaLabel}</span>
          </div>
        ) : (
          <span className="text-slate-400 truncate">{secondaryInfo || 'Telemetry nominal'}</span>
        )}

        {secondaryInfo && delta !== undefined && (
          <span className="text-slate-400 truncate text-right font-mono text-[10px]">{secondaryInfo}</span>
        )}
      </div>
    </div>
  );
};

