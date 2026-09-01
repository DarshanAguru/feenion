import React, { useState } from 'react';
import { TraceSummary } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { apiClient } from '../../api/client';
import { formatDuration, formatCost, formatNumber, formatTimestamp, formatRelativeTime } from '../../utils/formatters';
import {
  Search,
  Filter,
  ArrowUpDown,
  Layers,
  Sparkles,
  Search as SearchIcon,
  Wrench,
  Bot,
  AlertCircle,
  GitCompare,
  Download,
  Copy,
  Check,
  ChevronRight,
  Trash2,
  AlertTriangle,
} from 'lucide-react';

interface TracesPageProps {
  traces: TraceSummary[];
  selectedTraceId: string | null;
  onSelectTrace: (traceId: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  sortBy: string;
  onSortByChange: (sort: string) => void;
  spanTypeFilter: string;
  onSpanTypeFilterChange: (spanType: string) => void;
  onOpenCompare: (traceAId: string, traceBId?: string) => void;
  onRefresh?: () => void;
}

export const TracesPage: React.FC<TracesPageProps> = ({
  traces,
  selectedTraceId,
  onSelectTrace,
  statusFilter,
  onStatusFilterChange,
  searchQuery,
  onSearchQueryChange,
  sortBy,
  onSortByChange,
  spanTypeFilter,
  onSpanTypeFilterChange,
  onOpenCompare,
  onRefresh,
}) => {
  const [selectedBatch, setSelectedBatch] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Batch Delete Modal
  const [isBatchDeleteModalOpen, setIsBatchDeleteModalOpen] = useState(false);
  const [batchDeleteConfirmText, setBatchDeleteConfirmText] = useState('');
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null);

