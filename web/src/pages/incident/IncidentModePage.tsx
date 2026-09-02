import React, { useEffect, useState } from 'react';
import { AnalyticsOverview, ErrorGroup } from '../../types';
import { apiClient } from '../../api/client';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { formatDuration, formatNumber } from '../../utils/formatters';
import { ShieldAlert, AlertOctagon, Flame, ArrowRight, Layers, Sparkles, Wrench } from 'lucide-react';

interface IncidentModePageProps {
  onSelectTrace: (traceId: string) => void;
  selectedProject?: string;
  timeRange?: string;
  environment?: string;
  refreshKey?: number;
}

export const IncidentModePage: React.FC<IncidentModePageProps> = ({
  onSelectTrace,
  selectedProject,
  timeRange = '1h',
  environment = 'all',
  refreshKey,
}) => {
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [errors, setErrors] = useState<ErrorGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadIncidentData = async () => {
      try {
        setLoading(true);
        if (selectedProject) {
          apiClient.setProject(selectedProject);
        }
        const [overviewData, errorsData] = await Promise.all([
          apiClient.getAnalyticsOverview(timeRange, environment),
          apiClient.getErrors(20),
        ]);
        setAnalytics(overviewData);
        setErrors(errorsData.errors || []);
      } catch (err) {
        console.error('Failed to load incident data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadIncidentData();
  }, [selectedProject, timeRange, environment, refreshKey]);

  if (loading) return <LoadingSkeleton rows={8} />;
  if (!analytics) return null;

  const isDegraded = analytics.health.score < 80 || errors.length > 0;

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-[#080b11]">
      {/* Incident Banner */}
      <div className="p-5 rounded-xl bg-gradient-to-r from-rose-950/80 via-[#0d111a] to-[#0d111a] border border-rose-800/80 shadow-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-rose-900/80 border border-rose-600 flex items-center justify-center text-rose-300 shadow-lg shadow-rose-950/60">
            <ShieldAlert className="w-7 h-7 animate-bounce" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono font-bold text-rose-300 uppercase tracking-wider">
                Production Incident Response Mode
              </span>
              <StatusBadge status={isDegraded ? 'degraded' : 'healthy'} size="md" />
            </div>
            <p className="text-xs text-slate-300 font-mono mt-1">
              Targeted live telemetry diagnostics to quickly identify and isolate root-cause candidates.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="p-2.5 rounded-lg bg-[#080b11] border border-slate-800 text-center">
            <span className="text-[10px] text-slate-400 uppercase block">Error Rate</span>
            <span className="text-base font-bold text-rose-400">{analytics.kpis.error_rate.value}%</span>
          </div>
          <div className="p-2.5 rounded-lg bg-[#080b11] border border-slate-800 text-center">
            <span className="text-[10px] text-slate-400 uppercase block">p95 Latency</span>
            <span className="text-base font-bold text-amber-400">{formatDuration(analytics.kpis.p95_latency.value)}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-[#080b11] border border-slate-800 text-center">
            <span className="text-[10px] text-slate-400 uppercase block">Failing Spans</span>
            <span className="text-base font-bold text-rose-400">{analytics.counts.errors}</span>
          </div>
        </div>
      </div>

      {/* Root Cause Candidate Fingerprints */}
      <div className="rounded-xl bg-[#0d111a] border border-[#1e2330] p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono uppercase text-rose-300 font-bold flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-rose-400" />
            Top Failing Spans & Root-Cause Candidates
          </span>
          <span className="text-xs font-mono text-slate-400">{errors.length} Active Error Groups</span>
        </div>

        <div className="space-y-2">
          {errors.length > 0 ? (
            errors.map((err, idx) => (
              <div
                key={err.fingerprint}
                onClick={() => onSelectTrace(err.sample_trace_id)}
                className="p-3.5 rounded-lg bg-[#080b11] border border-rose-900/50 hover:border-rose-600/80 transition-colors cursor-pointer group flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded bg-rose-950 border border-rose-800 text-rose-400 flex items-center justify-center font-mono font-bold text-xs shrink-0">
                    #{idx + 1}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-rose-300">{err.error_type}</span>
                      <span className="text-[10px] font-mono text-slate-400">in span "{err.sample_span_name}"</span>
                      <span className="px-1.5 py-0.2 rounded bg-rose-950 text-rose-400 font-mono text-[10px] font-bold">
                        {err.count} failures
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 font-mono mt-1 line-clamp-1">{err.message}</p>
                  </div>
                </div>

                <button className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium flex items-center gap-1 shrink-0">
                  Inspect Trace <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          ) : (
            <p className="text-xs text-emerald-400 text-center py-6 font-mono">
              Zero active errors recorded in the current incident window.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

