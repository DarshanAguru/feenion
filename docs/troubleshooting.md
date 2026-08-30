# Troubleshooting Guide

Solutions for common installation and runtime issues.

---

## Common Issues & Fixes

### 1. Traces are not appearing in Web UI

- **Check Exporter Configuration**: Ensure `configure(exporter=AsyncExporter(HTTPExporter("http://localhost:8000")))` is called at application startup.
- **Check Server Endpoint**: Verify Feenion Server is accessible: `curl http://localhost:8000/health`.
- **Flush Exporter on Script Exit**: In short-lived CLI scripts, call `exporter.shutdown()` or `tracer.exporter.shutdown()` before exiting so pending queue batches flush.

### 2. Redis Connection Errors

- If Redis is unavailable, Feenion automatically falls back to an in-memory queue for local development.
- For production Redis errors, verify `FEENION_REDIS_URL` host and credentials.

### 3. Database Migration / Connection Issues

- Check container readiness: `curl http://localhost:8000/ready`.
- Verify PostgreSQL credentials in `FEENION_DATABASE_URL`.

