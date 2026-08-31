import React, { useEffect, useState, useMemo } from 'react';
import { TraceDetail, TraceSummary, SpanPayload } from '../../types';
import { apiClient } from '../../api/client';
import { formatDuration, formatCost, formatNumber, formatTimestamp } from '../../utils/formatters';
import { StatusBadge } from '../common/StatusBadge';
import {
  X,
  ArrowRight,
  GitCompare,
  Sparkles,
  Coins,
  Clock,
  Layers,
  Bot,
  Search,
  Wrench,
  Activity,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

interface TraceComparisonModalProps {
  traceAId: string;
  traceBId?: string;
  onClose: () => void;
}

interface ComputedTraceMetrics {
  duration: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  spanCount: number;
  errorCount: number;
}

const extractMetrics = (trace: TraceDetail | null): ComputedTraceMetrics => {
  if (!trace) {
    return {
      duration: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      cost: 0,
      spanCount: 0,
      errorCount: 0,
    };
  }

  let promptTokens = trace.tokens?.prompt || 0;
  let completionTokens = trace.tokens?.completion || 0;
  let totalTokens = trace.tokens?.total || (promptTokens + completionTokens);
  let cost = trace.estimated_cost || 0;
  const duration = trace.duration_ms || 0;

  // Fallback and deep aggregation from spans if top-level summary metrics are zero
  if (trace.spans && trace.spans.length > 0) {
    let spanPrompt = 0;
    let spanComp = 0;
    let spanTotal = 0;
    let spanCost = 0;

    for (const s of trace.spans) {
      const m = s.metrics || {};
      const attr = s.attributes || {};
      const tok = m.tokens || attr.tokens || {};
      const p = tok.prompt ?? attr.prompt_tokens ?? 0;
      const c = tok.completion ?? attr.completion_tokens ?? 0;
      const tot = tok.total ?? (Number(p) + Number(c));
      const cst = m.cost ?? attr.cost ?? 0.0;

      spanPrompt += Number(p) || 0;
      spanComp += Number(c) || 0;
      spanTotal += Number(tot) || 0;
      spanCost += Number(cst) || 0.0;
    }

    if (totalTokens === 0 && spanTotal > 0) {
      promptTokens = spanPrompt;
      completionTokens = spanComp;
      totalTokens = spanTotal;
    }
    if (cost === 0 && spanCost > 0) {
      cost = spanCost;
    }
  }

  const spanCount = trace.spans?.length || trace.span_count || 0;
  const errorCount = trace.spans?.filter(s => s.status === 'error').length ?? trace.error_count ?? 0;

  return {
    duration,
    promptTokens,
    completionTokens,
    totalTokens,
    cost,
    spanCount,
    errorCount,
  };
};

const getSpanTypeIcon = (spanType: string) => {
  switch (spanType) {
    case 'llm':
      return <Sparkles className="w-3 h-3 text-purple-400" />;
    case 'retrieval':
      return <Search className="w-3 h-3 text-blue-400" />;
    case 'tool':
      return <Wrench className="w-3 h-3 text-amber-400" />;
    case 'agent':
      return <Bot className="w-3 h-3 text-emerald-400" />;
    default:
      return <Activity className="w-3 h-3 text-slate-400" />;
  }
};

export const TraceComparisonModal: React.FC<TraceComparisonModalProps> = ({
  traceAId,
  traceBId,
  onClose,
}) => {
  const [traceA, setTraceA] = useState<TraceDetail | null>(null);
  const [traceB, setTraceB] = useState<TraceDetail | null>(null);
  const [availableTraces, setAvailableTraces] = useState<TraceSummary[]>([]);
  const [selectedBId, setSelectedBId] = useState<string>(traceBId || '');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTraces = async () => {
      try {
        setLoading(true);
        const { traces } = await apiClient.getTraces({ limit: 100 });
        setAvailableTraces(traces);

        const aDetail = await apiClient.getTraceDetail(traceAId);
        setTraceA(aDetail);

        const candidateBId = selectedBId || traceBId || traces.find(t => t.trace_id !== traceAId)?.trace_id;
        if (candidateBId) {
          setSelectedBId(candidateBId);
          const bDetail = await apiClient.getTraceDetail(candidateBId);
          setTraceB(bDetail);
        }
      } catch (err) {
        console.error('Failed to load comparative traces:', err);
      } finally {
        setLoading(false);
      }
    };
    loadTraces();
  }, [traceAId, traceBId]);

  const handleSelectB = async (id: string) => {
    setSelectedBId(id);
    try {
      const bDetail = await apiClient.getTraceDetail(id);
      setTraceB(bDetail);
    } catch (err) {
      console.error('Failed to fetch trace B:', err);
    }
  };

  const metaA = useMemo(() => extractMetrics(traceA), [traceA]);
  const metaB = useMemo(() => extractMetrics(traceB), [traceB]);

  // Duration Delta
  const durDiff = metaB.duration - metaA.duration;
  const durPct = metaA.duration > 0 ? ((durDiff / metaA.duration) * 100).toFixed(1) : '0.0';

  // Token Delta
  const tokDiff = metaB.totalTokens - metaA.totalTokens;
  const tokPct = metaA.totalTokens > 0 ? ((tokDiff / metaA.totalTokens) * 100).toFixed(1) : '0.0';

  // Cost Delta
  const costDiff = metaB.cost - metaA.cost;
  const costPct = metaA.cost > 0 ? ((costDiff / metaA.cost) * 100).toFixed(1) : '0.0';

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-150">
      <div className="bg-[#0d111a] border border-[#1e2330] rounded-xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#090d16] border-b border-[#1e2330]">
          <div className="flex items-center gap-2.5 text-slate-100 font-semibold text-sm">
            <div className="w-7 h-7 rounded-lg bg-indigo-950/60 border border-indigo-700/50 flex items-center justify-center">
              <GitCompare className="w-4 h-4 text-indigo-400" />
            </div>
            <span>Trace Regression & Comparative Diff</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-5">
          {/* Baseline vs Target Selector Bar */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] items-center gap-3 bg-[#080b11] p-3.5 rounded-xl border border-[#1e2330]">
            <div className="min-w-0">
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-indigo-400 block mb-1">
                Baseline Trace (A)
              </span>
              <div className="font-mono text-xs text-slate-200 font-bold truncate">
                {traceA?.name || 'Loading...'}
              </div>
              <div className="text-[11px] font-mono text-slate-500 truncate mt-0.5">
                ID: {traceA?.trace_id || '--'}
              </div>
            </div>

            <div className="hidden md:flex items-center justify-center w-8 h-8 rounded-full bg-slate-900 border border-slate-800 text-slate-400">
              <ArrowRight className="w-4 h-4" />
            </div>

            <div className="min-w-0">
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-purple-400 block mb-1">
                Comparison Target (B)
              </span>
              <select
                value={selectedBId}
                onChange={(e) => handleSelectB(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
              >
                {availableTraces.map(t => (
                  <option key={t.trace_id} value={t.trace_id}>
                    {t.name} • {formatDuration(t.duration_ms)} • {t.tokens?.total ? `${formatNumber(t.tokens.total)} tok` : '0 tok'} • {t.trace_id.slice(0, 8)}...
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Differential Metrics Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Duration Delta */}
            <div className="p-4 rounded-xl bg-[#080b11] border border-[#1e2330] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-slate-400 mb-1.5">
                  <span className="text-[11px] font-mono uppercase tracking-wide flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    Duration Delta
                  </span>
                  <span className={`text-xs font-mono font-bold flex items-center gap-0.5 ${
                    durDiff > 0 ? 'text-rose-400' : durDiff < 0 ? 'text-emerald-400' : 'text-slate-400'
                  }`}>
                    {durDiff > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : durDiff < 0 ? <ArrowDownRight className="w-3.5 h-3.5" /> : null}
                    {durDiff > 0 ? `+${durPct}%` : `${durPct}%`}
                  </span>
                </div>
                <div className="text-2xl font-bold font-mono text-slate-100">
                  {durDiff > 0 ? `+${formatDuration(durDiff)}` : formatDuration(durDiff)}
                </div>
              </div>
              <div className="text-[11px] text-slate-400 pt-3 mt-3 border-t border-slate-800/60 font-mono flex justify-between">
                <span>Baseline (A): <strong className="text-slate-200">{formatDuration(metaA.duration)}</strong></span>
                <span>Target (B): <strong className="text-slate-200">{formatDuration(metaB.duration)}</strong></span>
              </div>
            </div>

            {/* 2. Token Delta */}
            <div className="p-4 rounded-xl bg-[#080b11] border border-[#1e2330] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-slate-400 mb-1.5">
                  <span className="text-[11px] font-mono uppercase tracking-wide flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    Token Delta
                  </span>
                  <span className={`text-xs font-mono font-bold flex items-center gap-0.5 ${
                    tokDiff > 0 ? 'text-amber-400' : tokDiff < 0 ? 'text-emerald-400' : 'text-slate-400'
                  }`}>
                    {tokDiff > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : tokDiff < 0 ? <ArrowDownRight className="w-3.5 h-3.5" /> : null}
                    {tokDiff > 0 ? `+${tokPct}%` : `${tokPct}%`}
                  </span>
                </div>
                <div className="text-2xl font-bold font-mono text-slate-100">
                  {tokDiff > 0 ? `+${formatNumber(tokDiff)}` : formatNumber(tokDiff)}
                </div>
              </div>
              <div className="text-[11px] text-slate-400 pt-3 mt-3 border-t border-slate-800/60 font-mono flex justify-between">
                <span>Baseline (A): <strong className="text-slate-200">{formatNumber(metaA.totalTokens)}</strong></span>
                <span>Target (B): <strong className="text-slate-200">{formatNumber(metaB.totalTokens)}</strong></span>
              </div>
            </div>

            {/* 3. Cost Delta */}
            <div className="p-4 rounded-xl bg-[#080b11] border border-[#1e2330] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-slate-400 mb-1.5">
                  <span className="text-[11px] font-mono uppercase tracking-wide flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-emerald-400" />
                    Cost Delta
                  </span>
                  <span className={`text-xs font-mono font-bold flex items-center gap-0.5 ${
                    costDiff > 0 ? 'text-amber-400' : costDiff < 0 ? 'text-emerald-400' : 'text-slate-400'
                  }`}>
                    {costDiff > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : costDiff < 0 ? <ArrowDownRight className="w-3.5 h-3.5" /> : null}
                    {costDiff > 0 ? `+${costPct}%` : `${costPct}%`}
                  </span>
                </div>
                <div className="text-2xl font-bold font-mono text-emerald-400">
                  {costDiff > 0 ? `+${formatCost(costDiff)}` : formatCost(costDiff)}
                </div>
              </div>
              <div className="text-[11px] text-slate-400 pt-3 mt-3 border-t border-slate-800/60 font-mono flex justify-between">
                <span>Baseline (A): <strong className="text-slate-200">{formatCost(metaA.cost)}</strong></span>
                <span>Target (B): <strong className="text-slate-200">{formatCost(metaB.cost)}</strong></span>
              </div>
            </div>
          </div>

          {/* Span Counts & Side-by-Side Span Breakdowns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Trace A Spans List */}
            <div className="p-4 rounded-xl bg-[#080b11] border border-[#1e2330] flex flex-col">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-800 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-200 font-mono">Trace A Spans</span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-400">
                    {metaA.spanCount} total
                  </span>
                </div>
                <StatusBadge status={traceA?.status || 'ok'} size="sm" />
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {traceA?.spans?.map(s => {
                  const sTok = s.metrics?.tokens?.total || s.attributes?.tokens?.total;
                  const sCost = s.metrics?.cost || s.attributes?.cost;
                  return (
                    <div
                      key={s.span_id}
                      className="flex items-center justify-between text-xs font-mono p-2 rounded-lg bg-slate-900/70 border border-slate-800/60 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {getSpanTypeIcon(s.span_type)}
                        <span className="text-slate-200 font-medium truncate">{s.name}</span>
                        <span className="text-[10px] uppercase text-slate-500">{s.span_type}</span>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0 text-[11px] text-slate-400">
                        {sTok ? <span className="text-purple-300">{formatNumber(sTok)}t</span> : null}
                        {sCost ? <span className="text-emerald-400">{formatCost(sCost)}</span> : null}
                        <span className="text-slate-300 font-semibold">{formatDuration(s.duration_ms)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Trace B Spans List */}
            <div className="p-4 rounded-xl bg-[#080b11] border border-[#1e2330] flex flex-col">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-800 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-200 font-mono">Trace B Spans</span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-400">
                    {metaB.spanCount} total
                  </span>
                </div>
                <StatusBadge status={traceB?.status || 'ok'} size="sm" />
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {traceB?.spans?.map(s => {
                  const sTok = s.metrics?.tokens?.total || s.attributes?.tokens?.total;
                  const sCost = s.metrics?.cost || s.attributes?.cost;
                  return (
                    <div
                      key={s.span_id}
                      className="flex items-center justify-between text-xs font-mono p-2 rounded-lg bg-slate-900/70 border border-slate-800/60 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {getSpanTypeIcon(s.span_type)}
                        <span className="text-slate-200 font-medium truncate">{s.name}</span>
                        <span className="text-[10px] uppercase text-slate-500">{s.span_type}</span>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0 text-[11px] text-slate-400">
                        {sTok ? <span className="text-purple-300">{formatNumber(sTok)}t</span> : null}
                        {sCost ? <span className="text-emerald-400">{formatCost(sCost)}</span> : null}
                        <span className="text-slate-300 font-semibold">{formatDuration(s.duration_ms)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
