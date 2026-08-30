from __future__ import annotations

import time
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

from ..context import get_current_span_id, get_current_trace_id
from ..models import Span, utc_now
from ..pricing import pricing_registry

def _get_active_tracer():
    import feenion
    return feenion.tracer

try:
    from langchain_core.callbacks.base import BaseCallbackHandler
except ImportError:
    # Graceful fallback if langchain_core is not installed
    class BaseCallbackHandler:  # type: ignore
        pass

class FeenionCallbackHandler(BaseCallbackHandler):
    """
    Feenion observability callback handler for LangChain chains, agents, tools, and retrievers.
    Automatically captures hierarchical spans, token consumption, and model errors.
    """

    def __init__(self, trace_name: str = "langchain_execution") -> None:
        super().__init__()
        self.default_trace_name = trace_name
        self._runs: Dict[UUID, Span] = {}

    def _get_or_create_span(
        self,
        run_id: UUID,
        name: str,
        span_type: str,
        parent_run_id: Optional[UUID] = None,
        inputs: Any = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Span:
        active_tracer = _get_active_tracer()
        parent_span = self._runs.get(parent_run_id) if parent_run_id else None

        if parent_span is not None:
            current_trace_id = parent_span.trace_id
            parent_span_id = parent_span.span_id
        else:
            current_trace_id = get_current_trace_id()
            if current_trace_id is None:
                tr = active_tracer.start_trace(name=self.default_trace_name, metadata=metadata)
                current_trace_id = tr.trace_id
            parent_span_id = get_current_span_id()

        span_obj = Span(
            span_id=uuid4(),
            trace_id=current_trace_id,
            name=name,
            span_type=span_type,
            parent_span_id=parent_span_id,
            start_time=utc_now(),
            attributes=metadata or {},
            input=inputs,
        )

        trace = active_tracer.traces.get(str(current_trace_id))
        if trace:
            trace.add_span(span_obj)

        self._runs[run_id] = span_obj
        return span_obj

    # --- CHAIN CALLBACKS ---
    def on_chain_start(
        self,
        serialized: Optional[Dict[str, Any]],
        inputs: Dict[str, Any],
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ) -> None:
        name = (serialized or {}).get("name") or (metadata or {}).get("name") or "LangChain.Chain"
        meta = {**(metadata or {}), "tags": tags or []}
        self._get_or_create_span(
            run_id=run_id,
            name=name,
            span_type="agent",
            parent_run_id=parent_run_id,
            inputs=inputs,
            metadata=meta,
        )

    def on_chain_end(
        self,
        outputs: Dict[str, Any],
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        span_obj = self._runs.pop(run_id, None)
        if span_obj:
            span_obj.finish(output=outputs)
            if parent_run_id is None:
                # Root chain finished - export trace if standalone
                _get_active_tracer().end_trace(span_obj.trace_id)

    def on_chain_error(
        self,
        error: BaseException,
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        span_obj = self._runs.pop(run_id, None)
        if span_obj:
            span_obj.fail(error)
            if parent_run_id is None:
                _get_active_tracer().end_trace(span_obj.trace_id)

    # --- LLM CALLBACKS ---
    def on_llm_start(
        self,
        serialized: Optional[Dict[str, Any]],
        prompts: List[str],
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ) -> None:
        model_name = (
            (metadata or {}).get("model_name") or
            (metadata or {}).get("model") or
            (serialized or {}).get("name") or
            "claude-3-5-sonnet"
        )
        if model_name.startswith("Chat"):
            if "anthropic" in model_name.lower():
                model_name = "claude-3-5-sonnet"
            elif "openai" in model_name.lower():
                model_name = "gpt-4o"

        meta = {**(metadata or {}), "model": model_name}
        self._get_or_create_span(
            run_id=run_id,
            name=f"llm.{model_name}",
            span_type="llm",
            parent_run_id=parent_run_id,
            inputs={"prompts": prompts, "model": model_name},
            metadata=meta,
        )

    def on_llm_end(
        self,
        response: Any,
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        span_obj = self._runs.pop(run_id, None)
        if span_obj:
            llm_output = getattr(response, "llm_output", {}) or {}
            usage_meta = getattr(response, "usage_metadata", {}) or {}
            token_usage = llm_output.get("token_usage") or llm_output.get("usage") or usage_meta or {}
            
            p_tok = (
                token_usage.get("prompt_tokens") or
                token_usage.get("input_tokens") or
                0
            )
            c_tok = (
                token_usage.get("completion_tokens") or
                token_usage.get("output_tokens") or
                0
            )
            total_tok = token_usage.get("total_tokens") or (p_tok + c_tok)

            # Extract generated texts
            generations = getattr(response, "generations", [])
            output_texts = []
            for gen_list in generations:
                for gen in gen_list:
                    output_texts.append(getattr(gen, "text", str(gen)))

            if p_tok == 0 and c_tok == 0:
                in_p = span_obj.input.get("prompts", []) if isinstance(span_obj.input, dict) else []
                p_tok = max(40, sum(len(p.split()) * 2 for p in in_p))
                c_tok = max(20, sum(len(t.split()) * 2 for t in output_texts))
                total_tok = p_tok + c_tok

            span_obj.output = {"generations": output_texts}

            model_name = span_obj.attributes.get("model") or "gpt-4o"
            cost = pricing_registry.calculate(model_name, p_tok, c_tok)
            span_obj.set_llm_metrics(
                model=model_name,
                prompt_tokens=p_tok,
                completion_tokens=c_tok,
                total_tokens=total_tok,
                cost=cost,
            )
            span_obj.finish()

    def on_llm_error(
        self,
        error: BaseException,
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        span_obj = self._runs.pop(run_id, None)
        if span_obj:
            span_obj.fail(error)

    # --- TOOL CALLBACKS ---
    def on_tool_start(
        self,
        serialized: Optional[Dict[str, Any]],
        input_str: str,
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ) -> None:
        name = (serialized or {}).get("name") or "LangChain.Tool"
        self._get_or_create_span(
            run_id=run_id,
            name=name,
            span_type="tool",
            parent_run_id=parent_run_id,
            inputs={"input": input_str},
            metadata=metadata,
        )

    def on_tool_end(
        self,
        output: Any,
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        span_obj = self._runs.pop(run_id, None)
        if span_obj:
            span_obj.finish(output=output)

    def on_tool_error(
        self,
        error: BaseException,
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        span_obj = self._runs.pop(run_id, None)
        if span_obj:
            span_obj.fail(error)

    # --- RETRIEVER CALLBACKS ---
    def on_retriever_start(
        self,
        serialized: Optional[Dict[str, Any]],
        query: str,
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ) -> None:
        name = (serialized or {}).get("name") or "LangChain.Retriever"
        self._get_or_create_span(
            run_id=run_id,
            name=name,
            span_type="retrieval",
            parent_run_id=parent_run_id,
            inputs={"query": query},
            metadata=metadata,
        )

    def on_retriever_end(
        self,
        documents: Any,
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        span_obj = self._runs.pop(run_id, None)
        if span_obj:
            span_obj.finish(output={"documents_retrieved": len(documents) if hasattr(documents, "__len__") else 1})

    def on_retriever_error(
        self,
        error: BaseException,
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        span_obj = self._runs.pop(run_id, None)
        if span_obj:
            span_obj.fail(error)

def instrument_langchain(trace_name: str = "langchain_execution") -> FeenionCallbackHandler:
    """
    Convenience factory to create and configure a FeenionCallbackHandler for LangChain.
    """
    return FeenionCallbackHandler(trace_name=trace_name)
