import React, { useState, useEffect, useRef } from 'react';
import { NavigationTab, TraceSummary, ErrorGroup } from '../../types';
import {
  Search,
  Layers,
  AlertOctagon,
  Sparkles,
  Bot,
  Wrench,
  Gauge,
  Coins,
  Settings,
  LayoutDashboard,
  ShieldAlert,
  ArrowRight,
  X,
  Cpu,
  Database,
  Terminal,
} from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: NavigationTab) => void;
  onSelectTrace: (traceId: string) => void;
  traces: TraceSummary[];
  errors: ErrorGroup[];
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onSelectTrace,
  traces,
  errors,
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const q = query.toLowerCase().trim();

  const navCommands: Array<{ id: NavigationTab; label: string; keywords: string; icon: React.ReactNode }> = [
    { id: 'overview', label: 'Go to Overview Dashboard', keywords: 'home health status p95 cost rate', icon: <LayoutDashboard className="w-4 h-4 text-indigo-400" /> },
    { id: 'traces', label: 'Go to Traces Explorer', keywords: 'waterfall timeline flamegraph requests dag spans', icon: <Layers className="w-4 h-4 text-sky-400" /> },
    { id: 'errors', label: 'Go to Error Intelligence', keywords: 'exceptions failures crashes bugs stacktrace fingerprints', icon: <AlertOctagon className="w-4 h-4 text-rose-400" /> },
    { id: 'llm', label: 'Go to LLM Analytics & Models', keywords: 'models openai anthropic gpt-4o claude gemini tokens pricing', icon: <Sparkles className="w-4 h-4 text-purple-400" /> },
    { id: 'agents', label: 'Go to Agent Analytics', keywords: 'multi-agent loops reasoning plans steps autonomous', icon: <Bot className="w-4 h-4 text-emerald-400" /> },
    { id: 'retrieval', label: 'Go to Retrieval & RAG Analytics', keywords: 'vector embeddings chunks top_k similarity semantic search', icon: <Search className="w-4 h-4 text-amber-400" /> },
    { id: 'tools', label: 'Go to Tool & Function Call Analytics', keywords: 'functions api database sql tools web search', icon: <Wrench className="w-4 h-4 text-cyan-400" /> },
    { id: 'performance', label: 'Go to Performance & Latency Analytics', keywords: 'duration p50 p95 p99 bottlenecks slow waterfall', icon: <Gauge className="w-4 h-4 text-blue-400" /> },
    { id: 'costs', label: 'Go to Cost & Economics', keywords: 'spending budget token economics dollars price', icon: <Coins className="w-4 h-4 text-emerald-400" /> },
    { id: 'incident', label: 'Go to Incident Response Mode', keywords: 'incident outage triage alert degradation emergency', icon: <ShieldAlert className="w-4 h-4 text-amber-400" /> },
    { id: 'settings', label: 'Go to Workspace Settings & API Keys', keywords: 'projects api keys purge retention admin config', icon: <Settings className="w-4 h-4 text-slate-400" /> },
  ];

  const filteredNav = q
    ? navCommands.filter(c => c.label.toLowerCase().includes(q) || c.keywords.includes(q))
    : navCommands.slice(0, 6);

  // Search traces by ID, name, models, tools, environment, preview prompt
  const filteredTraces = q
    ? traces.filter(t => {
        const idMatch = t.trace_id.toLowerCase().includes(q) || t.trace_id.replace(/-/g, '').includes(q.replace(/-/g, ''));
        const nameMatch = t.name.toLowerCase().includes(q);
        const envMatch = (t.environment || '').toLowerCase().includes(q);
        const modelMatch = (t.models || []).some(m => m.toLowerCase().includes(q));
        const promptMatch = (t.preview_prompt || '').toLowerCase().includes(q);
        return idMatch || nameMatch || envMatch || modelMatch || promptMatch;
      }).slice(0, 5)
    : [];

  // Search errors by type, message, fingerprint, sample span name
  const filteredErrors = q
    ? errors.filter(e => {
        const typeMatch = e.error_type.toLowerCase().includes(q);
        const msgMatch = e.message.toLowerCase().includes(q);
        const spanMatch = e.sample_span_name.toLowerCase().includes(q);
        const fpMatch = e.fingerprint.toLowerCase().includes(q);
        return typeMatch || msgMatch || spanMatch || fpMatch;
      }).slice(0, 4)
    : [];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center pt-16 p-4">
      <div className="bg-[#0d111a] border border-[#1e2330] rounded-xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search Input */}
        <div className="flex items-center px-4 py-3.5 border-b border-[#1e2330] gap-3 bg-[#090d16]">
          <Search className="w-4 h-4 text-indigo-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search traces (by ID, model, prompt), errors, tools, pages..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-400 focus:outline-none font-sans"
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
            }}
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-slate-400 hover:text-slate-200 text-xs">
              Clear
            </button>
          )}
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="p-2 overflow-y-auto space-y-4 flex-1">
          {/* Traces Section */}
          {filteredTraces.length > 0 && (
            <div>
              <span className="text-[10px] font-mono font-bold uppercase text-indigo-400 px-2 block mb-1">
                Matching Execution Traces ({filteredTraces.length})
              </span>
              <div className="space-y-1">
                {filteredTraces.map(t => (
                  <button
                    key={t.trace_id}
                    onClick={() => {
                      onSelectTrace(t.trace_id);
                      onNavigate('traces');
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg bg-[#090d16] border border-[#1e2330] hover:border-indigo-500 hover:bg-slate-800/70 transition-all text-left group"
                  >
                    <div className="flex items-center gap-2.5 truncate flex-1 min-w-0">
                      <Layers className="w-4 h-4 text-indigo-400 shrink-0" />
                      <div className="truncate">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-white font-bold truncate">{t.name}</span>
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${t.status === 'error' ? 'bg-rose-950 text-rose-300' : 'bg-emerald-950 text-emerald-300'}`}>
                            {t.status}
                          </span>
                        </div>
                        {t.preview_prompt && (
                          <p className="text-[11px] text-slate-400 truncate mt-0.5 font-sans">
                            {t.preview_prompt}
                          </p>
                        )}
                        {t.models && t.models.length > 0 && (
                          <div className="flex items-center gap-1 mt-1">
                            {t.models.map(m => (
                              <span key={m} className="px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 text-[9px] font-mono border border-purple-800">
                                {m}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 ml-3 shrink-0 group-hover:text-indigo-300">
                      {t.trace_id.slice(0, 8)}...
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Errors Section */}
          {filteredErrors.length > 0 && (
            <div>
              <span className="text-[10px] font-mono font-bold uppercase text-rose-400 px-2 block mb-1">
                Matching Errors ({filteredErrors.length})
              </span>
              <div className="space-y-1">
                {filteredErrors.map(err => (
                  <button
                    key={err.fingerprint}
                    onClick={() => {
                      onNavigate('errors');
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg bg-rose-950/20 border border-rose-900/50 hover:border-rose-500 hover:bg-rose-950/40 transition-all text-left"
                  >
                    <div className="flex items-center gap-2.5 truncate flex-1 min-w-0">
                      <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
                      <div className="truncate">
                        <span className="text-xs font-mono text-rose-300 font-bold block">{err.error_type}</span>
                        <p className="text-[11px] text-slate-300 truncate mt-0.5">{err.message}</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-rose-900/80 text-rose-200 text-[10px] font-mono font-bold ml-2 shrink-0">
                      {err.count}x
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Navigation Section */}
          {filteredNav.length > 0 && (
            <div>
              <span className="text-[10px] font-mono font-bold uppercase text-slate-400 px-2 block mb-1">
                {q ? 'Navigation & Analytics' : 'Quick Navigation'}
              </span>
              <div className="space-y-0.5">
                {filteredNav.map(nav => (
                  <button
                    key={nav.id}
                    onClick={() => {
                      onNavigate(nav.id);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-slate-800/70 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      {nav.icon}
                      <span>{nav.label}</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {q && filteredTraces.length === 0 && filteredErrors.length === 0 && filteredNav.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-400">
              No matching traces, errors, or commands found for &ldquo;{query}&rdquo;.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-[#090d16] border-t border-[#1e2330] flex items-center justify-between text-[11px] text-slate-400">
          <span>Search models (e.g. &ldquo;gpt-4o&rdquo;), tools, trace IDs, or prompt text</span>
          <span className="font-mono">ESC to close</span>
        </div>
      </div>
    </div>
  );
};
