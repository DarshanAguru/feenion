export interface EventPayload {
  event_id: string;
  event_type: string;
  timestamp: string;
  trace_id: string;
  span_id: string;
  payload: Record<string, any>;
}

export interface SpanPayload {
  span_id: string;
  trace_id: string;
  name: string;
  span_type: 'custom' | 'trace' | 'llm' | 'retrieval' | 'tool' | 'agent';
  parent_span_id: string | null;
  start_time: string;
  end_time: string | null;
  duration_ms: number | null;
  status: 'running' | 'ok' | 'error';
  attributes: Record<string, any>;
  input?: any;
  output?: any;
  error?: {
    error_type?: string;
    message?: string;
    stack_trace?: string;
    timestamp?: string;
  } | null;
  metrics?: Record<string, any>;
  events?: EventPayload[];
}

export interface TraceSummary {
  trace_id: string;
  name: string;
  status: 'running' | 'ok' | 'error';
  start_time: string;
  end_time: string | null;
  duration_ms: number | null;
  span_count: number;
  error_count: number;
  llm_span_count: number;
  retrieval_count?: number;
  tool_count?: number;
  agent_count?: number;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  estimated_cost?: number;
  models?: string[];
  preview_prompt?: string;
  search_text?: string;
  environment?: string;
  metadata?: Record<string, any>;
}

export interface TraceDetail extends TraceSummary {
  spans: SpanPayload[];
}

export interface ErrorGroup {
  fingerprint: string;
  error_type: string;
  message: string;
  count: number;
  first_seen: string;
  latest_occurrence: string;
  sample_span_id: string;
  sample_trace_id: string;
  sample_span_name: string;
  span_type: string;
  stack_trace?: string;
  affected_traces_count: number;
  affected_models: string[];
  affected_traces: string[];
}

export interface AnalyticsOverview {
  health: {
    score: number;
    prev_score: number;
    status: 'healthy' | 'warning' | 'degraded';
    factors: string[];
  };
  kpis: {
    requests: { value: number; prev: number; delta: number };
    error_rate: { value: number; prev: number; delta: number };
    p50_latency: { value: number; prev: number; delta: number };
    p95_latency: { value: number; prev: number; delta: number };
    llm_cost: { value: number; prev: number; delta: number };
    total_tokens: { value: number; prev: number; delta: number };
  };
  what_changed: Array<{
    metric: string;
    change: string;
    direction: 'up' | 'down' | 'stable';
    severity: 'good' | 'warning' | 'danger';
    summary: string;
    contributor: string;
    filter_link: Record<string, any>;
  }>;
  traffic_series: Array<{
    time: string;
    total: number;
    success: number;
    error: number;
  }>;
  latency_percentiles: {
    p50: number;
    p75: number;
    p90: number;
    p95: number;
    p99: number;
    llm_p95: number;
    tool_p95: number;
    retrieval_p95: number;
  };
  time_breakdown: {
    llm_ms: number;
    llm_pct: number;
    retrieval_ms: number;
    retrieval_pct: number;
    tools_ms: number;
    tools_pct: number;
    other_ms: number;
    other_pct: number;
  };
  counts: {
    traces: number;
    llm_spans: number;
    tool_spans: number;
    retrieval_spans: number;
    agent_spans: number;
    errors: number;
  };
}

export interface ModelStats {
  model: string;
  provider: string;
  requests: number;
  errors: number;
  error_rate: number;
  p50_latency: number;
  p95_latency: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  total_cost: number;
  avg_cost_per_request: number;
  avg_tokens_per_request: number;
}

export interface ToolStats {
  name: string;
  calls: number;
  errors: number;
  error_rate: number;
  p50_latency: number;
  p95_latency: number;
  latest_called: string;
}

export interface RetrievalStats {
  total_calls: number;
  error_rate: number;
  p50_latency: number;
  p95_latency: number;
  avg_documents_retrieved: number;
  avg_relevance_score: number;
  slow_retrievals: number;
  empty_retrievals: number;
  queries: Array<{
    span_id: string;
    trace_id: string;
    query: string;
    duration_ms: number;
    status: string;
    documents_count: number;
    start_time: string;
  }>;
}

export interface AgentStats {
  total_agent_runs: number;
  avg_step_count: number;
  avg_duration_ms: number;
  failure_rate: number;
  loop_candidates_count: number;
  runs: Array<{
    trace_id: string;
    name: string;
    duration_ms: number;
    status: string;
    step_count: number;
    llm_count: number;
    tool_count: number;
    retrieval_count: number;
    tokens: number;
    cost: number;
    is_loop_candidate: boolean;
    start_time: string;
  }>;
}

export interface ProjectInfo {
  id: string;
  name: string;
  created_at: string;
}

export type NavigationTab =
  | 'overview'
  | 'traces'
  | 'errors'
  | 'llm'
  | 'agents'
  | 'retrieval'
  | 'tools'
  | 'performance'
  | 'costs'
  | 'incident'
  | 'settings';

