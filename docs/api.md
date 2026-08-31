# Feenion REST & WebSocket API Specification

The Feenion Server exposes a high-throughput, versioned API for telemetry ingestion, querying, analytics, project management, and live WebSocket broadcasting.

---

## 📥 1. Ingestion API

### `POST /api/v1/traces`
Ingests a batch of trace payloads with child spans, metrics, and events. Supports Gzip compression and asynchronous background persistence.

#### Request Headers
- `Content-Type: application/json`
- `Content-Encoding: gzip` *(optional)*
- `X-Feenion-Api-Key: <api_key>` *(optional)*
- `X-Project-Id: <project_id>` *(optional)*

#### Request Body Schema (`TraceBatch`)
```json
{
  "schema_version": "1.0",
  "sdk_version": "0.1.0",
  "traces": [
    {
      "trace_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "name": "autonomous_compliance_agent",
      "start_time": "2026-08-30T10:00:00Z",
      "end_time": "2026-08-30T10:00:02Z",
      "duration_ms": 2000.0,
      "status": "ok",
      "metadata": {"environment": "production"},
      "spans": [
        {
          "span_id": "c73bcdcc-2669-4b66-81d3-4fad2ac76780",
          "trace_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          "parent_span_id": null,
          "name": "gemini.gemini-2.0-flash",
          "span_type": "llm",
          "start_time": "2026-08-30T10:00:00.500Z",
          "end_time": "2026-08-30T10:00:01.800Z",
          "duration_ms": 1300.0,
          "status": "ok",
          "attributes": {"model": "gemini-2.0-flash"},
          "input": {"contents": "Verify compliance audit trail."},
          "output": {"role": "assistant", "content": "Compliance verified."},
          "metrics": {
            "tokens": {"prompt": 140, "completion": 65, "total": 205},
            "cost": 0.00004
          },
          "events": []
        }
      ]
    }
  ]
}
```

#### Response (`200 OK`)
```json
{
  "accepted": 1,
  "schema_version": "1.0"
}
```

---

## 🔍 2. Trace Query Endpoints

### `GET /api/v1/traces`
List traces with multi-dimensional filtering, pagination, and sorting.

**Query Parameters:**
- `status`: `all` | `ok` | `error`
- `environment`: `all` | `production` | `staging` | `development`
- `time_window`: `15m` | `1h` | `6h` | `24h` | `7d` | `30d` | `all`
- `span_type`: `all` | `llm` | `retrieval` | `tool` | `agent`
- `search`: Free-text search across trace names, models, tools, prompts, and IDs.
- `sort_by`: `newest` | `oldest` | `slowest` | `fastest` | `most_tokens` | `most_cost` | `most_spans` | `error`
- `limit`: Integer (`1` to `500`, default `100`)
- `offset`: Integer (default `0`)

### `GET /api/v1/traces/{trace_id}`
Retrieve the full causality tree for a specific trace, including aggregated token totals, cost estimates, models used, and full child span hierarchy.

### `GET /api/v1/traces/{trace_id}/spans`
Retrieve the ordered list of spans for a specific trace ID.

### `DELETE /api/v1/traces/{trace_id}`
Permanently delete an individual trace and all its child spans and events.

### `POST /api/v1/traces/bulk-delete`
Batch delete multiple traces by ID list.

```json
{
  "trace_ids": ["3fa85f64-5717-4562-b3fc-2c963f66afa6", "7c9e6679-7425-40de-944b-e07fc1f90ae7"]
}
```

---

## 🏢 3. Workspaces & Projects Management

### `GET /api/v1/projects`
List all active workspaces and their creation timestamps.

### `POST /api/v1/projects`
Create a new project workspace and generate an ingestion API key.

```json
{
  "name": "enterprise-compliance"
}
```

### `DELETE /api/v1/projects/{project_id}`
Delete a project workspace and cascade-delete all its associated API keys, traces, spans, and telemetry logs. (Protected: cannot delete the only remaining workspace).

---

## 📊 4. Observability & Analytics Endpoints

### `GET /api/v1/analytics/overview`
Retrieves system health KPIs (total traces, p50/p95/p99 latency, error rate, token throughput, spend), time-series traffic bars, and recent regression alerts.

### `GET /api/v1/analytics/models`
Returns model breakdown statistics (invocations, total prompt/completion tokens, total spend, latency percentiles, error rate).

### `GET /api/v1/analytics/tools`
Returns tool and MCP server execution metrics (total calls, error rates, average latency, top tools).

### `GET /api/v1/analytics/retrieval`
Returns RAG retrieval metrics (total searches, average chunk count, average similarity score, distribution).

### `GET /api/v1/analytics/agents`
Returns autonomous agent execution metrics (total agent loops, average steps per goal, decision latencies).

### `GET /api/v1/errors`
Returns semantic error clusters grouped by exception type and root cause stack traces with occurrence counts.

---

## ⚡ 5. Real-Time Telemetry Stream

### `WebSocket /api/v1/ws/telemetry`
Live streaming WebSocket endpoint that automatically broadcasts telemetry events when new traces and spans are ingested.

---

## 🛠️ 6. System & Health Endpoints

- `GET /health`: Liveness health check (`{"status": "ok"}`).
- `GET /ready`: Readiness probe verifying SQLite database connectivity (`{"status": "ready"}`).
- `POST /api/v1/admin/clear-telemetry`: Purge all traces and spans across the server (requires confirmation payload `{"confirm_text": "delete everything"}`).
- `POST /api/v1/admin/cleanup`: Trigger retention cleanup based on configured TTL (e.g. 30 days).
