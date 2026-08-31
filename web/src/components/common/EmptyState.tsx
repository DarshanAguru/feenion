import React from 'react';
import { Terminal, Copy, Check, ExternalLink, Sparkles } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  showSnippet?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No telemetry data ingested yet',
  description = 'Connect your Python application, LLM pipeline, or LangChain / LlamaIndex agent to start observing executions in real time.',
  showSnippet = true,
}) => {
  const [copied, setCopied] = React.useState(false);
  const snippet = `# 1. Install Feenion
pip install feenion

# 2. Instrument in 2 lines of code
from feenion import trace, configure
configure(server_url="http://localhost:8000")

@trace
def generate_response(prompt: str):
    ...`;

  const handleCopy = () => {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 my-auto text-center max-w-lg mx-auto">
      <div className="w-12 h-12 rounded-xl bg-indigo-950/60 border border-indigo-800/50 flex items-center justify-center mb-4 text-indigo-400 shadow-lg shadow-indigo-950/40">
        <Sparkles className="w-6 h-6" />
      </div>

      <h3 className="text-base font-semibold text-slate-100 mb-1">{title}</h3>
      <p className="text-xs text-slate-400 mb-6 leading-relaxed">{description}</p>

      {showSnippet && (
        <div className="w-full text-left rounded-lg border border-[#1e2330] bg-[#090d16] overflow-hidden mb-4 shadow-xl">
          <div className="flex items-center justify-between px-3 py-1.5 bg-[#0d111a] border-b border-[#1e2330] text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-mono text-slate-300">Quickstart Setup</span>
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] transition-colors"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="p-3 text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed select-text">
            {snippet}
          </pre>
        </div>
      )}

      <div className="flex items-center gap-4 text-xs text-slate-400">
        <a
          href="https://github.com/feenion"
          target="_blank"
          rel="noreferrer"
          className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
        >
          View Documentation <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
};

