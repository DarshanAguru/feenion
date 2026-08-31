import React, { useState, useEffect } from 'react';
import { ErrorGroup } from '../../types';
import { formatTimestamp, formatRelativeTime } from '../../utils/formatters';
import {
  AlertOctagon,
  Search,
  ExternalLink,
  ShieldAlert,
  Terminal,
  Clock,
  Layers,
  ArrowRight,
  TrendingUp,
  Cpu,
  Sparkles,
} from 'lucide-react';

interface ErrorsPageProps {
  errors: ErrorGroup[];
  onSelectTrace: (traceId: string) => void;
}

export const ErrorsPage: React.FC<ErrorsPageProps> = ({ errors, onSelectTrace }) => {
  const [selectedError, setSelectedError] = useState<ErrorGroup | null>(null);
  const [search, setSearch] = useState('');

  // Resizable Split Pane
  const [listWidth, setListWidth] = useState(420);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (errors && errors.length > 0 && !selectedError) {
      setSelectedError(errors[0]);
    }
  }, [errors]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = e.clientX - 64; // account for sidebar
      if (newWidth >= 300 && newWidth <= window.innerWidth - 450) {
        setListWidth(newWidth);
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

  const filteredErrors = errors.filter(
    e =>
      e.message.toLowerCase().includes(search.toLowerCase()) ||
      e.error_type.toLowerCase().includes(search.toLowerCase()) ||
      e.sample_span_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col p-4 overflow-hidden space-y-4 bg-[#080b11]">
      {/* Top Banner Alert */}
      {errors.length > 0 && (
        <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/80 flex items-center justify-between gap-4 shadow-lg shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-900/60 border border-rose-700 text-rose-300">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold font-mono text-rose-200 uppercase tracking-wider">
                Production Error Hotspot
              </h4>
              <p className="text-xs text-rose-300/80 mt-0.5">
                Top failing pattern: <strong className="text-white font-mono">{errors[0]?.error_type}</strong> in{' '}
                <span className="text-rose-200 underline decoration-rose-600">{errors[0]?.sample_span_name}</span> ({errors[0]?.count} failures).
              </p>
            </div>
          </div>

          <button
            onClick={() => onSelectTrace(errors[0]?.sample_trace_id)}
            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 shadow"
          >
            Investigate Sample Trace <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Layout: Resizable Error Groups on Left, Inspector on Right */}
      <div className="flex-1 flex flex-col md:flex-row gap-0 overflow-hidden relative">
        {/* Left: Error Groups List */}
        <div
          style={{ width: `${listWidth}px` }}
          className="w-full md:w-auto shrink-0 flex flex-col bg-[#0d111a] border border-[#1e2330] rounded-xl overflow-hidden shadow-lg"
        >
          <div className="p-3 border-b border-[#1e2330] bg-[#090d16] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-rose-400" />
              <span className="text-xs font-mono uppercase text-slate-200 font-bold">
                Error Fingerprints ({filteredErrors.length})
              </span>
            </div>

            <div className="relative">
              <Search className="w-3 h-3 text-slate-400 absolute left-2 top-2" />
              <input
                type="text"
                placeholder="Filter errors..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-6 pr-2 py-1 text-xs rounded bg-[#080b11] border border-slate-700 text-slate-200 placeholder-slate-400 focus:outline-none w-36"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40 p-2 space-y-1">
            {filteredErrors.length > 0 ? (
              filteredErrors.map(err => {
                const isSelected = selectedError?.fingerprint === err.fingerprint;
                return (
                  <div
                    key={err.fingerprint}
                    onClick={() => setSelectedError(err)}
                    className={`p-3 rounded-lg cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-rose-950/40 border border-rose-800/80 shadow-md'
                        : 'hover:bg-slate-800/40 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-xs font-bold text-rose-400">
                        {err.error_type}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-rose-950/80 border border-rose-800 text-rose-300 font-mono text-[11px] font-bold">
                        {err.count}x
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 font-mono line-clamp-2 leading-relaxed mb-2">
                      {err.message}
                    </p>

                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span>Span: {err.sample_span_name}</span>
                      <span>{formatRelativeTime(err.latest_occurrence)}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-xs text-slate-400">
                No matching errors recorded.
              </div>
            )}
          </div>
        </div>

        {/* Draggable Vertical Splitter Bar */}
        <div
          onMouseDown={() => setIsDragging(true)}
          className={`hidden md:flex w-2.5 hover:w-3 bg-transparent hover:bg-rose-600/30 cursor-col-resize items-center justify-center transition-all select-none shrink-0 group ${
            isDragging ? 'bg-rose-600/50 w-3' : ''
          }`}
          title="Drag to resize error list"
        >
          <div className="w-1 h-10 bg-slate-700 group-hover:bg-rose-400 rounded-full transition-colors" />
        </div>

        {/* Right: Detailed Error Intelligence Inspector */}
        <div className="flex-1 flex flex-col bg-[#0d111a] border border-[#1e2330] rounded-xl overflow-hidden shadow-lg pl-0 md:pl-0">
          {selectedError ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-[#1e2330] bg-[#090d16] flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 font-mono text-xs font-bold">
                      {selectedError.error_type}
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      {selectedError.affected_traces_count} affected trace(s)
                    </span>
                  </div>
                  <h3 className="text-sm font-mono text-slate-100 font-bold mt-1">
                    {selectedError.message}
                  </h3>
                </div>

                <button
                  onClick={() => onSelectTrace(selectedError.sample_trace_id)}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow"
                >
                  Jump to Trace <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Meta details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-[#090d16] border border-[#1e2330]">
                    <span className="text-[10px] uppercase font-mono text-slate-400 block">First Seen</span>
                    <span className="text-xs font-mono text-slate-200 mt-1 block">
                      {formatTimestamp(selectedError.first_seen)}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-[#090d16] border border-[#1e2330]">
                    <span className="text-[10px] uppercase font-mono text-slate-400 block">Latest Occurrence</span>
                    <span className="text-xs font-mono text-slate-200 mt-1 block">
                      {formatTimestamp(selectedError.latest_occurrence)}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-[#090d16] border border-[#1e2330]">
                    <span className="text-[10px] uppercase font-mono text-slate-400 block">Span Type</span>
                    <span className="text-xs font-mono text-indigo-400 mt-1 block uppercase font-bold">
                      {selectedError.span_type}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-[#090d16] border border-[#1e2330]">
                    <span className="text-[10px] uppercase font-mono text-slate-400 block">Sample Span</span>
                    <span className="text-xs font-mono text-slate-200 mt-1 block truncate">
                      {selectedError.sample_span_name}
                    </span>
                  </div>
                </div>

                {/* Stack Trace Viewer */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-300 font-bold">
                    <Terminal className="w-4 h-4 text-slate-400" />
                    <span>Stack Trace & Execution Exception:</span>
                  </div>

                  <pre className="p-4 rounded-lg bg-black/90 border border-slate-800 text-rose-300 font-mono text-xs overflow-x-auto leading-relaxed whitespace-pre-wrap select-text">
                    {selectedError.stack_trace || `${selectedError.error_type}: ${selectedError.message}\n  at [${selectedError.sample_span_name}] span (${selectedError.span_type})`}
                  </pre>
                </div>

                {/* Affected Traces List */}
                <div className="space-y-2">
                  <span className="text-xs font-mono text-slate-300 font-bold block">
                    Recent Affected Traces ({selectedError.affected_traces.length}):
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {selectedError.affected_traces.map(tId => (
                      <button
                        key={tId}
                        onClick={() => onSelectTrace(tId)}
                        className="px-2.5 py-1 rounded bg-[#090d16] border border-slate-700 hover:border-indigo-500 text-xs font-mono text-indigo-400 flex items-center gap-1.5 transition-colors"
                      >
                        <span>{tId.slice(0, 12)}...</span>
                        <ExternalLink className="w-3 h-3 text-slate-500" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <AlertOctagon className="w-8 h-8 text-slate-600 mb-2" />
              <p className="text-xs font-mono">Select an error fingerprint to inspect root cause.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
