from __future__ import annotations

import json
import queue
import time
from typing import Any
import redis
from .config import settings

class TraceQueue:
    """
    Ingestion queue interface supporting Redis with an automatic in-memory fallback.
    """

    def __init__(self, redis_url: str = settings.redis_url, queue_name: str = "feenion:traces"):
        self.queue_name = queue_name
        self._memory_queue: queue.Queue[tuple[str, list[dict[str, Any]]]] = queue.Queue(maxsize=10_000)
        self.use_redis = False
        self._redis_client: redis.Redis | None = None

        try:
            r = redis.Redis.from_url(redis_url, socket_timeout=1.0, socket_connect_timeout=1.0)
            r.ping()
            self._redis_client = r
            self.use_redis = True
        except Exception:
            self.use_redis = False

    def enqueue_batch(self, project_id: str, traces: list[dict[str, Any]]) -> None:
        payload = json.dumps({"project_id": project_id, "traces": traces})
        if self.use_redis and self._redis_client:
            try:
                self._redis_client.rpush(self.queue_name, payload)
                return
            except Exception:
                self.use_redis = False

        try:
            self._memory_queue.put_nowait((project_id, traces))
        except queue.Full:
            print("[feenion-server] In-memory queue full, dropping batch")

    def dequeue_batch(self, timeout: float = 1.0) -> tuple[str, list[dict[str, Any]]] | None:
        if self.use_redis and self._redis_client:
            try:
                res = self._redis_client.blpop(self.queue_name, timeout=int(max(1, timeout)))
                if res:
                    _, data_bytes = res
                    data = json.loads(data_bytes)
                    return data["project_id"], data["traces"]
            except Exception:
                self.use_redis = False

        try:
            return self._memory_queue.get(timeout=timeout)
        except queue.Empty:
            return None

trace_queue = TraceQueue()

