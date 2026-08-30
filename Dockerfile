FROM python:3.12-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    FEENION_DATABASE_URL="sqlite:////app/data/feenion.db" \
    FEENION_REDIS_URL=""

# Install Python dependencies
COPY pyproject.toml /app/
COPY server/requirements.txt /app/server/requirements.txt
RUN pip install --no-cache-dir -r server/requirements.txt

# Copy backend source & React dashboard
COPY sdk /app/sdk
COPY server /app/server
COPY web /app/web

# Install editable packages & create persistent data directory
RUN pip install --no-cache-dir -e /app && mkdir -p /app/data

EXPOSE 8000

VOLUME ["/app/data"]

CMD ["uvicorn", "feenion_server.main:app", "--host", "0.0.0.0", "--port", "8000"]
