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

- `POST /api/v1/traces`: Ingest spans and trace events.
- `GET /api/v1/traces`: Query trace summaries with prompt, model, and metadata full-text search.
- `GET /api/v1/traces/{trace_id}/spans`: Retrieve nested spans for flamegraphs and mindmaps.
- `GET /api/v1/errors`: Retrieve grouped exception fingerprints and occurrences.
- `POST /api/v1/admin/traces/batch-delete`: Batch delete selected traces (requires Basic Auth).
- `DELETE /api/v1/admin/traces`: Purge all telemetry data (requires Basic Auth).
