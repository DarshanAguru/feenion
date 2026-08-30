# Feenion REST API Specification

The Feenion Server exposes a versioned REST API for telemetry ingestion and querying.

---

## 📥 Ingestion Endpoint

### `POST /api/v1/traces`

Ingest a batch of trace payloads into the Redis queue for async database persistence.

#### Request Headers
- `Content-Type: application/json`
- `Content-Encoding: gzip` (optional)
- `X-Feenion-Api-Key: <key>` (optional)

#### Request Body Schema (`TraceBatch`)

```json
{
  "schema_version": "1.0",
  "sdk_version": "0.1.0",
  "traces": [
    {
      "trace_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "name": "my_agent_trace",
      "start_time": "2026-08-30T10:00:00Z",
      "end_time": "2026-08-30T10:00:02Z",
      "duration_ms": 2000.0,
      "status": "ok",
      "metadata": {},
      "spans": [
        {
          "span_id": "c73bcdcc-2669-4b66-81d3-4fad2ac76780",
          "trace_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          "parent_span_id": null,
          "name": "llm_completion",
          "span_type": "llm",
          "start_time": "2026-08-30T10:00:00.500Z",
          "end_time": "2026-08-30T10:00:01.800Z",
          "duration_ms": 1300.0,
          "status": "ok",
          "attributes": {"model": "gpt-4o"},
          "input": {"prompt": "Hello"},
          "output": {"text": "World"},
          "metrics": {"tokens": {"total": 10}, "cost": 0.001},
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

## 🔍 Query API Endpoints

### `GET /api/v1/traces`
List ingested traces with optional filtering and pagination.

**Query Parameters:**
- `status` (`ok` / `error`)
- `name` (filter trace name string)
- `min_duration_ms` / `max_duration_ms`
- `has_error` (`true` / `false`)
- `limit` (default 50, max 500)
- `offset` (default 0)

### `GET /api/v1/traces/{trace_id}/spans`
Retrieve full span tree for a specific trace ID.

### `GET /api/v1/errors`
Retrieve grouped error fingerprints, stack traces, and occurrence counts.

### `GET /health` & `GET /ready`
Readiness and liveness health checks.

