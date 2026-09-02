from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from .serializer import safe_serialize

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

@dataclass
class Event:
    event_id: UUID
    event_type: str
    timestamp: datetime
    trace_id: UUID
    span_id: UUID
    payload: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "event_id": str(self.event_id),
            "event_type": self.event_type,
            "timestamp": self.timestamp.isoformat(),
            "trace_id": str(self.trace_id),
            "span_id": str(self.span_id),
            "payload": safe_serialize(self.payload),
        }

@dataclass
class Span:
    span_id: UUID
    trace_id: UUID
    name: str
    span_type: str  # custom, trace, llm, retrieval, tool, agent
    parent_span_id: UUID | None
    start_time: datetime
    end_time: datetime | None = None
    status: str = "running"  # running, ok, error
    attributes: dict[str, Any] = field(default_factory=dict)
    input: Any = None
    output: Any = None
    error: dict[str, Any] | None = None
    metrics: dict[str, Any] = field(default_factory=dict)
    events: list[Event] = field(default_factory=list)

    def finish(self, output: Any = None) -> None:
        self.end_time = utc_now()
        if output is not None and self.output is None:
            self.output = output
        if self.status == "running":
            self.status = "ok"

    def fail(self, exception: BaseException | str | None = None) -> None:
        self.end_time = utc_now()
        self.status = "error"
        if isinstance(exception, BaseException):
            import traceback
            self.error = {
                "error_type": type(exception).__name__,
                "message": str(exception),
                "stack_trace": traceback.format_exc(),
                "timestamp": utc_now().isoformat(),
            }
        elif isinstance(exception, str):
            self.error = {
                "error_type": "Error",
                "message": exception,
                "timestamp": utc_now().isoformat(),
            }

    def add_event(self, event_type: str, payload: dict[str, Any] | None = None) -> Event:
        event = Event(
            event_id=uuid4(),
            event_type=event_type,
            timestamp=utc_now(),
            trace_id=self.trace_id,
            span_id=self.span_id,
            payload=payload or {},
        )
        self.events.append(event)
        return event

    def set_input(self, data: Any) -> None:
        self.input = data

    def set_output(self, data: Any) -> None:
        self.output = data

    def set_attribute(self, key: str, value: Any) -> None:
        self.attributes[key] = value

    def set_attributes(self, attrs: dict[str, Any]) -> None:
        self.attributes.update(attrs)

    def set_tag(self, key: str, value: Any) -> None:
        """Adds a tag or custom label to the span attributes."""
        tags = self.attributes.setdefault("tags", {})
        if isinstance(tags, dict):
            tags[key] = value
        elif isinstance(tags, list):
            tags.append(f"{key}:{value}")
        else:
            self.attributes[f"tag.{key}"] = value

    def set_tags(self, tags: dict[str, Any] | list[str]) -> None:
        """Attaches multiple tags to the span."""
        if isinstance(tags, dict):
            for k, v in tags.items():
                self.set_tag(k, v)
        elif isinstance(tags, list):
            existing = self.attributes.setdefault("tags", [])
            if isinstance(existing, list):
                existing.extend(tags)

    def set_user(self, user_id: str) -> None:
        """Attaches a user ID to the span for session attribution."""
        self.attributes["user_id"] = user_id

    def set_session(self, session_id: str) -> None:
        """Attaches a session or conversation ID to the span."""
        self.attributes["session_id"] = session_id

    def log(self, event_type: str, payload: dict[str, Any] | None = None) -> Event:
        """Convenience alias for add_event."""
        return self.add_event(event_type=event_type, payload=payload)

    def set_retrieval_metrics(
        self,
        query: str | None = None,
        documents_count: int | None = None,
        top_k: int | None = None,
        similarity_scores: list[float] | None = None,
    ) -> None:
        """Attaches retrieval & RAG telemetry to the span."""
        if query:
            self.attributes["query"] = query
        if top_k is not None:
            self.attributes["top_k"] = top_k
        if documents_count is not None:
            self.metrics["documents_retrieved"] = documents_count
        if similarity_scores:
            self.metrics["similarity_scores"] = similarity_scores

    def set_tool_metrics(
        self,
        tool_name: str,
        arguments: Any = None,
        result: Any = None,
    ) -> None:
        """Attaches tool or MCP call telemetry to the span."""
        self.attributes["tool_name"] = tool_name
        if arguments is not None:
            self.input = arguments
        if result is not None:
            self.output = result

    def set_llm_metrics(
        self,
        model: str,
        prompt_tokens: int | None = None,
        completion_tokens: int | None = None,
        total_tokens: int | None = None,
        cost: float | None = None,
        finish_reason: str | None = None,
    ) -> None:
        self.attributes["model"] = model
        if finish_reason:
            self.attributes["finish_reason"] = finish_reason
        tokens = {}
        if prompt_tokens is not None:
            tokens["prompt"] = prompt_tokens
        if completion_tokens is not None:
            tokens["completion"] = completion_tokens
        if total_tokens is not None:
            tokens["total"] = total_tokens
        elif prompt_tokens is not None and completion_tokens is not None:
            tokens["total"] = prompt_tokens + completion_tokens
        if tokens:
            self.metrics["tokens"] = tokens
        if cost is not None:
            self.metrics["cost"] = cost

    def to_dict(self) -> dict[str, Any]:
        duration_ms = None
        if self.end_time and self.start_time:
            duration_ms = (self.end_time - self.start_time).total_seconds() * 1000.0

        return {
            "span_id": str(self.span_id),
            "trace_id": str(self.trace_id),
            "name": self.name,
            "span_type": self.span_type,
            "parent_span_id": str(self.parent_span_id) if self.parent_span_id else None,
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "duration_ms": duration_ms,
            "status": self.status,
            "attributes": safe_serialize(self.attributes),
            "input": safe_serialize(self.input),
            "output": safe_serialize(self.output),
            "error": safe_serialize(self.error) if self.error else None,
            "metrics": safe_serialize(self.metrics),
            "events": [event.to_dict() for event in self.events],
        }

@dataclass
class Trace:
    trace_id: UUID
    name: str
    start_time: datetime
    end_time: datetime | None = None
    status: str = "running"
    metadata: dict[str, Any] = field(default_factory=dict)
    spans: list[Span] = field(default_factory=list)

    def finish(self) -> None:
        self.end_time = utc_now()
        if self.status == "running":
            # If any span failed, trace status is error
            if any(s.status == "error" for s in self.spans):
                self.status = "error"
            else:
                self.status = "ok"

    def fail(self, exception: BaseException | str | None = None) -> None:
        self.end_time = utc_now()
        self.status = "error"

    def add_span(self, span: Span) -> None:
        self.spans.append(span)

    def to_dict(self) -> dict[str, Any]:
        duration_ms = None
        if self.end_time and self.start_time:
            duration_ms = (self.end_time - self.start_time).total_seconds() * 1000.0

        return {
            "trace_id": str(self.trace_id),
            "name": self.name,
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "duration_ms": duration_ms,
            "status": self.status,
            "metadata": safe_serialize(self.metadata),
            "spans": [span.to_dict() for span in self.spans],
        }