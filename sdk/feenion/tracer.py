from __future__ import annotations

import asyncio
import functools
import inspect
from contextlib import contextmanager, asynccontextmanager
from typing import Any, Callable, Generator, AsyncGenerator, ParamSpec, TypeVar, overload
from uuid import UUID, uuid4

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

# Global registries to ensure spans always find active traces across contexts/threads
_ACTIVE_TRACES_REGISTRY: dict[str, Trace] = {}
_ACTIVE_SPANS_REGISTRY: dict[str, Span] = {}

def get_active_trace() -> Trace | None:
    """Returns the currently active Trace instance in this context, if any."""
    trace_id = get_current_trace_id()
    if trace_id is None:
        return None
    return _ACTIVE_TRACES_REGISTRY.get(str(trace_id))

def get_active_span() -> Span | None:
    """Returns the currently active Span instance in this context, if any."""
    span_id = get_current_span_id()
    if span_id is None:
        return None
    return _ACTIVE_SPANS_REGISTRY.get(str(span_id))

class SpanContextManager:
    """
    Dual sync/async context manager for spans, enabling:
      with span("name", span_type="llm", input={...}) as s:
      async with span("name"):
    """

    def __init__(
        self,
        tracer: Tracer,
        name: str,
        span_type: str = "custom",
        attributes: dict[str, Any] | None = None,
        tags: dict[str, Any] | list[str] | None = None,
        input: Any = None,
        output: Any = None,
        user_id: str | None = None,
        session_id: str | None = None,
    ) -> None:
        self.tracer = tracer
        self.name = name
        self.span_type = span_type
        self.attributes = attributes or {}
        self.tags = tags
        self.input = input
        self.output = output
        self.user_id = user_id
        self.session_id = session_id

        self.span: Span | None = None
        self._token = None
        self._auto_trace: Trace | None = None
        self._auto_trace_token = None

    def __enter__(self) -> Span:
        current_trace_id = get_current_trace_id()
        if current_trace_id is None or str(current_trace_id) not in _ACTIVE_TRACES_REGISTRY:
            self._auto_trace = self.tracer.start_trace(name=self.name)
            self._auto_trace_token = set_trace(self._auto_trace.trace_id)

        self.span = self.tracer.start_span(
            name=self.name,
            span_type=self.span_type,
            attributes=self.attributes,
        )
        if self.tags:
            self.span.set_tags(self.tags)
        if self.user_id:
            self.span.set_user(self.user_id)
        if self.session_id:
            self.span.set_session(self.session_id)
        if self.input is not None:
            self.span.input = self.input
        if self.output is not None:
            self.span.output = self.output

        self._token = set_span(self.span.span_id)
        _ACTIVE_SPANS_REGISTRY[str(self.span.span_id)] = self.span
        return self.span

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        if self.span:
            _ACTIVE_SPANS_REGISTRY.pop(str(self.span.span_id), None)
            if exc_val is not None:
                self.span.fail(exc_val)
            else:
                self.span.finish()

        if self._token is not None:
            reset_span(self._token)

        if self._auto_trace is not None:
            if exc_val is not None:
                self._auto_trace.fail(exc_val)
            else:
                self._auto_trace.finish()
            self.tracer._export(self._auto_trace)
            _ACTIVE_TRACES_REGISTRY.pop(str(self._auto_trace.trace_id), None)
            if self._auto_trace_token is not None:
                reset_trace(self._auto_trace_token)

    async def __aenter__(self) -> Span:
        return self.__enter__()

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        self.__exit__(exc_type, exc_val, exc_tb)


