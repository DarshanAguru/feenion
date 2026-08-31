import React from 'react';
import { formatDuration } from '../../utils/formatters';

interface BreakdownBarProps {
  llmMs: number;
  llmPct: number;
  retrievalMs: number;
  retrievalPct: number;
  toolsMs: number;
  toolsPct: number;
  otherMs: number;
  otherPct: number;
}

export const BreakdownBar: React.FC<BreakdownBarProps> = ({
  llmMs,
  llmPct,
  retrievalMs,
  retrievalPct,
  toolsMs,
  toolsPct,
  otherMs,
  otherPct,
}) => {
  const totalMs = llmMs + retrievalMs + toolsMs + otherMs;

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-center justify-between text-xs text-slate-300">
        <span className="font-mono text-slate-400 font-medium">Request Time Breakdown</span>
        <span className="font-mono text-slate-200 font-bold">{formatDuration(totalMs)} Total</span>
      </div>

      {/* Stacked Visual Bar */}
      <div className="w-full h-3 rounded-full bg-slate-800 flex overflow-hidden">
        {llmPct > 0 && (
          <div
            style={{ width: `${llmPct}%` }}
            className="bg-purple-600 hover:bg-purple-500 transition-all cursor-pointer"
            title={`LLM: ${formatDuration(llmMs)} (${llmPct}%)`}
          />
        )}
        {retrievalPct > 0 && (
          <div
            style={{ width: `${retrievalPct}%` }}
            className="bg-amber-500 hover:bg-amber-400 transition-all cursor-pointer"
            title={`Retrieval: ${formatDuration(retrievalMs)} (${retrievalPct}%)`}
          />
        )}
        {toolsPct > 0 && (
          <div
            style={{ width: `${toolsPct}%` }}
            className="bg-cyan-500 hover:bg-cyan-400 transition-all cursor-pointer"
            title={`Tools: ${formatDuration(toolsMs)} (${toolsPct}%)`}
          />
        )}
        {otherPct > 0 && (
          <div
            style={{ width: `${otherPct}%` }}
            className="bg-slate-600 hover:bg-slate-500 transition-all cursor-pointer"
            title={`Other: ${formatDuration(otherMs)} (${otherPct}%)`}
          />
        )}
      </div>

      {/* Legend & Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
          <span className="text-slate-400">LLM:</span>
          <span className="font-mono text-slate-200 font-medium">{formatDuration(llmMs)} ({llmPct}%)</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
          <span className="text-slate-400">Retrieval:</span>
          <span className="font-mono text-slate-200 font-medium">{formatDuration(retrievalMs)} ({retrievalPct}%)</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="w-2 h-2 rounded-full bg-cyan-500 shrink-0" />
          <span className="text-slate-400">Tools:</span>
          <span className="font-mono text-slate-200 font-medium">{formatDuration(toolsMs)} ({toolsPct}%)</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="w-2 h-2 rounded-full bg-slate-500 shrink-0" />
          <span className="text-slate-400">Other:</span>
          <span className="font-mono text-slate-200 font-medium">{formatDuration(otherMs)} ({otherPct}%)</span>
        </div>
      </div>
    </div>
  );
};

