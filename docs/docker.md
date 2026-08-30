# Docker Setup & Lightweight Deployment

Feenion provides a zero-dependency, ultra-lightweight Docker container setup designed to run seamlessly alongside LLM calls, Ollama, local models, and heavy AI execution loops.

---

## ⚡ Ultra-Lightweight Mode (Default)

In lightweight mode, Feenion runs as a single isolated container using SQLite database storage and an in-memory queue. No external PostgreSQL or Redis installation is required.

### Memory & CPU Footprint
- **Memory**: `~40 MB` RAM (capped at `256 MB`)
- **CPU**: `< 0.5%` CPU usage
- **Database**: Zero host SQL dependencies

### Launching Lightweight Feenion

```bash
docker compose up -d
```

Open your browser at **[http://localhost:8000](http://localhost:8000)** to access the server and Web UI dashboard.

---

## 🏭 Production Multi-Container Mode (`docker-compose.prod.yml`)

For high-volume production deployments with external PostgreSQL and Redis:

```bash
docker compose -f docker-compose.prod.yml up -d
```

This starts:
- **`api`**: FastAPI ingestion & query server
- **`worker`**: Background Redis-to-Postgres worker
- **`web`**: Nginx static dashboard container
- **`postgres`**: Dedicated PostgreSQL database
- **`redis`**: Dedicated Redis queue
