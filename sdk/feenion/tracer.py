from __future__ import annotations

import asyncio
import functools
import inspect
from contextlib import contextmanager, asynccontextmanager
from typing import Any, Callable, Generator, AsyncGenerator, ParamSpec, TypeVar, overload
from uuid import UUID, uuid4
import inspect

from .context import (
    get_current_span_id,
    get_current_trace_id,
    reset_span,
    reset_trace,
    set_span,
    set_trace,
)
from .exporters.base import Exporter
from .models import Event, Span, Trace, utc_now

P = ParamSpec("P")
R = TypeVar("R")

class SpanContextManager:
    """
    Dual sync/async context manager for spans, enabling both:
      with span("name"):
      async with span("name"):
    """

    def __init__(self, tracer: Tracer, name: str, span_type: str = "custom", attributes: dict[str, Any] | None = None) -> None:
        self.tracer = tracer
        self.name = name
        self.span_type = span_type
        self.attributes = attributes or {}
        self.span: Span | None = None
        self._token = None

    def __enter__(self) -> Span:
        self.span = self.tracer.start_span(
            name=self.name,
            span_type=self.span_type,
            attributes=self.attributes,
        )
        self._token = set_span(self.span.span_id)
        return self.span

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        if self._token is not None:
            reset_span(self._token)
        if self.span:
            if exc_val is not None:
                self.span.fail(exc_val)
            else:
                self.span.finish()

    async def __aenter__(self) -> Span:
        return self.__enter__()

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        self.__exit__(exc_type, exc_val, exc_tb)


class TraceContextManager:
    """
    Dual sync/async context manager for root traces.
    """

    def __init__(self, tracer: Tracer, name: str, metadata: dict[str, Any] | None = None) -> None:
        self.tracer = tracer
        self.name = name
        self.metadata = metadata or {}
        self.trace: Trace | None = None
        self.root_span: Span | None = None
        self._trace_token = None
        self._span_token = None
        self._exported = False

    def __enter__(self) -> Trace:
        self.trace = self.tracer.start_trace(name=self.name, metadata=self.metadata)
        self._trace_token = set_trace(self.trace.trace_id)

        self.root_span = Span(
            span_id=uuid4(),
            trace_id=self.trace.trace_id,
            name=self.name,
            span_type="trace",
            parent_span_id=None,
            start_time=utc_now(),
        )
        self.trace.add_span(self.root_span)
        self._span_token = set_span(self.root_span.span_id)
        return self.trace

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        if self.root_span and self.trace:
            if exc_val is not None:
                self.root_span.fail(exc_val)
                self.trace.fail(exc_val)
            else:
                self.root_span.finish()
                self.trace.finish()

            if not self._exported:
                self._exported = True
                self.tracer._export(self.trace)

        if self._span_token is not None:
            reset_span(self._span_token)
        if self._trace_token is not None:
            reset_trace(self._trace_token)

    async def __aenter__(self) -> Trace:
        return self.__enter__()

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        self.__exit__(exc_type, exc_val, exc_tb)


class Tracer:
    """
    Core Tracer managing active trace contexts, span lifecycles, and export dispatch.
    """

    def __init__(self, exporter: Exporter | None = None) -> None:
        self.traces: dict[str, Trace] = {}
        self.exporter = exporter

    def _export(self, trace: Trace) -> None:
        if self.exporter is None:
            return
        try:
            self.exporter.export(trace)
        except Exception as e:
            print(f"[feenion] Failed to export trace: {e}")

    def start_trace(self, name: str, metadata: dict[str, Any] | None = None) -> Trace:
        trace = Trace(
            trace_id=uuid4(),
            name=name,
            metadata=metadata or {},
            start_time=utc_now(),
        )
        self.traces[str(trace.trace_id)] = trace
        return trace

    def end_trace(self, trace_id: UUID | str) -> None:
        tr = self.traces.pop(str(trace_id), None)
        if tr:
            tr.finish()
            self._export(tr)

    def start_span(
        self,
        name: str,
        span_type: str = "custom",
        attributes: dict[str, Any] | None = None,
    ) -> Span:
        trace_id = get_current_trace_id()
        if trace_id is None:
            raise RuntimeError("Cannot create span outside an active trace context.")

        parent_span_id = get_current_span_id()
        trace = self.traces.get(str(trace_id))
        if trace is None:
            raise RuntimeError(f"Trace with ID {trace_id} not found.")

        span = Span(
            span_id=uuid4(),
            trace_id=trace_id,
            name=name,
            span_type=span_type,
            parent_span_id=parent_span_id,
            start_time=utc_now(),
            attributes=attributes or {},
        )
        trace.add_span(span)
        return span

    def trace_context(self, name: str, metadata: dict[str, Any] | None = None) -> TraceContextManager:
        return TraceContextManager(self, name=name, metadata=metadata)

    def span_context(
        self,
        name: str,
        span_type: str = "custom",
        attributes: dict[str, Any] | None = None,
    ) -> SpanContextManager:
        return SpanContextManager(self, name=name, span_type=span_type, attributes=attributes)

    @overload
    def trace(self, func: Callable[P, R]) -> Callable[P, R]:
        ...

    @overload
    def trace(
        self, func: None = None, *, name: str | None = None, span_type: str = "custom"
    ) -> Callable[[Callable[P, R]], Callable[P, R]]:
        ...

    def trace(
        self,
        func: Callable[P, R] | None = None,
        *,
        name: str | None = None,
        span_type: str = "custom",
    ) -> Callable[P, R] | Callable[[Callable[P, R]], Callable[P, R]]:
        def decorator(fn: Callable[P, R]) -> Callable[P, R]:
            is_async = inspect.iscoroutinefunction(fn)
            span_name = name or fn.__name__

            if is_async:
                @functools.wraps(fn)
                async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
                    active_trace_id = get_current_trace_id()
                    if active_trace_id is None:
                        async with self.trace_context(name=span_name):
                            res = await fn(*args, **kwargs)
                            return res
                    else:
                        async with self.span_context(name=span_name, span_type=span_type) as sp:
                            sp.input = {"args": args, "kwargs": kwargs}
                            res = await fn(*args, **kwargs)
                            sp.output = res
                            return res
                return async_wrapper  # type: ignore
            else:
                @functools.wraps(fn)
                def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
                    active_trace_id = get_current_trace_id()
                    if active_trace_id is None:
                        with self.trace_context(name=span_name):
                            res = fn(*args, **kwargs)
                            return res
                    else:
                        with self.span_context(name=span_name, span_type=span_type) as sp:
                            sp.input = {"args": args, "kwargs": kwargs}
                            res = fn(*args, **kwargs)
                            sp.output = res
                            return res
                return sync_wrapper  # type: ignore

        if func is not None:
            return decorator(func)

        return decorator

    def span(
        self,
        name: str,
        span_type: str = "custom",
        attributes: dict[str, Any] | None = None,
    ) -> SpanContextManager:
        return self.span_context(name=name, span_type=span_type, attributes=attributes)
