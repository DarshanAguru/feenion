import React, { useEffect, useState } from 'react';
import { RetrievalStats } from '../../types';
import { apiClient } from '../../api/client';
import { MetricCard } from '../../components/common/MetricCard';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatDuration, formatTimestamp } from '../../utils/formatters';
import { Search, Database, AlertCircle, CheckCircle, Clock, FileText, ArrowRight } from 'lucide-react';

interface RetrievalPageProps {
  onSelectTrace: (traceId: string) => void;
  selectedProject?: string;
  timeRange?: string;
  environment?: string;
  refreshKey?: number;
}

export const RetrievalPage: React.FC<RetrievalPageProps> = ({
  onSelectTrace,
  selectedProject,
  timeRange,
  environment,
  refreshKey,
}) => {
  const [stats, setStats] = useState<RetrievalStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRetrieval = async () => {
      try {
        setLoading(true);
        if (selectedProject) {
          apiClient.setProject(selectedProject);
        }
        const data = await apiClient.getAnalyticsRetrieval();
        setStats(data);
      } catch (err) {
        console.error('Failed to fetch retrieval stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchRetrieval();
  }, [selectedProject, timeRange, environment, refreshKey]);

  if (loading) return <LoadingSkeleton rows={6} />;
  if (!stats) return null;

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-[#080b11]">
      <div>
        <h2 className="text-base font-mono font-bold text-slate-100 uppercase tracking-tight flex items-center gap-2">
          <Search className="w-5 h-5 text-amber-400" />
          RAG & Vector Retrieval Analytics
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Inspect document retrieval latency, relevance score distributions, and empty retrieval anomalies.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Retrieval Calls"
          value={stats.total_calls}
          secondaryInfo={`Error rate: ${stats.error_rate}%`}
          sparklineColor="#f59e0b"
        />
        <MetricCard
          title="p50 / p95 Latency"
          value={formatDuration(stats.p95_latency)}
          secondaryInfo={`p50 median: ${formatDuration(stats.p50_latency)}`}
          sparklineColor="#38bdf8"
        />
        <MetricCard
          title="Avg Docs Retrieved"
          value={stats.avg_documents_retrieved}
          secondaryInfo={`Avg relevance score: ${stats.avg_relevance_score}`}
          sparklineColor="#10b981"
        />
        <MetricCard
          title="Retrieval Alerts"
          value={stats.slow_retrievals + stats.empty_retrievals}
          secondaryInfo={`${stats.slow_retrievals} slow / ${stats.empty_retrievals} empty`}
          status={stats.slow_retrievals > 0 ? 'warning' : 'healthy'}
          sparklineColor="#f43f5e"
        />
      </div>

      {/* Retrieval Queries Table */}
      <div className="rounded-xl bg-[#0d111a] border border-[#1e2330] overflow-hidden shadow-lg">
        <div className="p-4 bg-[#090d16] border-b border-[#1e2330] flex items-center justify-between">
          <span className="text-xs font-mono uppercase text-slate-200 font-bold">
            Recent Vector & Document Search Executions
          </span>
          <span className="text-xs font-mono text-slate-400">{stats.queries.length} Queries</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead className="bg-[#080b11] border-b border-[#1e2330] text-[11px] text-slate-400">
              <tr>
                <th className="py-2.5 px-4">STATUS</th>
                <th className="py-2.5 px-4">QUERY STRING</th>
                <th className="py-2.5 px-4">DOCUMENTS RETURNED</th>
                <th className="py-2.5 px-4">LATENCY</th>
                <th className="py-2.5 px-4">TIMESTAMP</th>
                <th className="py-2.5 px-4 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2330]/50">
              {stats.queries.map(q => (
                <tr
                  key={q.span_id}
                  onClick={() => onSelectTrace(q.trace_id)}
                  className="hover:bg-[#0f1422] transition-colors cursor-pointer group"
                >
                  <td className="py-3 px-4">
                    <StatusBadge status={q.status} size="sm" />
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-100 group-hover:text-indigo-400 transition-colors">
                    {q.query}
                  </td>
                  <td className="py-3 px-4 text-slate-300">
                    {q.documents_count} docs
                  </td>
                  <td className="py-3 px-4 font-bold text-amber-400">
                    {formatDuration(q.duration_ms)}
                  </td>
                  <td className="py-3 px-4 text-slate-400 text-[11px]">
                    {formatTimestamp(q.start_time)}
                  </td>
                  <td className="py-3 px-4 text-right text-indigo-400 group-hover:translate-x-0.5 transition-transform">
                    <ArrowRight className="w-4 h-4 ml-auto" />
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