class TraceContextManager:
    """
    Dual sync/async context manager for root traces.
    """

    def __init__(
        self,
        tracer: Tracer,
        name: str,
        span_type: str = "trace",
        metadata: dict[str, Any] | None = None,
        tags: dict[str, Any] | list[str] | None = None,
        user_id: str | None = None,
        session_id: str | None = None,
        workspace_id: str | None = None,
        api_key: str | None = None,
        workspace: str | None = None,
        project_id: str | None = None,
    ) -> None:
        self.tracer = tracer
        self.name = name
        self.span_type = span_type
        self.metadata = metadata or {}
        self.tags = tags
        self.user_id = user_id
        self.session_id = session_id
        self.workspace_id = workspace_id or workspace or project_id
        self.api_key = api_key

        self.trace: Trace | None = None
        self.root_span: Span | None = None
        self._trace_token = None
        self._span_token = None
        self._exported = False

    def __enter__(self) -> Trace:
        meta = dict(self.metadata)
        if self.user_id:
            meta["user_id"] = self.user_id
        if self.session_id:
            meta["session_id"] = self.session_id
        if self.workspace_id:
            meta["workspace_id"] = self.workspace_id
        if self.api_key:
            meta["api_key"] = self.api_key
        if self.tags:
            meta["tags"] = self.tags

        self.trace = self.tracer.start_trace(name=self.name, metadata=meta)
        self._trace_token = set_trace(self.trace.trace_id)

        self.root_span = Span(
            span_id=uuid4(),
            trace_id=self.trace.trace_id,
            name=self.name,
            span_type=self.span_type,
            parent_span_id=None,
            start_time=utc_now(),
            attributes=dict(meta),
        )
        if self.tags:
            self.root_span.set_tags(self.tags)
        if self.user_id:
            self.root_span.set_user(self.user_id)
        if self.session_id:
            self.root_span.set_session(self.session_id)
        if self.workspace_id:
            self.root_span.set_attribute("workspace_id", self.workspace_id)

        self.trace.add_span(self.root_span)
        self._span_token = set_span(self.root_span.span_id)
        _ACTIVE_SPANS_REGISTRY[str(self.root_span.span_id)] = self.root_span
        return self.trace

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        if self.root_span:
            _ACTIVE_SPANS_REGISTRY.pop(str(self.root_span.span_id), None)
            if exc_val is not None:
                self.root_span.fail(exc_val)
            else:
                self.root_span.finish()

        if self.trace:
            if exc_val is not None:
                self.trace.fail(exc_val)
            else:
                self.trace.finish()

            if not self._exported:
                self._exported = True
                self.tracer._export(self.trace)
                _ACTIVE_TRACES_REGISTRY.pop(str(self.trace.trace_id), None)

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
        _ACTIVE_TRACES_REGISTRY[str(trace.trace_id)] = trace
        return trace

    def end_trace(self, trace_id: UUID | str) -> None:
        _ACTIVE_TRACES_REGISTRY.pop(str(trace_id), None)
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
            # Create auto-trace if not active
            tr = self.start_trace(name=name)
            trace_id = tr.trace_id
            set_trace(trace_id)

        parent_span_id = get_current_span_id()
        trace = self.traces.get(str(trace_id)) or _ACTIVE_TRACES_REGISTRY.get(str(trace_id))
        if trace is None:
            trace = self.start_trace(name=name)
            trace_id = trace.trace_id
            set_trace(trace_id)

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
        _ACTIVE_SPANS_REGISTRY[str(span.span_id)] = span
        return span

    def trace_context(
        self,
        name: str,
        span_type: str = "trace",
        metadata: dict[str, Any] | None = None,
        tags: dict[str, Any] | list[str] | None = None,
        user_id: str | None = None,
        session_id: str | None = None,
        workspace_id: str | None = None,
        api_key: str | None = None,
        workspace: str | None = None,
        project_id: str | None = None,
    ) -> TraceContextManager:
        return TraceContextManager(
            self,
            name=name,
            span_type=span_type,
            metadata=metadata,
            tags=tags,
            user_id=user_id,
            session_id=session_id,
            workspace_id=workspace_id or workspace or project_id,
            api_key=api_key,
        )

    def span_context(
        self,
        name: str,
        span_type: str = "custom",
        attributes: dict[str, Any] | None = None,
        *,
        tags: dict[str, Any] | list[str] | None = None,
        input: Any = None,
        output: Any = None,
        user_id: str | None = None,
        session_id: str | None = None,
    ) -> SpanContextManager:
        return SpanContextManager(
            self,
            name=name,
            span_type=span_type,
            attributes=attributes,
            tags=tags,
            input=input,
            output=output,
            user_id=user_id,
            session_id=session_id,
        )

    def trace(
        self,
        func: Callable[P, R] | str | None = None,
        *,
        name: str | None = None,
        span_type: str = "custom",
        tags: dict[str, Any] | list[str] | None = None,
        metadata: dict[str, Any] | None = None,
        capture_input: bool = True,
        capture_output: bool = True,
        user_id: str | None = None,
        session_id: str | None = None,
        workspace_id: str | None = None,
        api_key: str | None = None,
        workspace: str | None = None,
        project_id: str | None = None,
    ) -> Any:
        if isinstance(func, str):
            name = func
            func = None

        target_ws_id = workspace_id or workspace or project_id

        def decorator(fn: Callable[P, R]) -> Callable[P, R]:
            is_async = inspect.iscoroutinefunction(fn)
            span_name = name or fn.__name__

            def _get_input(args: tuple, kwargs: dict) -> Any:
                if not capture_input:
                    return None
                if not args and not kwargs:
                    return None
                # Handle self or cls if method
                clean_args = args
                if len(args) > 0 and hasattr(args[0], "__class__") and hasattr(args[0], fn.__name__):
                    clean_args = args[1:]
                if len(clean_args) == 1 and not kwargs:
                    return clean_args[0]
                payload: dict[str, Any] = {}
                if clean_args:
                    payload["args"] = clean_args
                if kwargs:
                    payload["kwargs"] = kwargs
                return payload or None

            if is_async:
                @functools.wraps(fn)
                async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
                    active_trace_id = get_current_trace_id()
                    input_payload = _get_input(args, kwargs)

                    if active_trace_id is None:
                        ctx = self.trace_context(
                            name=span_name,
                            span_type=span_type if span_type != "custom" else "agent",
                            metadata=metadata,
                            tags=tags,
                            user_id=user_id,
                            session_id=session_id,
                            workspace_id=target_ws_id,
                            api_key=api_key,
                        )
                        async with ctx:
                            if ctx.root_span and input_payload is not None:
                                ctx.root_span.input = input_payload
                            res = await fn(*args, **kwargs)
                            if ctx.root_span and capture_output:
                                ctx.root_span.output = res
                            return res
                    else:
                        async with self.span_context(
                            name=span_name,
                            span_type=span_type,
                            attributes=metadata,
                            tags=tags,
                            input=input_payload,
                            user_id=user_id,
                            session_id=session_id,
                        ) as sp:
                            res = await fn(*args, **kwargs)
                            if capture_output:
                                sp.output = res
                            return res
                return async_wrapper  # type: ignore
            else:
                @functools.wraps(fn)
                def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
                    active_trace_id = get_current_trace_id()
                    input_payload = _get_input(args, kwargs)

                    if active_trace_id is None:
                        ctx = self.trace_context(
                            name=span_name,
                            span_type=span_type if span_type != "custom" else "agent",
                            metadata=metadata,
                            tags=tags,
                            user_id=user_id,
                            session_id=session_id,
                            workspace_id=target_ws_id,
                            api_key=api_key,
                        )
                        with ctx:
                            if ctx.root_span and input_payload is not None:
                                ctx.root_span.input = input_payload
                            res = fn(*args, **kwargs)
                            if ctx.root_span and capture_output:
                                ctx.root_span.output = res
                            return res
                    else:
                        with self.span_context(
                            name=span_name,
                            span_type=span_type,
                            attributes=metadata,
                            tags=tags,
                            input=input_payload,
                            user_id=user_id,
                            session_id=session_id,
                        ) as sp:
                            res = fn(*args, **kwargs)
                            if capture_output:
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
        *,
        tags: dict[str, Any] | list[str] | None = None,
        input: Any = None,
        output: Any = None,
        user_id: str | None = None,
        session_id: str | None = None,
    ) -> SpanContextManager:
        return self.span_context(
            name=name,
            span_type=span_type,
            attributes=attributes,
            tags=tags,
            input=input,
            output=output,
            user_id=user_id,
            session_id=session_id,
        )
