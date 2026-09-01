# Feenion Telemetry Server (`feenion-server`)

High-throughput, self-hosted ingestion server and REST query API for Feenion.

## Architecture

- **FastAPI Engine**: High-performance asynchronous API endpoints.
- **Ingestion Queue**: Redis queue with automatic fallback to high-speed in-memory thread queue.
- **Worker Process**: Background batch upsert worker persisting telemetry to SQLite or PostgreSQL.
- **WebSocket Push**: Live real-time WebSocket push updates (`/api/v1/ws/telemetry`).
- **Batch Admin Operations**: Single-call batch trace deletion (`POST /api/v1/admin/traces/batch-delete`) and full database purge (`DELETE /api/v1/admin/traces`).
- **Data Retention**: Background worker purging old trace partitions automatically.

## Running Locally

```bash
uvicorn feenion_server.main:app --host 0.0.0.0 --port 8000
```

## Environment Variables

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `FEENION_DATABASE_URL` | `sqlite:////app/data/feenion.db` | SQLite or PostgreSQL connection string |
| `FEENION_REDIS_URL` | `""` | Optional Redis URL for queue buffering |
| `FEENION_LOG_LEVEL` | `INFO` | Server log verbosity |
| `FEENION_RETENTION_DAYS` | `30` | Trace retention window in days |
| `FEENION_ADMIN_USER` | `admin` | Admin dashboard username |
| `FEENION_ADMIN_PASSWORD` | `admin` | Admin dashboard password |

## API Endpoints Summary

### Ingestion & Realtime
- `POST /api/v1/traces`: Ingest spans, trace events, and token metrics (supports Gzip).
- `WS /api/v1/ws/telemetry`: Live real-time WebSocket telemetry push.

### Query & Exploration
- `GET /api/v1/traces`: Query trace summaries with multi-dimensional filtering, prompt/model search, and sorting.
- `GET /api/v1/traces/{trace_id}`: Full trace detail with causality tree, inputs/outputs, and costs.
- `GET /api/v1/traces/{trace_id}/spans`: Retrieve nested spans for waterfall and flamegraphs.
- `GET /api/v1/count/traces`: Total ingested trace count.

### Analytics Engine
- `GET /api/v1/analytics/overview`: Health score (0-100), latency percentiles (p50-p99), KPI deltas, time breakdown, and "What Changed?" regression engine.
- `GET /api/v1/analytics/models`: Provider and model breakdown (tokens, spend, error rates, latencies).
- `GET /api/v1/analytics/tools`: Tool and MCP execution metrics (calls, failures, latencies).
- `GET /api/v1/analytics/retrieval`: Vector DB RAG analytics (relevance scores, doc counts, slow queries).
- `GET /api/v1/analytics/agents`: Autonomous multi-step agent metrics (steps, loops, failure rates).
- `GET /api/v1/errors`: Semantic error clusters with stack traces and affected models.

### Workspaces & Multi-Tenancy
- `GET /api/v1/projects`: List all workspaces.
- `POST /api/v1/projects`: Create workspace and generate API key.
- `DELETE /api/v1/projects/{project_id}`: Cascade delete workspace and associated data.

### Admin & Maintenance
- `DELETE /api/v1/admin/traces` / `POST /api/v1/admin/traces/purge`: Purge all data (requires confirmation).
- `POST /api/v1/admin/traces/batch-delete`: Batch delete selected traces.
- `DELETE /api/v1/admin/traces/{trace_id}`: Delete a single trace.

### System & Probes
- `GET /health`: Liveness probe.
- `GET /ready`: Readiness probe.
- `GET /ui`: Serves web dashboard.
