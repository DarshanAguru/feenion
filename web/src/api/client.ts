import {
  TraceSummary,
  TraceDetail,
  SpanPayload,
  ErrorGroup,
  AnalyticsOverview,
  ModelStats,
  ToolStats,
  RetrievalStats,
  AgentStats,
  ProjectInfo,
} from '../types';

let currentProjectId: string =
  typeof window !== 'undefined'
    ? localStorage.getItem('feenion_selected_project_id') || 'default'
    : 'default';

export const apiClient = {
  setProject(projectId: string) {
    currentProjectId = projectId;
    try {
      localStorage.setItem('feenion_selected_project_id', projectId);
    } catch {}
  },

  getProject(): string {
    return currentProjectId;
  },

  getHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = { ...customHeaders };
    if (currentProjectId) {
      headers['X-Project-Id'] = currentProjectId;
      headers['X-Workspace-Id'] = currentProjectId;
    }
    return headers;
  },

  async getProjects(): Promise<ProjectInfo[]> {
    const res = await fetch('/api/v1/projects', {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch projects');
    return res.json();
  },

  async createProject(name: string): Promise<{ project: ProjectInfo; api_key: string }> {
    const res = await fetch('/api/v1/projects', {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to create project' }));
      throw new Error(err.detail || 'Failed to create project');
    }
    return res.json();
  },

  async getProjectApiKey(projectId: string): Promise<{ project_id: string; project_name: string; api_key: string }> {
    const res = await fetch(`/api/v1/projects/${projectId}/key`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to generate project API key' }));
      throw new Error(err.detail || 'Failed to generate project API key');
    }
    return res.json();
  },

  async deleteProject(projectId: string): Promise<{ status: string; project_id: string }> {
    const res = await fetch(`/api/v1/projects/${projectId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to delete project' }));
      throw new Error(err.detail || 'Failed to delete project');
    }
    return res.json();
  },


  async getTraces(params: {
    status?: string;
    environment?: string;
    time_window?: string;
    model?: string;
    span_type?: string;
    search?: string;
    sort_by?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ traces: TraceSummary[]; total: number }> {
    const query = new URLSearchParams();
    if (params.status && params.status !== 'all') query.set('status', params.status);
    if (params.environment && params.environment !== 'all') query.set('environment', params.environment);
    if (params.time_window && params.time_window !== 'all') query.set('time_window', params.time_window);
    if (params.model && params.model !== 'all') query.set('model', params.model);
    if (params.span_type && params.span_type !== 'all') query.set('span_type', params.span_type);
    if (params.search) query.set('search', params.search);
    if (params.sort_by) query.set('sort_by', params.sort_by);
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));

    const res = await fetch(`/api/v1/traces?${query.toString()}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch traces');
    return res.json();
  },

  async getTraceDetail(traceId: string): Promise<TraceDetail> {
    const res = await fetch(`/api/v1/traces/${traceId}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to fetch trace ${traceId}`);
    return res.json();
  },

  async getTraceSpans(traceId: string): Promise<SpanPayload[]> {
    const res = await fetch(`/api/v1/traces/${traceId}/spans`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to fetch spans for trace ${traceId}`);
    return res.json();
  },

  async getErrors(limit = 50): Promise<{ errors: ErrorGroup[]; total_error_spans: number }> {
    const res = await fetch(`/api/v1/errors?limit=${limit}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch errors');
    return res.json();
  },

  async getAnalyticsOverview(timeWindow = '24h', environment = 'all'): Promise<AnalyticsOverview> {
    const query = new URLSearchParams();
    query.set('time_window', timeWindow);
    if (environment && environment !== 'all') query.set('environment', environment);

    const res = await fetch(`/api/v1/analytics/overview?${query.toString()}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch analytics overview');
    return res.json();
  },

  async getAnalyticsModels(): Promise<{ models: ModelStats[]; total_models: number }> {
    const res = await fetch('/api/v1/analytics/models', {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch model analytics');
    return res.json();
  },

  async getAnalyticsTools(): Promise<{ tools: ToolStats[]; total_tools: number }> {
    const res = await fetch('/api/v1/analytics/tools', {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch tool analytics');
    return res.json();
  },

  async getAnalyticsRetrieval(): Promise<RetrievalStats> {
    const res = await fetch('/api/v1/analytics/retrieval', {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch retrieval analytics');
    return res.json();
  },

  async getAnalyticsAgents(): Promise<AgentStats> {
    const res = await fetch('/api/v1/analytics/agents', {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch agent analytics');
    return res.json();
  },

  async clearTelemetry(confirmation = 'delete everything'): Promise<{ status: string; message: string }> {
    const res = await fetch('/api/v1/admin/traces/purge', {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ confirmation }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to purge telemetry' }));
      throw new Error(err.detail || 'Failed to purge telemetry');
    }
    return res.json();
  },

  async batchDeleteTraces(traceIds: string[], confirmation = 'delete selected'): Promise<{ status: string; deleted_count: number }> {
    const res = await fetch('/api/v1/admin/traces/batch-delete', {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ trace_ids: traceIds, confirmation }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to delete traces' }));
      throw new Error(err.detail || 'Failed to delete traces');
    }
    return res.json();
  },

  async deleteTrace(traceId: string): Promise<{ status: string; message: string }> {
    const res = await fetch(`/api/v1/admin/traces/${traceId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to delete trace' }));
      throw new Error(err.detail || 'Failed to delete trace');
    }
    return res.json();
  },
};
