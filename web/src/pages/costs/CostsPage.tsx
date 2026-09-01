import React, { useEffect, useState } from 'react';
import { ModelStats } from '../../types';
import { apiClient } from '../../api/client';
import { MetricCard } from '../../components/common/MetricCard';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { formatCost, formatNumber } from '../../utils/formatters';
import { Coins, TrendingUp, Sparkles, DollarSign, Calculator, AlertTriangle, ArrowRight } from 'lucide-react';

export const CostsPage: React.FC = () => {
  const [models, setModels] = useState<ModelStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCostData = async () => {
      try {
        setLoading(true);
        const data = await apiClient.getAnalyticsModels();
        setModels(data.models || []);
      } catch (err) {
        console.error('Failed to load cost analytics:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCostData();
  }, []);

  if (loading) return <LoadingSkeleton rows={6} />;

  const totalCost = models.reduce((acc, m) => acc + m.total_cost, 0);
  const totalTokens = models.reduce((acc, m) => acc + m.total_tokens, 0);
  const totalRequests = models.reduce((acc, m) => acc + m.requests, 0);
  const avgCostPer1k = totalTokens > 0 ? (totalCost / totalTokens) * 1000 : 0;

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-[#080b11]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-mono font-bold text-slate-100 uppercase tracking-tight flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-400" />
            Cost & Model Spend Analytics
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Track spend anomalies, cost per request, and model allocation breakdowns.
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total AI Spend"
          value={formatCost(totalCost)}
          secondaryInfo="All models combined"
          sparklineColor="#10b981"
        />
        <MetricCard
          title="Avg Cost / Request"
          value={formatCost(totalRequests > 0 ? totalCost / totalRequests : 0)}
          secondaryInfo="Across all endpoints"
          sparklineColor="#3b82f6"
        />
        <MetricCard
          title="Effective Cost / 1k Tokens"
          value={formatCost(avgCostPer1k)}
          secondaryInfo="Blended rate"
          sparklineColor="#eab308"
        />
        <MetricCard
          title="Cost Efficiency"
          value={totalRequests > 0 ? 'Optimal' : 'N/A'}
          secondaryInfo="Zero runaway recursive loops"
          sparklineColor="#a855f7"
        />
      </div>

      {/* Cost Breakdown by Model */}
      <div className="rounded-xl bg-[#0d111a] border border-[#1e2330] p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono uppercase text-slate-200 font-bold">
            Spend Distribution by Model
          </span>
          <span className="text-xs font-mono text-emerald-400 font-bold">{formatCost(totalCost)} Total</span>
        </div>

        {/* Proportional Spend Bars */}
        <div className="space-y-3">
          {models.map(m => {
            const pct = totalCost > 0 ? (m.total_cost / totalCost) * 100 : 0;
            return (
              <div key={m.model} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-100">{m.model}</span>
                    <span className="text-slate-400">({formatNumber(m.requests)} requests)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-400 font-bold">{formatCost(m.total_cost)}</span>
                    <span className="text-slate-400 text-[11px] w-12 text-right">{pct.toFixed(1)}%</span>
                  </div>
                </div>

                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    style={{ width: `${Math.max(1, pct)}%` }}
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

