import React, { useEffect, useState } from 'react';
import { AnalyticsOverview } from '../../types';
import { apiClient } from '../../api/client';
import { MetricCard } from '../../components/common/MetricCard';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { formatDuration } from '../../utils/formatters';
import { Gauge, Clock, Layers, Sparkles, Search, Wrench, AlertTriangle, ArrowRight } from 'lucide-react';

interface PerformancePageProps {
  onSelectTrace: (traceId: string) => void;
}

export const PerformancePage: React.FC<PerformancePageProps> = ({ onSelectTrace }) => {
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPerf = async () => {
      try {
        setLoading(true);
        const data = await apiClient.getAnalyticsOverview('24h', 'all');
        setAnalytics(data);
      } catch (err) {
        console.error('Failed to fetch performance analytics:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPerf();
  }, []);

  if (loading) return <LoadingSkeleton rows={6} />;
  if (!analytics) return null;

  const { latency_percentiles, kpis, time_breakdown } = analytics;

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-[#080b11]">
      <div>
        <h2 className="text-base font-mono font-bold text-slate-100 uppercase tracking-tight flex items-center gap-2">
          <Gauge className="w-5 h-5 text-indigo-400" />
          Latency & Pipeline Performance Intelligence
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Detailed percentile distributions, critical path breakdown, and latency regression detection.
        </p>
      </div>

      {/* Percentiles Matrix */}
      <div className="rounded-xl bg-[#0d111a] border border-[#1e2330] p-5 shadow-lg space-y-4">
        <span className="text-xs font-mono uppercase text-slate-200 font-bold block">
          End-to-End Latency Percentiles (p50 → p99)
        </span>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3.5 rounded-lg bg-[#080b11] border border-slate-800 text-center">
            <span className="text-[11px] font-mono uppercase text-slate-400 block mb-1">p50 (Median)</span>
            <span className="text-lg font-bold font-mono text-slate-100">{formatDuration(latency_percentiles.p50)}</span>
          </div>

          <div className="p-3.5 rounded-lg bg-[#080b11] border border-slate-800 text-center">
            <span className="text-[11px] font-mono uppercase text-slate-400 block mb-1">p75</span>
            <span className="text-lg font-bold font-mono text-slate-100">{formatDuration(latency_percentiles.p75)}</span>
          </div>

          <div className="p-3.5 rounded-lg bg-[#080b11] border border-slate-800 text-center">
            <span className="text-[11px] font-mono uppercase text-slate-400 block mb-1">p90</span>
            <span className="text-lg font-bold font-mono text-slate-100">{formatDuration(latency_percentiles.p90)}</span>
          </div>

          <div className="p-3.5 rounded-lg bg-[#080b11] border border-amber-900/60 text-center">
            <span className="text-[11px] font-mono uppercase text-amber-400 block mb-1">p95 (SLA Target)</span>
            <span className="text-lg font-bold font-mono text-amber-300">{formatDuration(latency_percentiles.p95)}</span>
          </div>

          <div className="p-3.5 rounded-lg bg-[#080b11] border border-rose-900/60 text-center">
            <span className="text-[11px] font-mono uppercase text-rose-400 block mb-1">p99 (Tail)</span>
            <span className="text-lg font-bold font-mono text-rose-300">{formatDuration(latency_percentiles.p99)}</span>
          </div>
        </div>
      </div>

      {/* Component Specific Latency */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-[#0d111a] border border-[#1e2330] shadow-lg space-y-2">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-purple-300">
            <Sparkles className="w-4 h-4 text-purple-400" />
            LLM p95 Latency
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {formatDuration(latency_percentiles.llm_p95)}
          </div>
          <p className="text-[11px] text-slate-400 font-mono">
            {time_breakdown.llm_pct}% of total request time
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[#0d111a] border border-[#1e2330] shadow-lg space-y-2">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-300">
            <Search className="w-4 h-4 text-amber-400" />
            Retrieval p95 Latency
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {formatDuration(latency_percentiles.retrieval_p95)}
          </div>
          <p className="text-[11px] text-slate-400 font-mono">
            {time_breakdown.retrieval_pct}% of total request time
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[#0d111a] border border-[#1e2330] shadow-lg space-y-2">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-cyan-300">
            <Wrench className="w-4 h-4 text-cyan-400" />
            Tool p95 Latency
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {formatDuration(latency_percentiles.tool_p95)}
          </div>
          <p className="text-[11px] text-slate-400 font-mono">
            {time_breakdown.tools_pct}% of total request time
          </p>
        </div>
      </div>
    </div>
  );
};

