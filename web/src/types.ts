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
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  estimated_cost?: number;
  models?: string[];
  preview_prompt?: string;
  search_text?: string;
  metadata?: Record<string, any>;
}

export interface ErrorGroup {
  error_type: string;
  message: string;
  count: number;
  latest_occurrence: string;
  sample_span_id: string;
  sample_trace_id: string;
  stack_trace?: string;
}

