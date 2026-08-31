import React, { useState, useMemo } from 'react';
import { Copy, Check, Search, ChevronRight, ChevronDown, Maximize2, Minimize2 } from 'lucide-react';

interface JsonViewerProps {
  data: any;
  title?: string;
  maxInitialLength?: number;
  defaultExpanded?: boolean;
}

export const JsonViewer: React.FC<JsonViewerProps> = ({
  data,
  title,
  maxInitialLength = 5000,
  defaultExpanded = true,
}) => {
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState('');
  const [isTruncatedExpanded, setIsTruncatedExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'formatted' | 'raw'>('formatted');

  const rawString = useMemo(() => {
    if (data === null || data === undefined) return 'null';
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return data;
      }
    }
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }, [data]);

  const handleCopy = () => {
    navigator.clipboard.writeText(rawString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isLarge = rawString.length > maxInitialLength;
  const displayedContent = isLarge && !isTruncatedExpanded
    ? rawString.slice(0, maxInitialLength)
    : rawString;

  return (
    <div className="flex flex-col rounded-lg border border-[#1e2330] bg-[#090d16] text-xs font-mono overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-[#0d111a] border-b border-[#1e2330] select-none">
        <div className="flex items-center gap-2">
          {title && <span className="font-semibold text-slate-300 font-sans text-xs">{title}</span>}
          <div className="flex items-center rounded bg-slate-800/80 p-0.5 border border-slate-700">
            <button
              onClick={() => setActiveTab('formatted')}
              className={`px-2 py-0.5 rounded text-[10px] font-sans ${activeTab === 'formatted' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              JSON
            </button>
            <button
              onClick={() => setActiveTab('raw')}
              className={`px-2 py-0.5 rounded text-[10px] font-sans ${activeTab === 'raw' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Raw
            </button>
          </div>
          <span className="text-[10px] text-slate-400">
            ({(rawString.length / 1024).toFixed(1)} KB)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3 h-3 text-slate-400 absolute left-2 top-2" />
            <input
              type="text"
              placeholder="Find in payload..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-6 pr-2 py-1 text-[11px] rounded bg-[#080b11] border border-slate-700 text-slate-200 placeholder-slate-400 focus:outline-none focus:border-indigo-500 w-36"
            />
          </div>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Copy payload"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span className="text-[11px] font-sans">{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      <div className="relative p-3 overflow-x-auto max-h-[380px] select-text">
        <pre className="text-slate-300 leading-relaxed whitespace-pre-wrap break-words font-mono text-[11px]">
          {displayedContent}
        </pre>

        {isLarge && (
          <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-sans">
            <span>
              Showing {isTruncatedExpanded ? rawString.length.toLocaleString() : maxInitialLength.toLocaleString()} of {rawString.length.toLocaleString()} characters
            </span>
            <button
              onClick={() => setIsTruncatedExpanded(!isTruncatedExpanded)}
              className="text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 cursor-pointer"
            >
              {isTruncatedExpanded ? (
                <>
                  <Minimize2 className="w-3 h-3" /> Collapse to {maxInitialLength} chars
                </>
              ) : (
                <>
                  <Maximize2 className="w-3 h-3" /> Expand Full Payload
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

