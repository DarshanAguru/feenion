import React, { useEffect, useState } from 'react';
import { ToolStats } from '../../types';
import { apiClient } from '../../api/client';
import { MetricCard } from '../../components/common/MetricCard';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { formatNumber, formatDuration, formatRelativeTime } from '../../utils/formatters';
import { Wrench, CheckCircle2, XCircle, Clock, ArrowUpDown } from 'lucide-react';

interface ToolsPageProps {
  selectedProject?: string;
  timeRange?: string;
  environment?: string;
  refreshKey?: number;
}

export const ToolsPage: React.FC<ToolsPageProps> = ({
  selectedProject,
  timeRange,
  environment,
  refreshKey,
}) => {
  const [tools, setTools] = useState<ToolStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTools = async () => {
      try {
        setLoading(true);
        if (selectedProject) {
          apiClient.setProject(selectedProject);
        }
        const data = await apiClient.getAnalyticsTools();
        setTools(data.tools || []);
      } catch (err) {
        console.error('Failed to fetch tool analytics:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTools();
  }, [selectedProject, timeRange, environment, refreshKey]);

  if (loading) return <LoadingSkeleton rows={6} />;

  const totalCalls = tools.reduce((acc, t) => acc + t.calls, 0);
  const totalErrors = tools.reduce((acc, t) => acc + t.errors, 0);
  const overallSuccessRate = totalCalls > 0 ? (((totalCalls - totalErrors) / totalCalls) * 100).toFixed(1) : '100.0';

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-[#080b11]">
      <div>
        <h2 className="text-base font-mono font-bold text-slate-100 uppercase tracking-tight flex items-center gap-2">
          <Wrench className="w-5 h-5 text-cyan-400" />
          Tool Execution & Function Calling Analytics
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Monitor tool invocation frequency, execution latency, and error breakdown across agent functions.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Tool Calls"
          value={formatNumber(totalCalls)}
          secondaryInfo={`${tools.length} distinct tools`}
          sparklineColor="#06b6d4"
        />
        <MetricCard
          title="Tool Success Rate"
          value={`${overallSuccessRate}%`}
          secondaryInfo={`${totalErrors} failures recorded`}
          status={totalErrors > 0 ? 'warning' : 'healthy'}
          sparklineColor="#10b981"
        />
        <MetricCard
          title="Fastest Tool"
          value={tools.length > 0 ? `${formatDuration(Math.min(...tools.map(t => t.p50_latency)))}` : '--'}
          secondaryInfo="Median p50"
          sparklineColor="#38bdf8"
        />
        <MetricCard
          title="Tool Failures"
          value={totalErrors}
          status={totalErrors > 0 ? 'degraded' : 'healthy'}
          sparklineColor="#f43f5e"
        />
      </div>

      {/* Tools Table */}
      <div className="rounded-xl bg-[#0d111a] border border-[#1e2330] overflow-hidden shadow-lg">
        <div className="p-4 bg-[#090d16] border-b border-[#1e2330] flex items-center justify-between">
          <span className="text-xs font-mono uppercase text-slate-200 font-bold">
            Registered Agent Tools Performance Matrix
          </span>
          <span className="text-xs font-mono text-slate-400">{tools.length} Tools</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead className="bg-[#080b11] border-b border-[#1e2330] text-[11px] text-slate-400">
              <tr>
                <th className="py-2.5 px-4">TOOL NAME</th>
                <th className="py-2.5 px-4">TOTAL CALLS</th>
                <th className="py-2.5 px-4">p50 LATENCY</th>
                <th className="py-2.5 px-4">p95 LATENCY</th>
                <th className="py-2.5 px-4">ERRORS</th>
                <th className="py-2.5 px-4">ERROR RATE</th>
                <th className="py-2.5 px-4 text-right">LAST CALLED</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2330]/50">
              {tools.map(tool => (
                <tr key={tool.name} className="hover:bg-[#0f1422] transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-100 flex items-center gap-2">
                    <Wrench className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>{tool.name}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-200 font-bold">
                    {formatNumber(tool.calls)}
                  </td>
                  <td className="py-3 px-4 text-slate-300">
                    {formatDuration(tool.p50_latency)}
                  </td>
                  <td className="py-3 px-4 text-cyan-400 font-bold">
                    {formatDuration(tool.p95_latency)}
                  </td>
                  <td className="py-3 px-4 text-slate-300">
                    {tool.errors}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      tool.error_rate > 0
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    }`}>
                      {tool.error_rate}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-slate-400 text-[11px]">
                    {formatRelativeTime(tool.latest_called)}
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

