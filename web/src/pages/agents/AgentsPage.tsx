import React, { useEffect, useState } from 'react';
import { AgentStats } from '../../types';
import { apiClient } from '../../api/client';
import { MetricCard } from '../../components/common/MetricCard';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatDuration, formatCost, formatNumber, formatTimestamp } from '../../utils/formatters';
import { Bot, Repeat, AlertTriangle, Clock, Layers, Sparkles, Wrench, ArrowRight } from 'lucide-react';

interface AgentsPageProps {
  onSelectTrace: (traceId: string) => void;
  selectedProject?: string;
  timeRange?: string;
  environment?: string;
  refreshKey?: number;
}

export const AgentsPage: React.FC<AgentsPageProps> = ({
  onSelectTrace,
  selectedProject,
  timeRange,
  environment,
  refreshKey,
}) => {
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        setLoading(true);
        if (selectedProject) {
          apiClient.setProject(selectedProject);
        }
        const data = await apiClient.getAnalyticsAgents();
        setStats(data);
      } catch (err) {
        console.error('Failed to fetch agent stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAgents();
  }, [selectedProject, timeRange, environment, refreshKey]);

  if (loading) return <LoadingSkeleton rows={6} />;
  if (!stats) return null;

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-[#080b11]">
      <div>
        <h2 className="text-base font-mono font-bold text-slate-100 uppercase tracking-tight flex items-center gap-2">
          <Bot className="w-5 h-5 text-indigo-400" />
          Autonomous Agent Execution & Loop Detection
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Monitor multi-step reasoning chains, repeated tool invocations, recursive loops, and agent step failures.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Agent Executions"
          value={stats.total_agent_runs}
          secondaryInfo={`Failure rate: ${stats.failure_rate}%`}
          sparklineColor="#6366f1"
        />
        <MetricCard
          title="Avg Step Count / Run"
          value={stats.avg_step_count}
          secondaryInfo="Multi-span reasoning depth"
          sparklineColor="#38bdf8"
        />
        <MetricCard
          title="Avg Execution Duration"
          value={formatDuration(stats.avg_duration_ms)}
          secondaryInfo="End-to-end agent latency"
          sparklineColor="#eab308"
        />
        <MetricCard
          title="Loop / Inefficiency Flags"
          value={stats.loop_candidates_count}
          status={stats.loop_candidates_count > 0 ? 'warning' : 'healthy'}
          secondaryInfo="Repeated tools or >12 steps"
          sparklineColor="#f43f5e"
        />
      </div>

      {/* Loop Alert Card if detected */}
      {stats.loop_candidates_count > 0 && (
        <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Repeat className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <h4 className="text-xs font-mono font-bold text-amber-300">
                Agent Cyclic Execution Warning
              </h4>
              <p className="text-xs text-slate-300 mt-0.5">
                {stats.loop_candidates_count} agent run(s) exhibited repeated tool patterns or high step counts that may indicate prompt loops or recovery cycles.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Agent Runs Table */}
      <div className="rounded-xl bg-[#0d111a] border border-[#1e2330] overflow-hidden shadow-lg">
        <div className="p-4 bg-[#090d16] border-b border-[#1e2330] flex items-center justify-between">
          <span className="text-xs font-mono uppercase text-slate-200 font-bold">
            Recent Multi-Step Agent Workflows
          </span>
          <span className="text-xs font-mono text-slate-400">{stats.runs.length} Runs</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead className="bg-[#080b11] border-b border-[#1e2330] text-[11px] text-slate-400">
              <tr>
                <th className="py-2.5 px-4">STATUS</th>
                <th className="py-2.5 px-4">AGENT RUN</th>
                <th className="py-2.5 px-4">TOTAL STEPS</th>
                <th className="py-2.5 px-4">LLM / TOOL CALLS</th>
                <th className="py-2.5 px-4">DURATION</th>
                <th className="py-2.5 px-4">COST</th>
                <th className="py-2.5 px-4">ANOMALY FLAG</th>
                <th className="py-2.5 px-4 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2330]/50">
              {stats.runs.map(run => (
                <tr
                  key={run.trace_id}
                  onClick={() => onSelectTrace(run.trace_id)}
                  className="hover:bg-[#0f1422] transition-colors cursor-pointer group"
                >
                  <td className="py-3 px-4">
                    <StatusBadge status={run.status} size="sm" />
                  </td>

                  <td className="py-3 px-4 font-bold text-slate-100 group-hover:text-indigo-400 transition-colors">
                    {run.name}
                  </td>

                  <td className="py-3 px-4 text-slate-200 font-bold">
                    {run.step_count} steps
                  </td>

                  <td className="py-3 px-4 text-slate-300">
                    {run.llm_count} LLMs &bull; {run.tool_count} Tools
                  </td>

                  <td className="py-3 px-4 text-slate-200">
                    {formatDuration(run.duration_ms)}
                  </td>

                  <td className="py-3 px-4 text-emerald-400 font-bold">
                    {formatCost(run.cost)}
                  </td>

                  <td className="py-3 px-4">
                    {run.is_loop_candidate ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 text-[10px] font-bold">
                        <Repeat className="w-3 h-3 text-amber-400" /> Loop Suspected
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[10px]">Normal</span>
                    )}
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

