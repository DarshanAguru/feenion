from __future__ import annotations

from threading import Lock
from uuid import UUID
from typing import Any
from sqlalchemy.orm import Session
from .models import TracePayload
from .db import SessionLocal, TraceModel, init_db
from .queue import trace_queue

class TraceStore:
    """
    Database & Queue integrated store maintaining backward compatibility
    while driving asynchronous ingestion and persistent SQL queries.
    """

    def __init__(self) -> None:
        self._in_memory_traces: dict[UUID, TracePayload] = {}
        self._lock = Lock()
        init_db()

    def add(self, trace: TracePayload, project_id: str = "default") -> None:
        self.add_many([trace], project_id=project_id)

    def add_many(self, traces: list[TracePayload], project_id: str = "default") -> None:
        with self._lock:
            for trace in traces:
                self._in_memory_traces[trace.trace_id] = trace

        # Enqueue for DB worker persistence
        traces_dicts = [t.model_dump(mode="json") for t in traces]
        trace_queue.enqueue_batch(project_id=project_id, traces=traces_dicts)

    def get(self, trace_id: UUID) -> TracePayload | dict[str, Any] | None:
        with self._lock:
            if trace_id in self._in_memory_traces:
                return self._in_memory_traces[trace_id]

        db = SessionLocal()
        try:
            trace_rec = db.query(TraceModel).filter(TraceModel.id == str(trace_id)).first()
            if not trace_rec:
                return None

            spans_list = []
            for s in trace_rec.spans:
                events_list = [
                    {
                        "event_id": str(e.id),
                        "event_type": e.event_type,
                        "timestamp": e.timestamp.isoformat(),
                        "trace_id": str(e.trace_id),
                        "span_id": str(e.span_id),
                        "payload": e.payload_json or {},
                    }
                    for e in s.events
                ]
                spans_list.append({
                    "span_id": str(s.id),
                    "trace_id": str(s.trace_id),
                    "name": s.name,
                    "span_type": s.span_type,
                    "parent_span_id": str(s.parent_span_id) if s.parent_span_id else None,
                    "start_time": s.start_time.isoformat(),
                    "end_time": s.end_time.isoformat() if s.end_time else None,
                    "duration_ms": s.duration_ms,
                    "status": s.status,
                    "attributes": s.attributes_json or {},
                    "input": s.input_json,
                    "output": s.output_json,
                    "error": s.error_json,
                    "metrics": s.metrics_json or {},
                    "events": events_list,
                })

            return {
                "trace_id": str(trace_rec.id),
                "name": trace_rec.name,
                "start_time": trace_rec.start_time.isoformat(),
                "end_time": trace_rec.end_time.isoformat() if trace_rec.end_time else None,
                "duration_ms": trace_rec.duration_ms,
                "status": trace_rec.status,
                "metadata": trace_rec.metadata_json or {},
                "spans": spans_list,
            }
        finally:
            db.close()

    def get_all(self) -> list[TracePayload]:
        with self._lock:
            return list(self._in_memory_traces.values())

    def clear(self) -> None:
        with self._lock:
            self._in_memory_traces.clear()

    def remove_traces(self, trace_ids: list[str | UUID]) -> None:
        with self._lock:
            for t_id in trace_ids:
                try:
                    uuid_id = UUID(str(t_id))
                    self._in_memory_traces.pop(uuid_id, None)
                except Exception:
                    pass

    def count(self) -> int:
        db = SessionLocal()
        try:
            db_count = db.query(TraceModel).count()
            with self._lock:
                return max(db_count, len(self._in_memory_traces))
        finally:
            db.close()