# Feenion Configuration Guide

Feenion is configured using environment variables with prefix `FEENION_` or via `.env` file.

---

## Server & Worker Environment Variables

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `FEENION_HOST` | `0.0.0.0` | Bind host address for FastAPI server |
| `FEENION_PORT` | `8000` | Port for FastAPI server |
| `FEENION_DATABASE_URL` | `sqlite:///./feenion.db` | Database URL (`postgresql://...` or `sqlite://...`) |
| `FEENION_REDIS_URL` | `redis://localhost:6379/0` | Redis connection URL for ingestion queue |
| `FEENION_MAX_BATCH_SIZE` | `100` | Maximum traces per ingestion batch |
| `FEENION_MAX_PAYLOAD_SIZE` | `10485760` (10 MB) | Maximum HTTP payload bytes |
| `FEENION_LOG_LEVEL` | `INFO` | Logging level (`DEBUG`, `INFO`, `WARN`, `ERROR`) |
| `FEENION_RETENTION_DAYS` | `30` | Number of days to retain trace data before purging |
| `FEENION_SAMPLE_RATE` | `1.0` | Server-side sampling rate ratio (`0.0` to `1.0`) |

---

## SDK Configuration Parameters

### `HTTPExporter`

- `endpoint` (str): Base URL of Feenion Server (e.g. `http://localhost:8000`).
- `api_key` (str | None): API Key for project authentication.
- `timeout` (float): HTTP request timeout in seconds (default `5.0`).
- `max_retries` (int): Retry attempts on transient server errors (default `3`).
- `compress` (bool): Enable Gzip payload compression (default `True`).

### `AsyncExporter`

- `exporter`: Target inner exporter (e.g. `HTTPExporter`).
- `max_queue_size` (int): Bounded memory queue capacity (default `1000`).
- `batch_size` (int): Traces per batch flush (default `20`).
- `flush_interval` (float): Seconds between automatic batch flushes (default `1.0`).

