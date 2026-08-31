import { SpanPayload } from '../types';

export function calculatePercentile(values: number[], p: number): number {
  if (!values || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return Math.round((sorted[lower] * (1 - weight) + sorted[upper] * weight) * 100) / 100;
}

export interface CriticalPathItem {
  span: SpanPayload;
  duration_ms: number;
  percentage_of_total: number;
}

export function computeCriticalPath(spans: SpanPayload[]): CriticalPathItem[] {
  if (!spans || spans.length === 0) return [];
  const totalDuration = Math.max(...spans.map(s => s.duration_ms || 0), 1);
  
  // Sort spans by duration descending
  const sortedSpans = [...spans]
    .filter(s => (s.duration_ms || 0) > 0)
    .sort((a, b) => (b.duration_ms || 0) - (a.duration_ms || 0));

  return sortedSpans.slice(0, 5).map(s => ({
    span: s,
    duration_ms: s.duration_ms || 0,
    percentage_of_total: Math.min(100, Math.round(((s.duration_ms || 0) / totalDuration) * 100)),
  }));
}

export function detectAgentAnomalies(spans: SpanPayload[]) {
  const toolNames = spans.filter(s => s.span_type === 'tool').map(s => s.name);
  const toolCounts: Record<string, number> = {};
  toolNames.forEach(t => {
    toolCounts[t] = (toolCounts[t] || 0) + 1;
  });

  const repeatedTools = Object.entries(toolCounts).filter(([_, count]) => count >= 3);
  const hasLongLoop = spans.length > 15;
  const errorSpans = spans.filter(s => s.status === 'error');

  return {
    isLoopSuspected: repeatedTools.length > 0 || hasLongLoop,
    repeatedTools,
    totalSteps: spans.length,
    errorCount: errorSpans.length,
  };
}

