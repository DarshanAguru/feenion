# Production Deployment Guide

Feenion is designed for self-hosted production deployment on modern Linux servers, Virtual Machines, Kubernetes, or container platforms.

---

## Deployment Options

1. **Docker Compose (Recommended for single-node / on-premise)**: Simple container stack managing API, worker, web dashboard, PostgreSQL, and Redis.
2. **Kubernetes / Helm**: Cloud-native deployment separating stateless API replicas, worker pods, managed PostgreSQL (e.g. AWS RDS / GCP Cloud SQL), and managed Redis (ElastiCache / MemoryStore).

---

## Production Best Practices

### 1. Database Provisioning
Use a dedicated PostgreSQL 14+ database instance with persistent volume storage and automated backups.

```env
FEENION_DATABASE_URL=postgresql://user:password@pg-host.internal:5432/feenion_db
```

### 2. Redis Ingestion Queue
Use a dedicated Redis 7+ instance configured for in-memory queueing with eviction policy set to `noeviction`.

```env
FEENION_REDIS_URL=redis://redis-host.internal:6379/0
```

### 3. Horizontal Scaling
- Scale `feenion-api` containers behind a load balancer (Nginx, Traefik, ALB, Ingress).
- Scale `feenion-worker` containers horizontally to process high trace volumes concurrently from Redis.

### 4. API Key Protection
Ensure production requests mandate API key verification by setting up projects via `POST /api/v1/projects` and issuing hashed API keys.

