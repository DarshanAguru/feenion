import React from 'react';
import { AnalyticsOverview, NavigationTab } from '../../types';
import { MetricCard } from '../../components/common/MetricCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { TimeSeriesChart } from '../../components/charts/TimeSeriesChart';
import { BreakdownBar } from '../../components/charts/BreakdownBar';
import { EmptyState } from '../../components/common/EmptyState';
import { formatNumber, formatDuration, formatCost } from '../../utils/formatters';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Search,
  Wrench,
  Bot,
  Zap,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';

interface OverviewPageProps {
  analytics: AnalyticsOverview | null;
  onNavigate: (tab: NavigationTab, filters?: Record<string, any>) => void;
  onSelectTrace: (traceId: string) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  analytics,
  onNavigate,
  onSelectTrace,
}) => {
  if (!analytics || analytics.counts.traces === 0) {
    return <EmptyState />;
  }

  const { health, kpis, what_changed, traffic_series, latency_percentiles, time_breakdown, counts } = analytics;

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-6">
      {/* Top Banner: Health Score & Executive Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* System Health Score Card */}
        <div className="lg:col-span-4 p-5 rounded-xl bg-gradient-to-br from-[#0d111a] to-[#090d16] border border-[#1e2330] flex flex-col justify-between shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-mono uppercase text-slate-300 font-semibold tracking-wider">
                System Health
              </span>
            </div>
            <StatusBadge status={health.status} size="sm" />
          </div>

          <div className="flex items-baseline gap-3 my-2">
            <div className="text-4xl font-bold font-mono text-white tracking-tight">
              {health.score}
            </div>
            <span className="text-slate-400 font-mono text-sm">/ 100</span>
            <div className="text-xs text-slate-400 font-mono ml-auto">
              Prev: {health.prev_score} ({health.score >= health.prev_score ? `+${health.score - health.prev_score}` : `${health.score - health.prev_score}`})
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-800/60 space-y-1 text-xs text-slate-300">
            <span className="text-[10px] uppercase font-mono text-slate-400 font-semibold block mb-1">
              Primary Factors:
            </span>
            {health.factors.map((f, idx) => (
              <div key={idx} className="flex items-center gap-1.5 text-[11px] text-slate-300">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* "What Changed?" Intelligence Card */}
        <div className="lg:col-span-8 p-5 rounded-xl bg-[#0d111a] border border-[#1e2330] flex flex-col justify-between shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-mono uppercase text-slate-300 font-semibold tracking-wider">
                What Changed vs Previous Period
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">Automated Anomaly Attribution</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1">
            {what_changed.slice(0, 2).map((item, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg bg-[#090d16] border border-[#1e2330] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-xs font-bold text-slate-200">{item.metric}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${
                        item.severity === 'danger'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : item.severity === 'warning'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      }`}
                    >
                      {item.direction === 'up' ? `↑ ${item.change}` : item.direction === 'down' ? `↓ ${item.change}` : 'Stable'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mb-2 leading-relaxed">{item.summary}</p>
                  <p className="text-[11px] text-slate-400 font-mono">
                    <span className="text-slate-400 font-medium">Main contributor:</span> {item.contributor}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-800/60 flex justify-end">
                  <button
                    onClick={() => onNavigate('traces', item.filter_link)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 cursor-pointer"
                  >
                    Investigate <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 6 Executive Health KPIs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-mono uppercase text-slate-400 font-semibold tracking-wider">
            AI System Health & Key Performance Indicators
          </h3>
          <span className="text-xs text-slate-400">Click any card to inspect traces</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <MetricCard
            title="Requests"
            value={formatNumber(kpis.requests.value)}
            delta={kpis.requests.delta}
            sparklineData={traffic_series.map(t => t.total)}
            sparklineColor="#6366f1"
            onInvestigate={() => onNavigate('traces')}
            tooltip="Total completed AI execution traces in window"
          />
          <MetricCard
            title="Error Rate"
            value={`${kpis.error_rate.value}%`}
            delta={kpis.error_rate.delta}
            sparklineData={traffic_series.map(t => t.error)}
            sparklineColor="#f43f5e"
            status={kpis.error_rate.value > 2 ? 'degraded' : kpis.error_rate.value > 0 ? 'warning' : 'healthy'}
            onInvestigate={() => onNavigate('errors')}
            tooltip="Percentage of executions that failed or timed out"
          />
          <MetricCard
            title="p50 Latency"
            value={formatDuration(kpis.p50_latency.value)}
            delta={kpis.p50_latency.delta}
            sparklineData={[kpis.p50_latency.prev, kpis.p50_latency.value]}
            sparklineColor="#38bdf8"
            onInvestigate={() => onNavigate('performance')}
            tooltip="Median execution latency for requests"
          />
          <MetricCard
            title="p95 Latency"
            value={formatDuration(kpis.p95_latency.value)}
            delta={kpis.p95_latency.delta}
            sparklineData={[kpis.p95_latency.prev, kpis.p95_latency.value]}
            sparklineColor="#eab308"
            status={kpis.p95_latency.value > 4000 ? 'warning' : 'healthy'}
            onInvestigate={() => onNavigate('performance')}
            tooltip="95th percentile latency bottleneck indicator"
          />
          <MetricCard
            title="LLM Spend"
            value={formatCost(kpis.llm_cost.value)}
            delta={kpis.llm_cost.delta}
            sparklineData={[kpis.llm_cost.prev, kpis.llm_cost.value]}
            sparklineColor="#a855f7"
            onInvestigate={() => onNavigate('costs')}
            tooltip="Total estimated model inference spend"
          />
          <MetricCard
            title="Token Usage"
            value={formatNumber(kpis.total_tokens.value)}
            delta={kpis.total_tokens.delta}
            sparklineData={[kpis.total_tokens.prev, kpis.total_tokens.value]}
            sparklineColor="#3b82f6"
            onInvestigate={() => onNavigate('llm')}
            tooltip="Aggregate prompt and completion tokens"
          />
        </div>
      </div>

      {/* Traffic & AI Latency Decomposition */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Requests over time chart */}
        <div className="lg:col-span-7 p-4 rounded-xl bg-[#0d111a] border border-[#1e2330] flex flex-col justify-between shadow-lg">
          <TimeSeriesChart data={traffic_series} height={190} />
        </div>

        {/* Latency Percentiles & Pipeline Decomposition */}
        <div className="lg:col-span-5 p-4 rounded-xl bg-[#0d111a] border border-[#1e2330] flex flex-col justify-between shadow-lg space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono uppercase text-slate-300 font-semibold tracking-wider">
                Latency Distribution (Percentiles)
              </span>
              <button
                onClick={() => onNavigate('performance')}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-mono flex items-center gap-1"
              >
                Deep Dive <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="grid grid-cols-5 gap-2 text-center">
              <div className="p-2 rounded bg-[#090d16] border border-slate-800">
                <span className="text-[10px] text-slate-400 font-mono block">p50</span>
                <span className="text-xs font-bold font-mono text-slate-100">{formatDuration(latency_percentiles.p50)}</span>
              </div>
              <div className="p-2 rounded bg-[#090d16] border border-slate-800">
                <span className="text-[10px] text-slate-400 font-mono block">p75</span>
                <span className="text-xs font-bold font-mono text-slate-100">{formatDuration(latency_percentiles.p75)}</span>
              </div>
              <div className="p-2 rounded bg-[#090d16] border border-slate-800">
                <span className="text-[10px] text-slate-400 font-mono block">p90</span>
                <span className="text-xs font-bold font-mono text-slate-100">{formatDuration(latency_percentiles.p90)}</span>
              </div>
              <div className="p-2 rounded bg-[#090d16] border border-amber-900/40">
                <span className="text-[10px] text-amber-400 font-mono block">p95</span>
                <span className="text-xs font-bold font-mono text-amber-300">{formatDuration(latency_percentiles.p95)}</span>
              </div>
              <div className="p-2 rounded bg-[#090d16] border border-rose-900/40">
                <span className="text-[10px] text-rose-400 font-mono block">p99</span>
                <span className="text-xs font-bold font-mono text-rose-300">{formatDuration(latency_percentiles.p99)}</span>
              </div>
            </div>
          </div>

          <BreakdownBar
            llmMs={time_breakdown.llm_ms}
            llmPct={time_breakdown.llm_pct}
            retrievalMs={time_breakdown.retrieval_ms}
            retrievalPct={time_breakdown.retrieval_pct}
            toolsMs={time_breakdown.tools_ms}
            toolsPct={time_breakdown.tools_pct}
            otherMs={time_breakdown.other_ms}
            otherPct={time_breakdown.other_pct}
          />
        </div>
      </div>
    </div>
  );
};