  const toggleBatch = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = new Set(selectedBatch);
    if (updated.has(id)) updated.delete(id);
    else updated.add(id);
    setSelectedBatch(updated);
  };

  const handleCopy = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleBatchCompare = () => {
    const ids = Array.from(selectedBatch);
    if (ids.length >= 2) {
      onOpenCompare(ids[0], ids[1]);
    } else if (ids.length === 1) {
      onOpenCompare(ids[0]);
    }
  };

  const handleExportSelected = () => {
    const selectedData = traces.filter(t => selectedBatch.has(t.trace_id));
    const blob = new Blob([JSON.stringify(selectedData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `feenion-traces-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBatchDelete = async () => {
    if (batchDeleteConfirmText.trim().toLowerCase() !== 'delete selected') return;
    try {
      setDeleteStatus('Deleting selected traces...');
      const ids = Array.from(selectedBatch);
      await apiClient.batchDeleteTraces(ids, batchDeleteConfirmText.trim());
      setSelectedBatch(new Set());
      setIsBatchDeleteModalOpen(false);
      setBatchDeleteConfirmText('');
      setDeleteStatus(null);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setDeleteStatus(`Error: ${err.message}`);
    }
  };

  const handleDeleteSingle = async (traceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Delete this execution trace and its associated spans?')) return;
    try {
      await apiClient.deleteTrace(traceId);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to delete trace');
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#080b11]">
      {/* Filter & Toolbar Header */}
      <div className="p-4 border-b border-[#1e2330] bg-[#090d16] flex flex-wrap items-center justify-between gap-3 select-none">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search trace ID, model, prompt, tool..."
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-lg bg-[#0d111a] border border-[#1e2330] text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-indigo-500 w-64"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="bg-[#0d111a] border border-[#1e2330] rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none font-mono cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="ok">OK (Success)</option>
            <option value="error">Error (Failed)</option>
            <option value="running">Running</option>
          </select>

          {/* Span Type Filter */}
          <select
            value={spanTypeFilter}
            onChange={(e) => onSpanTypeFilterChange(e.target.value)}
            className="bg-[#0d111a] border border-[#1e2330] rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none font-mono cursor-pointer"
          >
            <option value="all">All Pipeline Spans</option>
            <option value="llm">Has LLM Calls</option>
            <option value="retrieval">Has Retrieval / RAG</option>
            <option value="tool">Has Tool Calls</option>
            <option value="agent">Has Agent Runs</option>
          </select>

          {/* Sort By Selector */}
          <div className="flex items-center gap-1 bg-[#0d111a] border border-[#1e2330] rounded-lg px-2.5 py-1 text-xs">
            <ArrowUpDown className="w-3 h-3 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => onSortByChange(e.target.value)}
              className="bg-transparent text-slate-300 font-mono text-xs focus:outline-none cursor-pointer"
            >
              <option value="newest" className="bg-[#0d111a]">Newest First</option>
              <option value="slowest" className="bg-[#0d111a]">Slowest (p95)</option>
              <option value="most_tokens" className="bg-[#0d111a]">Most Tokens</option>
              <option value="most_cost" className="bg-[#0d111a]">Most Expensive</option>
              <option value="most_spans" className="bg-[#0d111a]">Most Spans</option>
              <option value="error" className="bg-[#0d111a]">Errors First</option>
            </select>
          </div>
        </div>

        {/* Batch Actions */}
        {selectedBatch.size > 0 && (
          <div className="flex items-center gap-2 bg-indigo-950/60 border border-indigo-800/80 px-3 py-1 rounded-lg text-xs animate-in fade-in duration-150">
            <span className="font-mono text-indigo-300 font-medium">
              {selectedBatch.size} selected
            </span>
            <button
              onClick={handleBatchCompare}
              className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium flex items-center gap-1"
            >
              <GitCompare className="w-3 h-3" /> Compare
            </button>
            <button
              onClick={handleExportSelected}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1"
            >
              <Download className="w-3 h-3" /> Export
            </button>
            <button
              onClick={() => {
                setIsBatchDeleteModalOpen(true);
                setBatchDeleteConfirmText('');
                setDeleteStatus(null);
              }}
              className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-medium flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" /> Delete Selected
            </button>
          </div>
        )}
      </div>

      {/* Traces Data Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse text-xs select-text">
          <thead className="bg-[#0d111a] sticky top-0 z-10 border-b border-[#1e2330] text-[11px] font-mono text-slate-400">
            <tr>
              <th className="py-2.5 px-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={selectedBatch.size === traces.length && traces.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedBatch(new Set(traces.map(t => t.trace_id)));
                    } else {
                      setSelectedBatch(new Set());
                    }
                  }}
                  className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                />
              </th>
              <th className="py-2.5 px-3 w-20">Status</th>
              <th className="py-2.5 px-3">Trace Name & Prompt Preview</th>
              <th className="py-2.5 px-3 w-24">Duration</th>
              <th className="py-2.5 px-3 w-24">Spans</th>
              <th className="py-2.5 px-3">Models Used</th>
              <th className="py-2.5 px-3 w-24">Tokens</th>
              <th className="py-2.5 px-3 w-24">Spend</th>
              <th className="py-2.5 px-3 w-28 text-right">Age</th>
              <th className="py-2.5 px-3 w-12 text-center"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40">
            {traces.map((trace) => {
              const isSelected = selectedTraceId === trace.trace_id;
              const isChecked = selectedBatch.has(trace.trace_id);

              return (
                <tr
                  key={trace.trace_id}
                  onClick={() => onSelectTrace(trace.trace_id)}
                  className={`hover:bg-[#0f1422] transition-colors cursor-pointer group ${
                    isSelected ? 'bg-indigo-950/30' : ''
                  }`}
                >
                  <td className="py-2.5 px-3 text-center" onClick={(e) => toggleBatch(trace.trace_id, e)}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                    />
                  </td>

                  <td className="py-2.5 px-3">
                    <StatusBadge status={trace.status} size="sm" />
                  </td>

                  <td className="py-2.5 px-3 max-w-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-100 group-hover:text-indigo-400 transition-colors truncate">
                        {trace.name}
                      </span>
                      <button
                        onClick={(e) => handleCopy(trace.trace_id, e)}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-200 transition-opacity p-0.5"
                        title="Copy Trace ID"
                      >
                        {copiedId === trace.trace_id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                    {trace.preview_prompt && (
                      <p className="text-[11px] text-slate-400 truncate mt-0.5 font-sans">
                        {trace.preview_prompt}
                      </p>
                    )}
                  </td>

                  <td className="py-2.5 px-3 font-mono">
                    <span className={trace.duration_ms && trace.duration_ms > 3000 ? 'text-amber-400 font-semibold' : 'text-slate-200'}>
                      {formatDuration(trace.duration_ms)}
                    </span>
                  </td>

                  <td className="py-2.5 px-3 font-mono text-slate-300">
                    <div className="flex items-center gap-1">
                      <span>{trace.span_count}</span>
                      {trace.error_count > 0 && (
                        <span className="px-1 py-0.2 rounded bg-rose-950/60 text-rose-400 text-[10px] border border-rose-800/60">
                          {trace.error_count} err
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="py-2.5 px-3">
                    {trace.models && trace.models.length > 0 ? (
                      <div className="flex items-center gap-1 flex-wrap">
                        {trace.models.map(m => (
                          <span
                            key={m}
                            className="px-1.5 py-0.5 rounded bg-purple-950/60 text-purple-300 text-[10px] font-mono border border-purple-800/60"
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400 font-mono">--</span>
                    )}
                  </td>

                  <td className="py-2.5 px-3 font-mono text-slate-300">
                    {trace.tokens?.total ? formatNumber(trace.tokens.total) : '--'}
                  </td>

                  <td className="py-2.5 px-3 font-mono text-slate-300">
                    {formatCost(trace.estimated_cost)}
                  </td>

                  <td className="py-2.5 px-3 text-right font-mono text-slate-400 text-[11px]">
                    {formatRelativeTime(trace.start_time)}
                  </td>

                  <td className="py-2.5 px-2 text-center" onClick={(e) => handleDeleteSingle(trace.trace_id, e)}>
                    <button
                      className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 transition-opacity p-1"
                      title="Delete this trace"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Batch Delete Confirmation Modal */}
      {isBatchDeleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0d111a] border border-rose-900/80 rounded-xl p-5 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-rose-300 font-mono font-bold text-sm">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              <span>Delete {selectedBatch.size} Selected Traces</span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              This will permanently delete the {selectedBatch.size} selected execution traces and all their child spans. To confirm, type <strong className="text-white font-mono bg-rose-950 px-1.5 py-0.5 rounded border border-rose-800">delete selected</strong> below:
            </p>

            <div className="space-y-2">
              <input
                type="text"
                placeholder="Type 'delete selected' to confirm"
                value={batchDeleteConfirmText}
                onChange={(e) => setBatchDeleteConfirmText(e.target.value)}
                className="w-full bg-[#080b11] border border-rose-900 focus:border-rose-500 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none placeholder-slate-500"
                autoFocus
              />
            </div>

            {deleteStatus && (
              <p className="text-xs font-mono text-rose-400">{deleteStatus}</p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsBatchDeleteModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={batchDeleteConfirmText.trim().toLowerCase() !== 'delete selected'}
                onClick={handleBatchDelete}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-xs transition-colors"
              >
                Delete Selected Traces
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
