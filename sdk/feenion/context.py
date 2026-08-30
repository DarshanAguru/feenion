from __future__ import annotations
from contextvars import ContextVar, Token
from uuid import UUID


_current_trace: ContextVar[UUID | None] = ContextVar("feenion_current_trace", default=None)
_current_span: ContextVar[UUID | None] = ContextVar("feenion_current_span", default=None)

def get_current_trace_id() -> UUID | None:
    return _current_trace.get()

def get_current_span_id() -> UUID | None:
    return _current_span.get()

def set_trace(trace_id: UUID | None) -> Token[UUID | None]:
    return _current_trace.set(trace_id)

def set_span(span_id: UUID | None) -> Token[UUID | None]:
    return _current_span.set(span_id)

def reset_trace(token: Token[UUID | None]) -> None:
    _current_trace.reset(token)

def reset_span(token: Token[UUID | None]) -> None:
    _current_span.reset(token)
