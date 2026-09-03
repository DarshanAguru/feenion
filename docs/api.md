# Feenion REST & WebSocket API Specification

The Feenion Server exposes a high-throughput, versioned API for telemetry ingestion, querying, analytics, multi-tenant workspace management, administrative maintenance, and live WebSocket broadcasting.

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
  "sdk_version": "0.1.2",
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
- `model`: Filter by LLM model name (e.g. `gemini-2.0-flash`, `gpt-4o`)
- `min_duration_ms`: Filter by minimum execution latency
- `max_duration_ms`: Filter by maximum execution latency
- `has_error`: Boolean (`true` | `false`)
- `search`: Free-text search across trace names, models, tools, prompts, and IDs.
- `sort_by`: `newest` | `oldest` | `slowest` | `fastest` | `most_tokens` | `most_cost` | `most_spans` | `error`
- `limit`: Integer (`1` to `500`, default `100`)
- `offset`: Integer (default `0`)

### `GET /api/v1/traces/{trace_id}`
Retrieve the full causality tree for a specific trace, including aggregated token totals, cost estimates, models used, and full child span hierarchy.

### `GET /api/v1/traces/{trace_id}/spans`
Retrieve the ordered list of child spans with start timestamps, latencies, and parent IDs for waterfall and flamegraph rendering.

### `GET /api/v1/count/traces`
Retrieve the fast count of total ingested traces (`{"count": 1420}`).

---

## 📊 3. Observability & Analytics Endpoints

### `GET /api/v1/analytics/overview`
Retrieves system health score (0-100), latency percentiles (`p50`, `p75`, `p90`, `p95`, `p99`), KPI deltas vs previous window, time-series traffic buckets, time breakdown (LLM vs Retrieval vs Tools vs Other), and automated "What Changed?" regression root causes.

### `GET /api/v1/analytics/models`
Returns model breakdown statistics (invocations, total prompt/completion tokens, total spend, p50/p95 latency percentiles, error rates, and average cost per request).

### `GET /api/v1/analytics/tools`
Returns tool and MCP server execution metrics (total calls, error rates, p50/p95 latency, and last invoked timestamps).

### `GET /api/v1/analytics/retrieval`
Returns RAG retrieval metrics (total searches, average chunk count, average similarity score, slow retrievals &gt;1s, and empty result alerts).

### `GET /api/v1/analytics/agents`
Returns autonomous agent execution metrics (total agent runs, average steps per run, average duration, loop candidate detection, and failure rates).

### `GET /api/v1/errors`
Returns semantic error clusters grouped by exception type and root cause stack traces with occurrence counts, first seen / latest occurrence, and affected models.

---

## 🏢 4. Workspaces & Projects Management

### `GET /api/v1/projects`
List all active workspaces and their creation timestamps.

### `POST /api/v1/projects`
Create a new project workspace and generate an ingestion API key (`feenion_live_...`).

```json
{
  "name": "enterprise-compliance"
}
```

### `DELETE /api/v1/projects/{project_id}`
Delete a project workspace and cascade-delete all its associated API keys, traces, spans, and telemetry logs. (Protected: cannot delete the only remaining workspace).

---

## 🛡️ 5. Admin & Data Maintenance

### `DELETE /api/v1/admin/traces` or `POST /api/v1/admin/traces/purge`
Permanently purge all traces, spans, and events from the database and memory. Requires confirmation payload:

```json
{
  "confirmation": "delete everything"
}
```

### `POST /api/v1/admin/traces/batch-delete`
Batch delete multiple traces and their child spans by ID list:

```json
{
  "trace_ids": ["3fa85f64-5717-4562-b3fc-2c963f66afa6", "7c9e6679-7425-40de-944b-e07fc1f90ae7"],
  "confirmation": "delete selected"
}
```

### `DELETE /api/v1/admin/traces/{trace_id}`
Delete a single trace and its associated child spans and events.

---

## ⚡ 6. Real-Time Telemetry Stream

### `WebSocket /api/v1/ws/telemetry`
Live streaming WebSocket endpoint that automatically broadcasts telemetry events (`trace_ingested`, `trace_deleted`, `traces_batch_deleted`, `data_cleared`) to connected clients.

---

## ⚙️ 7. System & Health Endpoints

- `GET /health`: Liveness health check (`{"status": "ok"}`).
- `GET /ready`: Readiness probe verifying SQLite database connectivity and worker thread status (`{"status": "ready", "database": "connected", "queue": "active"}`).
- `GET /ui`: Serves the built Web Dashboard.
