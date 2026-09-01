import React from 'react';
import { SpanPayload } from '../../types';
import { formatDuration, formatCost, formatNumber } from '../../utils/formatters';
import { Sparkles, Search, Wrench, Bot, Activity, AlertCircle } from 'lucide-react';

interface SpanTreeProps {
  spans: SpanPayload[];
  selectedSpanId: string | null;
  onSelectSpan: (span: SpanPayload) => void;
}

export const SpanTree: React.FC<SpanTreeProps> = ({
  spans,
  selectedSpanId,
  onSelectSpan,
}) => {
  // Build hierarchy
  const spanMap = new Map<string, SpanPayload>();
  const childrenMap = new Map<string, string[]>();

  spans.forEach(s => {
    spanMap.set(s.span_id, s);
    if (s.parent_span_id) {
      if (!childrenMap.has(s.parent_span_id)) childrenMap.set(s.parent_span_id, []);
      childrenMap.get(s.parent_span_id)!.push(s.span_id);
    }
  });

  const rootIds = spans.filter(s => !s.parent_span_id || !spanMap.has(s.parent_span_id)).map(s => s.span_id);

  // Helper to compute subtree tokens & costs
  const getSubtreeMetrics = (spanId: string): { tokens: number; cost: number } => {
    const s = spanMap.get(spanId);
    if (!s) return { tokens: 0, cost: 0 };
    const m = s.metrics || {};
    const attr = s.attributes || {};
    const tok = m.tokens || attr.tokens || {};
    let t = Number(tok.total || attr.total_tokens || (Number(tok.prompt || attr.prompt_tokens || 0) + Number(tok.completion || attr.completion_tokens || 0)));
    let c = Number(m.cost ?? attr.cost ?? 0);

    const children = childrenMap.get(spanId) || [];
    for (const childId of children) {
      const childRes = getSubtreeMetrics(childId);
      if (t === 0 || s.span_type === 'agent' || s.span_type === 'chain') {
        t += childRes.tokens;
      }
      if (c === 0 || s.span_type === 'agent' || s.span_type === 'chain') {
        c += childRes.cost;
      }
    }
    return { tokens: t, cost: c };
  };

  const getSpanIcon = (type: string) => {
    switch (type) {
      case 'llm':
        return <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
      case 'retrieval':
        return <Search className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      case 'tool':
        return <Wrench className="w-3.5 h-3.5 text-cyan-400 shrink-0" />;
      case 'agent':
        return <Bot className="w-3.5 h-3.5 text-indigo-400 shrink-0" />;
      default:
        return <Activity className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
    }
  };

  const renderNode = (spanId: string, depth = 0) => {
    const s = spanMap.get(spanId);
    if (!s) return null;

    const isSelected = selectedSpanId === s.span_id;
    const isError = s.status === 'error';
    const children = childrenMap.get(spanId) || [];
    const subtree = getSubtreeMetrics(spanId);

    return (
      <div key={s.span_id} className="flex flex-col">
        <div
          onClick={() => onSelectSpan(s)}
          className={`flex items-center justify-between px-2.5 py-1.5 rounded cursor-pointer transition-colors text-xs select-none ${
            isSelected
              ? 'bg-indigo-950/70 border border-indigo-500/80 text-white font-semibold'
              : 'hover:bg-slate-800/50 text-slate-300'
          }`}
          style={{ paddingLeft: `${Math.max(10, depth * 14 + 10)}px` }}
        >
          <div className="flex items-center gap-2 truncate">
            {getSpanIcon(s.span_type)}
            <span className="font-mono text-[11px] truncate">{s.name}</span>
            {isError && <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />}
          </div>

          <div className="flex items-center gap-2 font-mono text-[10px] shrink-0 ml-2">
            {subtree.tokens > 0 && (
              <span className="text-purple-300">
                {formatNumber(subtree.tokens)} tok
              </span>
            )}
            {subtree.cost > 0 && (
              <span className="text-emerald-400 font-semibold">
                {formatCost(subtree.cost)}
              </span>
            )}
            <span className="text-slate-400">
              {formatDuration(s.duration_ms)}
            </span>
          </div>
        </div>

        {children.length > 0 && (
          <div className="flex flex-col">
            {children.map(childId => renderNode(childId, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-0.5 overflow-y-auto h-full p-1 divide-y divide-slate-800/30">
      {rootIds.map(rId => renderNode(rId, 0))}
    </div>
  );
};

