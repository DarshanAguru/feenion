from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

class EventPayload(BaseModel):
    model_config = ConfigDict(extra="allow")

    event_id: UUID
    event_type: str
    timestamp: datetime
    trace_id: UUID
    span_id: UUID
    payload: dict[str, Any] = Field(default_factory=dict)

class SpanPayload(BaseModel):
    model_config = ConfigDict(extra="allow")

    span_id: UUID
    trace_id: UUID
    name: str
    span_type: str
    parent_span_id: UUID | None = None
    start_time: datetime
    end_time: datetime | None = None
    duration_ms: float | None = None
    status: str
    attributes: dict[str, Any] = Field(default_factory=dict)
    input: Any = None
    output: Any = None
    error: dict[str, Any] | None = None
    metrics: dict[str, Any] = Field(default_factory=dict)
    events: list[EventPayload] = Field(default_factory=list)

class TracePayload(BaseModel):
    model_config = ConfigDict(extra="allow")

    trace_id: UUID
    name: str
    start_time: datetime
    end_time: datetime | None = None
    duration_ms: float | None = None
    status: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    spans: list[SpanPayload] = Field(default_factory=list)

class TraceBatch(BaseModel):
    schema_version: str = "1.0"
    sdk_version: str | None = None
    traces: list[TracePayload]