import React, { useState, useMemo } from 'react';
import { SpanPayload } from '../../types';
import { formatDuration } from '../../utils/formatters';
import { StatusBadge } from '../common/StatusBadge';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  Bot,
  Search,
  Wrench,
  Activity,
  AlertCircle,
  Clock,
  Layers,
} from 'lucide-react';

interface TraceTimelineProps {
  spans: SpanPayload[];
  selectedSpanId: string | null;
  onSelectSpan: (span: SpanPayload) => void;
  totalTraceDurationMs?: number | null;
}

export const TraceTimeline: React.FC<TraceTimelineProps> = ({
  spans,
  selectedSpanId,
  onSelectSpan,
  totalTraceDurationMs,
}) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showCriticalPathOnly, setShowCriticalPathOnly] = useState(false);

  // Compute timeline boundaries
  const { minStart, maxEnd, totalDuration, orderedSpans, criticalPathIds } = useMemo(() => {
    if (!spans || spans.length === 0) {
      return { minStart: 0, maxEnd: 0, totalDuration: 1, orderedSpans: [], criticalPathIds: new Set<string>() };
    }

    const startTimes = spans.map(s => new Date(s.start_time).getTime());
    const endTimes = spans.map(s => s.end_time ? new Date(s.end_time).getTime() : new Date(s.start_time).getTime() + (s.duration_ms || 10));

    const minStart = Math.min(...startTimes);
    const maxEnd = Math.max(...endTimes);
    const totalDuration = Math.max(1, totalTraceDurationMs || (maxEnd - minStart));

    // Build hierarchy with depth
    const spanMap = new Map<string, SpanPayload>();
    const childrenMap = new Map<string, string[]>();
    spans.forEach(s => {
      spanMap.set(s.span_id, s);
      if (s.parent_span_id) {
        if (!childrenMap.has(s.parent_span_id)) childrenMap.set(s.parent_span_id, []);
        childrenMap.get(s.parent_span_id)!.push(s.span_id);
      }
    });

    // Find roots
    const rootIds = spans.filter(s => !s.parent_span_id || !spanMap.has(s.parent_span_id)).map(s => s.span_id);
    const orderedList: Array<{ span: SpanPayload; depth: number }> = [];

    const traverse = (spanId: string, depth: number) => {
      const sp = spanMap.get(spanId);
      if (!sp) return;
      orderedList.push({ span: sp, depth });
      const children = childrenMap.get(spanId) || [];
      // Sort children by start time
      children.sort((a, b) => {
        const sa = spanMap.get(a);
        const sb = spanMap.get(b);
        return new Date(sa?.start_time || 0).getTime() - new Date(sb?.start_time || 0).getTime();
      });
      children.forEach(cId => traverse(cId, depth + 1));
    };

    rootIds.forEach(rId => traverse(rId, 0));

    // Fallback if some spans were disconnected
    if (orderedList.length < spans.length) {
      const addedIds = new Set(orderedList.map(o => o.span.span_id));
      spans.forEach(s => {
        if (!addedIds.has(s.span_id)) orderedList.push({ span: s, depth: 0 });
      });
    }

    // Identify critical path: top spans with highest latency
    const sortedByDuration = [...spans].sort((a, b) => (b.duration_ms || 0) - (a.duration_ms || 0));
    const criticalPathIds = new Set<string>(sortedByDuration.slice(0, Math.min(3, spans.length)).map(s => s.span_id));

    return { minStart, maxEnd, totalDuration, orderedSpans: orderedList, criticalPathIds };
  }, [spans, totalTraceDurationMs]);

  const displayedList = useMemo(() => {
    if (!showCriticalPathOnly) return orderedSpans;
    return orderedSpans.filter(item => criticalPathIds.has(item.span.span_id));
  }, [orderedSpans, showCriticalPathOnly, criticalPathIds]);

  const getSpanColor = (type: string, isError: boolean) => {
    if (isError) return 'bg-rose-600 hover:bg-rose-500 border-rose-400';
    switch (type) {
      case 'llm':
        return 'bg-purple-600 hover:bg-purple-500 border-purple-400';
      case 'retrieval':
        return 'bg-amber-600 hover:bg-amber-500 border-amber-400';
      case 'tool':
        return 'bg-cyan-600 hover:bg-cyan-500 border-cyan-400';
      case 'agent':
        return 'bg-indigo-600 hover:bg-indigo-500 border-indigo-400';
      default:
        return 'bg-slate-600 hover:bg-slate-500 border-slate-400';
    }
  };

  const getSpanIcon = (type: string) => {
    switch (type) {
      case 'llm':
        return <Sparkles className="w-3.5 h-3.5 text-purple-400" />;
      case 'retrieval':
        return <Search className="w-3.5 h-3.5 text-amber-400" />;
      case 'tool':
        return <Wrench className="w-3.5 h-3.5 text-cyan-400" />;
      case 'agent':
        return <Bot className="w-3.5 h-3.5 text-indigo-400" />;
      default:
        return <Activity className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#080b11] border border-[#1e2330] rounded-lg overflow-hidden select-none">
      {/* Timeline Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#0d111a] border-b border-[#1e2330]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 font-mono">
            <Layers className="w-4 h-4 text-indigo-400" />
            Waterfall Timeline
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {spans.length} Spans &bull; {formatDuration(totalDuration)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCriticalPathOnly(!showCriticalPathOnly)}
            className={`px-2 py-1 rounded text-[11px] font-sans font-medium flex items-center gap-1 border transition-colors ${
              showCriticalPathOnly
                ? 'bg-amber-950/60 text-amber-300 border-amber-800/80'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3 h-3 text-amber-400" />
            {showCriticalPathOnly ? 'Showing Critical Path' : 'Highlight Critical Path'}
          </button>

          <div className="flex items-center rounded bg-slate-800 border border-slate-700">
            <button
              onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.25))}
              className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-l"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 text-[10px] font-mono text-slate-300 font-medium">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel(prev => Math.min(3, prev + 0.25))}
              className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-700"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoomLevel(1)}
              className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-r border-l border-slate-700"
              title="Reset Zoom"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Waterfall Body */}
      <div className="flex-1 overflow-auto">
        {/* Time Scale Ruler */}
        <div className="flex border-b border-[#1e2330] bg-[#090d16] sticky top-0 z-10 text-[10px] font-mono text-slate-400">
          <div className="w-72 shrink-0 px-3 py-1.5 border-r border-[#1e2330] font-semibold text-slate-400">
            SPAN HIERARCHY
          </div>
          <div className="flex-1 relative h-7 overflow-hidden">
            <div className="absolute inset-0 flex justify-between px-2 items-center" style={{ width: `${zoomLevel * 100}%` }}>
              <span>0ms</span>
              <span>{formatDuration(totalDuration * 0.25)}</span>
              <span>{formatDuration(totalDuration * 0.5)}</span>
              <span>{formatDuration(totalDuration * 0.75)}</span>
              <span>{formatDuration(totalDuration)}</span>
            </div>
          </div>
        </div>

        {/* Span Waterfall Rows */}
        <div className="divide-y divide-slate-800/40">
          {displayedList.map(({ span, depth }) => {
            const spanStart = new Date(span.start_time).getTime();
            const spanEnd = span.end_time
              ? new Date(span.end_time).getTime()
              : spanStart + (span.duration_ms || 1);

            const startOffsetMs = Math.max(0, spanStart - minStart);
            const durationMs = Math.max(0.5, span.duration_ms || (spanEnd - spanStart));

            const leftPct = (startOffsetMs / totalDuration) * 100;
            const widthPct = Math.max(0.75, (durationMs / totalDuration) * 100);

            const isSelected = selectedSpanId === span.span_id;
            const isCritical = criticalPathIds.has(span.span_id);
            const isError = span.status === 'error';

            return (
              <div
                key={span.span_id}
                onClick={() => onSelectSpan(span)}
                className={`flex items-center hover:bg-slate-800/40 cursor-pointer transition-colors group text-xs ${
                  isSelected ? 'bg-indigo-950/40 border-l-2 border-indigo-500' : ''
                }`}
              >
                {/* Span Hierarchy Column */}
                <div
                  className="w-72 shrink-0 px-3 py-2 border-r border-[#1e2330] flex items-center gap-2 truncate overflow-hidden"
                  style={{ paddingLeft: `${Math.max(12, depth * 16 + 12)}px` }}
                >
                  {getSpanIcon(span.span_type)}
                  <span className="font-mono text-[11px] text-slate-200 truncate font-medium group-hover:text-indigo-300">
                    {span.name}
                  </span>
                  {isError && <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />}
                  {isCritical && (
                    <span className="px-1 py-0.2 rounded bg-amber-950/60 text-amber-400 text-[9px] font-mono border border-amber-800/60">
                      p95
                    </span>
                  )}
                </div>

                {/* Waterfall Bar Area */}
                <div className="flex-1 relative py-2 px-2 overflow-hidden">
                  <div
                    className="relative h-6"
                    style={{ width: `${zoomLevel * 100}%` }}
                  >
                    <div
                      style={{
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                      }}
                      className={`absolute top-0.5 h-5 rounded border flex items-center px-1.5 text-[10px] font-mono text-white whitespace-nowrap shadow-sm transition-all overflow-visible ${getSpanColor(
                        span.span_type,
                        isError
                      )} ${isSelected ? 'ring-2 ring-indigo-400 shadow-lg' : ''}`}
                    >
                      <span className="drop-shadow">{formatDuration(span.duration_ms)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

