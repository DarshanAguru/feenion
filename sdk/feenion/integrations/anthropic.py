from __future__ import annotations

import functools
import inspect
from typing import Any
from ..pricing import pricing_registry

def instrument_anthropic(client: Any = None, tracer: Any = None) -> Any:
    """
    Instruments Anthropic SDK client (both Anthropic, AsyncAnthropic, and LangChain ChatAnthropic)
    to capture Claude model messages automatically with tunable model pricing.
    Returns the instrumented client for convenience.
    """
    from .. import tracer as default_tracer
    active_tracer = tracer or default_tracer

    def _process_response(s: Any, response: Any, model: str) -> None:
        usage = getattr(response, "usage", None)
        p_tok = getattr(usage, "input_tokens", 0) if usage else 0
        c_tok = getattr(usage, "output_tokens", 0) if usage else 0
        t_tok = p_tok + c_tok

        content = getattr(response, "content", [])
        out_text = content[0].text if content and hasattr(content[0], "text") else ""
        s.output = {"role": "assistant", "content": out_text}

        cost = pricing_registry.calculate(model, p_tok, c_tok)
        s.set_llm_metrics(
            model=model,
            prompt_tokens=p_tok,
            completion_tokens=c_tok,
            total_tokens=t_tok,
            cost=cost,
            finish_reason="stop",
        )

    from .common import ACTIVE_LANGCHAIN_INVOKE, wrap_langchain_model

    # 1. If this is a LangChain model (e.g. ChatAnthropic)
    if hasattr(client, "invoke") or hasattr(client, "generate") or hasattr(client, "callbacks"):
        return wrap_langchain_model(client, provider="anthropic", default_model="claude-3-5-sonnet", tracer=active_tracer)

    def wrap_messages_create(original_create: Any) -> Any:
        if inspect.iscoroutinefunction(original_create):
            @functools.wraps(original_create)
            async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
                if ACTIVE_LANGCHAIN_INVOKE.get():
                    return await original_create(*args, **kwargs)

                model = kwargs.get("model", "claude-3-5-sonnet")
                messages = kwargs.get("messages", [])

                with active_tracer.span(f"anthropic.{model}", span_type="llm") as s:
                    s.set_attribute("provider", "anthropic")
                    s.input = {
                        "model": model,
                        "messages": messages,
                        "temperature": kwargs.get("temperature", 1.0),
                    }
                    try:
                        response = await original_create(*args, **kwargs)
                        _process_response(s, response, model)
                        return response
                    except Exception as exc:
                        s.fail(exc)
                        raise exc
            return async_wrapper
        else:
            @functools.wraps(original_create)
            def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
                if ACTIVE_LANGCHAIN_INVOKE.get():
                    return original_create(*args, **kwargs)

                model = kwargs.get("model", "claude-3-5-sonnet")
                messages = kwargs.get("messages", [])

                with active_tracer.span(f"anthropic.{model}", span_type="llm") as s:
                    s.set_attribute("provider", "anthropic")
                    s.input = {
                        "model": model,
                        "messages": messages,
                        "temperature": kwargs.get("temperature", 1.0),
                    }
                    try:
                        response = original_create(*args, **kwargs)
                        _process_response(s, response, model)
                        return response
                    except Exception as exc:
                        s.fail(exc)
                        raise exc
            return sync_wrapper

    # 2. Raw Anthropic or AsyncAnthropic client
    if client is not None:
        if hasattr(client, "messages") and hasattr(client.messages, "create"):
            client.messages.create = wrap_messages_create(client.messages.create)

    return client

def wrap_anthropic(client: Any, tracer: Any = None) -> Any:
    """
    Convenience functional wrapper that instruments and returns the Anthropic client.
    Example: `claude = wrap_anthropic(Anthropic())`
    """
    return instrument_anthropic(client, tracer=tracer)
