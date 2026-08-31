# ==========================================
# Stage 1: Build React Observability Dashboard
# ==========================================
FROM node:20-alpine AS web-builder

WORKDIR /web
COPY web/package.json web/package-lock.json* ./
RUN npm ci || npm install

COPY web/ ./
RUN npm run build

# ==========================================
# Stage 2: Production Python Telemetry Server
# ==========================================
FROM python:3.12-slim AS runner

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    FEENION_DATABASE_URL="sqlite:////app/data/feenion.db" \
    FEENION_LOG_LEVEL="INFO" \
    FEENION_RETENTION_DAYS="30"

# Install curl for healthcheck & clean up apt cache
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY pyproject.toml /app/
COPY server/requirements.txt /app/server/requirements.txt
RUN pip install --no-cache-dir -r server/requirements.txt

# Copy backend source
COPY sdk /app/sdk
COPY server /app/server
COPY web/index.html /app/web/index.html

# Copy pre-compiled static frontend assets from stage 1
COPY --from=web-builder /web/dist /app/web/dist

# Install editable packages & create persistent data directory
RUN pip install --no-cache-dir -e /app && mkdir -p /app/data

EXPOSE 8000

VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "feenion_server.main:app", "--host", "0.0.0.0", "--port", "8000"]
