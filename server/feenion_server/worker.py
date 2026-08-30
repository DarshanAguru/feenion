from __future__ import annotations

import datetime
import threading
import time
import uuid
from typing import Any
from sqlalchemy.orm import Session
from .db import SessionLocal, TraceModel, SpanModel, EventModel, Project, init_db
from .queue import trace_queue, TraceQueue

def parse_iso_datetime(dt_str: str | None) -> datetime.datetime | None:
    if not dt_str:
        return None
    try:
        return datetime.datetime.fromisoformat(dt_str)
    except Exception:
        return None

class IngestionWorker:
    """
    Background worker process consuming trace batches from Redis/Memory queue
    and persisting telemetry into PostgreSQL/SQLite with transaction isolation and retries.
    """

    def __init__(self, queue: TraceQueue = trace_queue):
        self.queue = queue
        self._shutdown = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        init_db()
        self._thread = threading.Thread(target=self._run, name="feenion-db-worker", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._shutdown.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=5.0)

    def _run(self) -> None:
        while not self._shutdown.is_set():
            batch_item = self.queue.dequeue_batch(timeout=0.2)
            if not batch_item:
                continue

            project_id_or_name, traces = batch_item
            db = SessionLocal()
            try:
                self.process_batch(db, project_id_or_name, traces)
                db.commit()
            except Exception as exc:
                db.rollback()
                print(f"[feenion-worker] Failed to process batch: {exc}")
            finally:
                db.close()

    def process_batch(self, db: Session, project_id_or_name: str, traces: list[dict[str, Any]]) -> None:
        # Resolve project UUID
        proj = db.query(Project).filter((Project.id == project_id_or_name) | (Project.name == project_id_or_name)).first()
        if not proj:
            proj = Project(name=project_id_or_name)
            db.add(proj)
            db.commit()
            db.refresh(proj)
        target_project_id = proj.id

        for trace_data in traces:
            trace_id = trace_data["trace_id"]
            existing_trace = db.query(TraceModel).filter(TraceModel.id == trace_id).first()

            start_time = parse_iso_datetime(trace_data.get("start_time")) or datetime.datetime.now(datetime.timezone.utc)
            end_time = parse_iso_datetime(trace_data.get("end_time"))
            duration_ms = trace_data.get("duration_ms")
            if duration_ms is None and start_time and end_time:
                duration_ms = (end_time - start_time).total_seconds() * 1000.0

            if not existing_trace:
                existing_trace = TraceModel(
                    id=trace_id,
                    project_id=target_project_id,
                    name=trace_data.get("name", "unnamed_trace"),
                    status=trace_data.get("status", "ok"),
                    start_time=start_time,
                    end_time=end_time,
                    duration_ms=duration_ms,
                    metadata_json=trace_data.get("metadata", {}),
                )
                db.add(existing_trace)
            else:
                existing_trace.status = trace_data.get("status", existing_trace.status)
                existing_trace.end_time = end_time or existing_trace.end_time
                existing_trace.duration_ms = duration_ms or existing_trace.duration_ms
                if trace_data.get("metadata"):
                    existing_trace.metadata_json = trace_data["metadata"]

            for span_data in trace_data.get("spans", []):
                span_id = span_data["span_id"]
                sp_start = parse_iso_datetime(span_data.get("start_time")) or start_time
                sp_end = parse_iso_datetime(span_data.get("end_time"))
                sp_duration = span_data.get("duration_ms")
                if sp_duration is None and sp_start and sp_end:
                    sp_duration = (sp_end - sp_start).total_seconds() * 1000.0

                existing_span = db.query(SpanModel).filter(SpanModel.id == span_id).first()
                if not existing_span:
                    existing_span = SpanModel(
                        id=span_id,
                        trace_id=trace_id,
                        parent_span_id=span_data.get("parent_span_id"),
                        name=span_data.get("name", "unnamed_span"),
                        span_type=span_data.get("span_type", "custom"),
                        status=span_data.get("status", "ok"),
                        start_time=sp_start,
                        end_time=sp_end,
                        duration_ms=sp_duration,
                        attributes_json=span_data.get("attributes"),
                        input_json=span_data.get("input"),
                        output_json=span_data.get("output"),
                        error_json=span_data.get("error"),
                        metrics_json=span_data.get("metrics"),
                    )
                    db.add(existing_span)
                else:
                    existing_span.status = span_data.get("status", existing_span.status)
                    existing_span.end_time = sp_end or existing_span.end_time
                    existing_span.output_json = span_data.get("output", existing_span.output_json)
                    existing_span.error_json = span_data.get("error", existing_span.error_json)

                for event_data in span_data.get("events", []):
                    event_id = event_data.get("event_id")
                    if not event_id:
                        continue
                    existing_event = db.query(EventModel).filter(EventModel.id == event_id).first()
                    if not existing_event:
                        ev_time = parse_iso_datetime(event_data.get("timestamp")) or sp_start
                        ev = EventModel(
                            id=event_id,
                            trace_id=trace_id,
                            span_id=span_id,
                            event_type=event_data.get("event_type", "custom"),
                            timestamp=ev_time,
                            payload_json=event_data.get("payload"),
                        )
                        db.add(ev)

worker = IngestionWorker()

