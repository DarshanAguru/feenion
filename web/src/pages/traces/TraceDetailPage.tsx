import React, { useState, useEffect } from 'react';
import { TraceDetail, SpanPayload } from '../../types';
import { apiClient } from '../../api/client';
import { StatusBadge } from '../../components/common/StatusBadge';
import { TraceTimeline } from '../../components/trace/TraceTimeline';
import { TraceMindMap } from '../../components/trace/TraceMindMap';
import { SpanTree } from '../../components/trace/SpanTree';
import { SpanInspector } from '../../components/trace/SpanInspector';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { formatDuration, formatCost, formatNumber, formatTimestamp } from '../../utils/formatters';
import {
  Layers,
  Network,
  Download,
  Copy,
  Check,
  GitCompare,
  ArrowLeft,
  Share2,
  AlertTriangle,
  Coins,
  Sparkles,
  Clock,
  Trash2,
} from 'lucide-react';

interface TraceDetailPageProps {
  traceId: string;
  onBack: () => void;
  onOpenCompare: (traceAId: string) => void;
}

export const TraceDetailPage: React.FC<TraceDetailPageProps> = ({
  traceId,
  onBack,
  onOpenCompare,
}) => {
  const [trace, setTrace] = useState<TraceDetail | null>(null);
  const [selectedSpan, setSelectedSpan] = useState<SpanPayload | null>(null);
  const [activeView, setActiveView] = useState<'timeline' | 'mindmap' | 'tree'>('timeline');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Resizable 50-50 Split Pane State
  const [splitPercent, setSplitPercent] = useState<number>(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchTrace = async () => {
      try {
        setLoading(true);
        const data = await apiClient.getTraceDetail(traceId);
        setTrace(data);
        if (data.spans && data.spans.length > 0) {
          // Select root or first failing span
          const errorSpan = data.spans.find(s => s.status === 'error');
          setSelectedSpan(errorSpan || data.spans[0]);
        }
      } catch (err) {
        console.error('Failed to load trace detail:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTrace();
  }, [traceId]);

  // Handle Dragging Splitter
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const newPercent = (relativeX / rect.width) * 100;
      if (newPercent >= 20 && newPercent <= 80) {
        setSplitPercent(newPercent);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  if (loading) {
    return <LoadingSkeleton rows={8} />;
  }

  if (!trace) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <p className="text-slate-400 text-sm mb-4">Trace not found or failed to load.</p>
        <button
          onClick={onBack}
          className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Traces
        </button>
      </div>
    );
  }

  const handleCopyId = () => {
    navigator.clipboard.writeText(trace.trace_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(trace, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trace-${trace.trace_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteTrace = async () => {
    if (!window.confirm(`Delete trace "${trace.name}" (${trace.trace_id.slice(0, 8)}...)?`)) return;
    try {
      await apiClient.deleteTrace(trace.trace_id);
      onBack();
    } catch (err: any) {
      alert(err.message || 'Failed to delete trace');
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#080b11]">
      {/* Top Header Bar */}
      <div className="p-4 bg-[#090d16] border-b border-[#1e2330] space-y-3 select-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-1.5 rounded-lg bg-[#0d111a] border border-[#1e2330] text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              title="Back to Traces"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              <StatusBadge status={trace.status} size="lg" />
              <h2 className="text-sm font-bold font-mono text-white tracking-tight">
                {trace.name}
              </h2>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-300">
                {trace.environment || 'production'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenCompare(trace.trace_id)}
              className="px-2.5 py-1.5 rounded-lg bg-[#0d111a] border border-[#1e2330] hover:border-slate-600 text-slate-300 text-xs flex items-center gap-1.5 transition-colors"
              title="Compare with another trace"
            >
              <GitCompare className="w-3.5 h-3.5 text-indigo-400" />
              <span>Compare</span>
            </button>

            <button
              onClick={handleExportJson}
              className="px-2.5 py-1.5 rounded-lg bg-[#0d111a] border border-[#1e2330] hover:border-slate-600 text-slate-300 text-xs flex items-center gap-1.5 transition-colors"
              title="Export raw JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>

            <button
              onClick={handleCopyId}
              className="px-2.5 py-1.5 rounded-lg bg-[#0d111a] border border-[#1e2330] hover:border-slate-600 text-slate-300 text-xs flex items-center gap-1.5 transition-colors font-mono"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{trace.trace_id.slice(0, 8)}...</span>
            </button>

            <button
              onClick={handleDeleteTrace}
              className="px-2.5 py-1.5 rounded-lg bg-rose-950/40 border border-rose-900/80 hover:border-rose-600 text-rose-300 text-xs flex items-center gap-1.5 transition-colors"
              title="Delete this trace"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Delete</span>
            </button>
          </div>
        </div>

        {/* Trace Metric Pill Cards */}
        <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-slate-800/40 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-slate-300">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Duration:</span>
            <strong className="text-white font-bold">{formatDuration(trace.duration_ms || 0)}</strong>
          </div>

          <span className="text-slate-600">&bull;</span>

          <div className="flex items-center gap-1.5 text-slate-300">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span>Spans:</span>
            <strong className="text-white font-bold">{trace.span_count ?? trace.spans?.length ?? 0}</strong>
            {trace.error_count > 0 && (
              <span className="text-rose-400 font-bold">({trace.error_count} error)</span>
            )}
          </div>

          {trace.tokens && trace.tokens.total > 0 && (
            <>
              <span className="text-slate-600">&bull;</span>
              <div className="flex items-center gap-1.5 text-slate-300">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>Tokens:</span>
                <strong className="text-white font-bold">{formatNumber(trace.tokens.total)}</strong>
                <span className="text-[10px] text-slate-400">
                  ({formatNumber(trace.tokens.prompt)} in / {formatNumber(trace.tokens.completion)} out)
                </span>
              </div>
            </>
          )}

          <span className="text-slate-600">&bull;</span>
          <div className="flex items-center gap-1.5 text-slate-300">
            <Coins className="w-3.5 h-3.5 text-emerald-400" />
            <span>Spend:</span>
            <strong className="text-emerald-400 font-bold">
              {formatCost(
                (trace.estimated_cost !== undefined && trace.estimated_cost > 0)
                  ? trace.estimated_cost
                  : (trace.spans?.reduce((acc, s) => {
                      const m = s.metrics || {};
                      const attr = s.attributes || {};
                      const c = m.cost ?? attr.cost ?? 0;
                      return acc + (typeof c === 'number' ? c : 0);
                    }, 0) || 0)
              )}
            </strong>
          </div>

          {trace.models && trace.models.length > 0 && (
            <div className="flex items-center gap-1 ml-2">
              <span className="text-slate-500">Models:</span>
              <div className="flex items-center gap-1">
                {trace.models.map(m => (
                  <span key={m} className="px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 text-[10px] border border-purple-800">
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="ml-auto text-slate-400 text-[11px]">
            {formatTimestamp(trace.start_time)}
          </div>
        </div>
      </div>

      {/* Main Multi-View Debugger Workspace with 50-50 Default Split */}
      <div
        ref={containerRef}
        className="flex-1 flex flex-col md:flex-row overflow-hidden p-3 gap-0 relative"
      >
        {/* Left Primary Visualization Panel (50% Default) */}
        <div
          style={{ width: `calc(${splitPercent}% - 6px)` }}
          className="w-full md:w-auto flex flex-col overflow-hidden space-y-2 pr-1 shrink-0"
        >
          {/* View Mode Switcher */}
          <div className="flex items-center justify-between select-none">
            <div className="flex items-center rounded-lg bg-[#0d111a] border border-[#1e2330] p-0.5">
              <button
                onClick={() => setActiveView('timeline')}
                className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  activeView === 'timeline'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Waterfall Timeline</span>
              </button>

              <button
                onClick={() => setActiveView('mindmap')}
                className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  activeView === 'mindmap'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Network className="w-3.5 h-3.5" />
                <span>Mind Map DAG</span>
              </button>

              <button
                onClick={() => setActiveView('tree')}
                className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  activeView === 'tree'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Span Tree</span>
              </button>
            </div>
          </div>

          {/* Active View Visualization */}
          <div className="flex-1 overflow-hidden">
            {activeView === 'timeline' && (
              <TraceTimeline
                spans={trace.spans}
                selectedSpanId={selectedSpan?.span_id || null}
                onSelectSpan={setSelectedSpan}
                totalTraceDurationMs={trace.duration_ms}
              />
            )}

            {activeView === 'mindmap' && (
              <TraceMindMap
                spans={trace.spans}
                selectedSpanId={selectedSpan?.span_id || null}
                onSelectSpan={setSelectedSpan}
              />
            )}

            {activeView === 'tree' && (
              <div className="h-full bg-[#080b11] border border-[#1e2330] rounded-lg p-2 overflow-y-auto">
                <SpanTree
                  spans={trace.spans}
                  selectedSpanId={selectedSpan?.span_id || null}
                  onSelectSpan={setSelectedSpan}
                />
              </div>
            )}
          </div>
        </div>

        {/* Draggable Vertical Splitter Bar */}
        <div
          onMouseDown={() => setIsDragging(true)}
          onDoubleClick={() => setSplitPercent(50)}
          className={`hidden md:flex w-3 hover:w-3 bg-transparent hover:bg-indigo-600/30 cursor-col-resize items-center justify-center transition-all select-none shrink-0 group ${
            isDragging ? 'bg-indigo-600/50' : ''
          }`}
          title="Drag to resize panels (Double-click to reset to 50/50)"
        >
          <div className="w-1 h-12 bg-slate-700 group-hover:bg-indigo-400 rounded-full transition-colors" />
        </div>

        {/* Right Structured Span Inspector & Trace Data (50% Default) */}
        <div
          style={{ width: `calc(${100 - splitPercent}% - 6px)` }}
          className="w-full md:w-auto flex-1 shrink-0 h-full overflow-hidden pl-1"
        >
          <SpanInspector span={selectedSpan} allSpans={trace.spans} />
        </div>
      </div>
    </div>
  );
};
