import React, { useEffect, useState } from 'react';
import { ModelStats } from '../../types';
import { apiClient } from '../../api/client';
import { MetricCard } from '../../components/common/MetricCard';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { formatNumber, formatDuration, formatCost } from '../../utils/formatters';
import { Sparkles, Bot, Coins, AlertCircle, ArrowUpRight, Cpu, Layers } from 'lucide-react';

export const LLMPage: React.FC = () => {
  const [models, setModels] = useState<ModelStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        setLoading(true);
        const data = await apiClient.getAnalyticsModels();
        setModels(data.models || []);
      } catch (err) {
        console.error('Failed to load LLM models:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchModels();
  }, []);

  if (loading) return <LoadingSkeleton rows={6} />;

  const totalRequests = models.reduce((acc, m) => acc + m.requests, 0);
  const totalTokens = models.reduce((acc, m) => acc + m.total_tokens, 0);
  const promptTokens = models.reduce((acc, m) => acc + m.prompt_tokens, 0);
  const completionTokens = models.reduce((acc, m) => acc + m.completion_tokens, 0);
  const totalCost = models.reduce((acc, m) => acc + m.total_cost, 0);

  const topModel = models.length > 0 ? models[0] : null;

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-[#080b11]">
      {/* Top Header Summary */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-mono font-bold text-slate-100 uppercase tracking-tight flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            LLM Model Observability & Token Analytics
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Compare model latency, prompt/completion token distributions, costs, and error rates.
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="LLM Invocations"
          value={formatNumber(totalRequests)}
          secondaryInfo={`${models.length} active models`}
          sparklineColor="#a855f7"
        />
        <MetricCard
          title="Total Tokens Processed"
          value={formatNumber(totalTokens)}
          secondaryInfo={`Prompt: ${formatNumber(promptTokens)} / Comp: ${formatNumber(completionTokens)}`}
          sparklineColor="#3b82f6"
        />
        <MetricCard
          title="Total Model Spend"
          value={formatCost(totalCost)}
          secondaryInfo={`Avg $${totalRequests > 0 ? (totalCost / totalRequests).toFixed(4) : '0.0000'}/req`}
          sparklineColor="#10b981"
        />
        <MetricCard
          title="Dominant Model"
          value={topModel ? topModel.model : '--'}
          secondaryInfo={topModel ? `${formatNumber(topModel.requests)} requests (${totalRequests > 0 ? Math.round((topModel.requests / totalRequests) * 100) : 0}%)` : ''}
          sparklineColor="#6366f1"
        />
      </div>

      {/* Model Comparison Table */}
      <div className="rounded-xl bg-[#0d111a] border border-[#1e2330] overflow-hidden shadow-lg">
        <div className="p-4 bg-[#090d16] border-b border-[#1e2330] flex items-center justify-between">
          <span className="text-xs font-mono uppercase text-slate-200 font-bold">
            Model Performance & Cost Matrix
          </span>
          <span className="text-xs font-mono text-slate-400">{models.length} Models Tracked</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead className="bg-[#080b11] border-b border-[#1e2330] text-[11px] text-slate-400">
              <tr>
                <th className="py-2.5 px-4">MODEL / PROVIDER</th>
                <th className="py-2.5 px-4">REQUESTS</th>
                <th className="py-2.5 px-4">p50 / p95 LATENCY</th>
                <th className="py-2.5 px-4">PROMPT TOKENS</th>
                <th className="py-2.5 px-4">COMPLETION TOKENS</th>
                <th className="py-2.5 px-4">TOTAL SPEND</th>
                <th className="py-2.5 px-4">AVG COST/REQ</th>
                <th className="py-2.5 px-4 text-right">ERROR RATE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2330]/50">
              {models.map(m => (
                <tr key={m.model} className="hover:bg-[#0f1422] transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-100">{m.model}</span>
                      <span className="px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 text-[10px] border border-purple-800 uppercase">
                        {m.provider}
                      </span>
                    </div>
                  </td>

                  <td className="py-3 px-4 text-slate-200 font-bold">
                    {formatNumber(m.requests)}
                  </td>

                  <td className="py-3 px-4 text-slate-300">
                    <span>{formatDuration(m.p50_latency)}</span>
                    <span className="text-slate-400 mx-1">/</span>
                    <span className={m.p95_latency > 3000 ? 'text-amber-400 font-bold' : 'text-slate-300'}>
                      {formatDuration(m.p95_latency)}
                    </span>
                  </td>

                  <td className="py-3 px-4 text-slate-300">
                    {formatNumber(m.prompt_tokens)}
                  </td>

                  <td className="py-3 px-4 text-slate-300">
                    {formatNumber(m.completion_tokens)}
                  </td>

                  <td className="py-3 px-4 text-emerald-400 font-bold">
                    {formatCost(m.total_cost)}
                  </td>

                  <td className="py-3 px-4 text-slate-300">
                    ${m.avg_cost_per_request.toFixed(4)}
                  </td>

                  <td className="py-3 px-4 text-right">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      m.error_rate > 0
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    }`}>
                      {m.error_rate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

