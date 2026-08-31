import React, { useState } from 'react';
import { SpanPayload } from '../../types';
import { formatDuration, formatCost, formatNumber, formatTimestamp } from '../../utils/formatters';
import { StatusBadge } from '../common/StatusBadge';
import { JsonViewer } from '../common/JsonViewer';
import {
  Sparkles,
  Search,
  Wrench,
  Bot,
  Activity,
  AlertCircle,
  Copy,
  Check,
  Clock,
  Coins,
  FileText,
  Terminal,
} from 'lucide-react';

interface SpanInspectorProps {
  span: SpanPayload | null;
}

export const SpanInspector: React.FC<SpanInspectorProps> = ({ span }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'input' | 'output' | 'attributes' | 'events' | 'error'>('overview');
  const [copiedId, setCopiedId] = useState(false);

  if (!span) {
    return (
      <div className="flex items-center justify-center h-full p-8 text-center text-slate-400 text-xs">
        Select a span in the timeline or tree to inspect execution details, I/O payloads, tokens, and errors.
      </div>
    );
  }

  const handleCopyId = () => {
    navigator.clipboard.writeText(span.span_id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const attributes = span.attributes || {};
  const metrics = span.metrics || {};
  const tokens = metrics.tokens || attributes.tokens || {};
  const promptTokens = tokens.prompt || attributes.prompt_tokens || 0;
  const completionTokens = tokens.completion || attributes.completion_tokens || 0;
  const totalTokens = promptTokens + completionTokens;
  const cost = metrics.cost || attributes.cost || 0.0;
  const modelName = attributes.model || metrics.model;

  return (
    <div className="flex flex-col h-full bg-[#080b11] border border-[#1e2330] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-[#0d111a] border-b border-[#1e2330]">
        <div className="flex items-center gap-2 min-w-0">
          <StatusBadge status={span.status} size="sm" />
          <span className="font-mono text-xs font-bold text-slate-100 truncate">
            {span.name}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-300 uppercase">
            {span.span_type}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyId}
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono transition-colors"
            title="Copy Span ID"
          >
            {copiedId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {span.span_id.slice(0, 8)}...
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 px-3 py-1.5 bg-[#090d16] border-b border-[#1e2330] overflow-x-auto select-none">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-2.5 py-1 rounded text-xs font-sans font-medium transition-colors ${
            activeTab === 'overview'
              ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/50'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('input')}
          className={`px-2.5 py-1 rounded text-xs font-sans font-medium transition-colors ${
            activeTab === 'input'
              ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/50'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Input
        </button>
        <button
          onClick={() => setActiveTab('output')}
          className={`px-2.5 py-1 rounded text-xs font-sans font-medium transition-colors ${
            activeTab === 'output'
              ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/50'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Output
        </button>
        <button
          onClick={() => setActiveTab('attributes')}
          className={`px-2.5 py-1 rounded text-xs font-sans font-medium transition-colors ${
            activeTab === 'attributes'
              ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/50'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Attributes
        </button>
        <button
          onClick={() => setActiveTab('events')}
          className={`px-2.5 py-1 rounded text-xs font-sans font-medium transition-colors ${
            activeTab === 'events'
              ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/50'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Events ({span.events?.length || 0})
        </button>
        {span.error && (
          <button
            onClick={() => setActiveTab('error')}
            className={`px-2.5 py-1 rounded text-xs font-sans font-medium transition-colors flex items-center gap-1 ${
              activeTab === 'error'
                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                : 'text-rose-400 hover:text-rose-300'
            }`}
          >
            <AlertCircle className="w-3 h-3" /> Error
          </button>
        )}
      </div>

      {/* Tab Contents */}
      <div className="flex-1 p-3 overflow-y-auto">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2.5 rounded bg-[#0d111a] border border-[#1e2330]">
                <span className="text-[10px] uppercase font-mono text-slate-400 block mb-1">Duration</span>
                <span className="text-sm font-bold font-mono text-slate-100">{formatDuration(span.duration_ms)}</span>
              </div>
              <div className="p-2.5 rounded bg-[#0d111a] border border-[#1e2330]">
                <span className="text-[10px] uppercase font-mono text-slate-400 block mb-1">Total Tokens</span>
                <span className="text-sm font-bold font-mono text-slate-100">{totalTokens > 0 ? formatNumber(totalTokens) : '--'}</span>
              </div>
              <div className="p-2.5 rounded bg-[#0d111a] border border-[#1e2330]">
                <span className="text-[10px] uppercase font-mono text-slate-400 block mb-1">Estimated Cost</span>
                <span className="text-sm font-bold font-mono text-slate-100">{cost > 0 ? formatCost(cost) : '$0.00'}</span>
              </div>
              <div className="p-2.5 rounded bg-[#0d111a] border border-[#1e2330]">
                <span className="text-[10px] uppercase font-mono text-slate-400 block mb-1">Start Time</span>
                <span className="text-xs font-mono text-slate-300">{formatTimestamp(span.start_time)}</span>
              </div>
            </div>

            {/* Specialized LLM View */}
            {span.span_type === 'llm' && (
              <div className="p-3 rounded-lg bg-[#0d111a] border border-purple-900/40 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-300">
                    <Sparkles className="w-4 h-4 text-purple-400" /> LLM Generation Context
                  </div>
                  {modelName && (
                    <span className="px-2 py-0.5 rounded bg-purple-950 border border-purple-800 text-purple-200 text-xs font-mono">
                      {modelName}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono text-slate-300 pt-1">
                  <div>Prompt Tokens: <span className="text-white font-semibold">{formatNumber(promptTokens)}</span></div>
                  <div>Completion Tokens: <span className="text-white font-semibold">{formatNumber(completionTokens)}</span></div>
                  {attributes.temperature !== undefined && (
                    <div>Temperature: <span className="text-white font-semibold">{attributes.temperature}</span></div>
                  )}
                  {attributes.finish_reason && (
                    <div>Finish Reason: <span className="text-white font-semibold">{attributes.finish_reason}</span></div>
                  )}
                </div>
              </div>
            )}

            {/* Specialized Retrieval View */}
            {span.span_type === 'retrieval' && (
              <div className="p-3 rounded-lg bg-[#0d111a] border border-amber-900/40 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                    <Search className="w-4 h-4 text-amber-400" /> Vector & Document Retrieval
                  </div>
                </div>
                <div className="text-xs font-mono text-slate-300">
                  <p className="text-slate-400 mb-1">Retrieved Content Summary:</p>
                  <div className="p-2 rounded bg-[#090d16] border border-slate-800 text-slate-200">
                    {typeof span.output === 'object' ? JSON.stringify(span.output).slice(0, 160) + '...' : String(span.output || 'No output recorded')}
                  </div>
                </div>
              </div>
            )}

            {/* Specialized Tool View */}
            {span.span_type === 'tool' && (
              <div className="p-3 rounded-lg bg-[#0d111a] border border-cyan-900/40 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-300">
                    <Wrench className="w-4 h-4 text-cyan-400" /> Tool Invocation: {span.name}
                  </div>
                </div>
                <div className="text-xs text-slate-300 space-y-1">
                  <div>Duration: <span className="font-mono text-white">{formatDuration(span.duration_ms)}</span></div>
                </div>
              </div>
            )}

            {/* Error Banner if error exists */}
            {span.error && (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-300">
                  <AlertCircle className="w-4 h-4 text-rose-400" /> {span.error.error_type || 'Execution Error'}
                </div>
                <p className="text-xs text-rose-200 font-mono">{span.error.message || 'No error message provided'}</p>
              </div>
            )}

            {/* Quick Preview of Input / Output */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase font-mono mb-1 block">Input Payload</span>
                <JsonViewer data={span.input} maxInitialLength={1500} />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase font-mono mb-1 block">Output Payload</span>
                <JsonViewer data={span.output} maxInitialLength={1500} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'input' && <JsonViewer data={span.input} title="Input Payload" />}
        {activeTab === 'output' && <JsonViewer data={span.output} title="Output Payload" />}
        {activeTab === 'attributes' && <JsonViewer data={span.attributes} title="Attributes & Context" />}

        {activeTab === 'events' && (
          <div className="space-y-2">
            {span.events && span.events.length > 0 ? (
              span.events.map((ev, idx) => (
                <div key={idx} className="p-2.5 rounded bg-[#0d111a] border border-[#1e2330]">
                  <div className="flex items-center justify-between text-xs font-mono mb-1">
                    <span className="text-indigo-400 font-semibold">{ev.event_type}</span>
                    <span className="text-slate-400 text-[10px]">{formatTimestamp(ev.timestamp)}</span>
                  </div>
                  <pre className="text-[11px] text-slate-300 font-mono whitespace-pre-wrap">
                    {JSON.stringify(ev.payload, null, 2)}
                  </pre>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 text-center py-6">No custom events emitted for this span.</p>
            )}
          </div>
        )}

        {activeTab === 'error' && span.error && (
          <div className="space-y-3">
            <div className="p-3 rounded bg-rose-950/40 border border-rose-800">
              <h4 className="text-xs font-bold text-rose-300 mb-1">{span.error.error_type || 'Error'}</h4>
              <p className="text-xs font-mono text-rose-200">{span.error.message}</p>
            </div>
            {span.error.stack_trace && (
              <div>
                <span className="text-xs font-mono text-slate-400 mb-1 block">Stack Trace</span>
                <pre className="p-3 rounded bg-[#090d16] border border-slate-800 text-xs font-mono text-rose-300/90 whitespace-pre-wrap select-text">
                  {span.error.stack_trace}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

