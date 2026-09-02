from __future__ import annotations

import functools
import inspect
from typing import Any
from ..pricing import pricing_registry

def instrument_openai(client: Any = None, tracer: Any = None) -> Any:
    """
    Instruments OpenAI SDK client (both OpenAI and AsyncOpenAI, plus LangChain ChatOpenAI)
    to capture LLM calls automatically with tunable model pricing.
    Returns the instrumented client for convenience.
    """
    from .. import tracer as default_tracer
    active_tracer = tracer or default_tracer

    def _process_response(s: Any, response: Any, model: str) -> None:
        usage = getattr(response, "usage", None)
        p_tok = getattr(usage, "prompt_tokens", 0) if usage else 0
        c_tok = getattr(usage, "completion_tokens", 0) if usage else 0
        t_tok = getattr(usage, "total_tokens", p_tok + c_tok) if usage else (p_tok + c_tok)

        choices = getattr(response, "choices", [])
        out_text = ""
        finish_reason = "stop"
        if choices:
            msg = getattr(choices[0], "message", None)
            out_text = getattr(msg, "content", "") if msg else ""
            finish_reason = getattr(choices[0], "finish_reason", "stop") or "stop"

        s.output = {"role": "assistant", "content": out_text}
        cost = pricing_registry.calculate(model, p_tok, c_tok)
        s.set_llm_metrics(
            model=model,
            prompt_tokens=p_tok,
            completion_tokens=c_tok,
            total_tokens=t_tok,
            cost=cost,
            finish_reason=finish_reason,
        )

    def wrap_chat_create(original_create: Any) -> Any:
        if inspect.iscoroutinefunction(original_create):
            @functools.wraps(original_create)
            async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
                model = kwargs.get("model", "gpt-4o")
                messages = kwargs.get("messages", [])

                with active_tracer.span(f"openai.{model}", span_type="llm") as s:
                    s.set_attribute("provider", "openai")
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
                model = kwargs.get("model", "gpt-4o")
                messages = kwargs.get("messages", [])

                with active_tracer.span(f"openai.{model}", span_type="llm") as s:
                    s.set_attribute("provider", "openai")
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

    from .common import wrap_langchain_model

    # 1. If this is a LangChain model (e.g. ChatOpenAI, OpenAI)
    if hasattr(client, "invoke") or hasattr(client, "generate") or hasattr(client, "callbacks"):
        return wrap_langchain_model(client, provider="openai", default_model="gpt-4o", tracer=active_tracer)

    # 2. Raw OpenAI or AsyncOpenAI client
    if client is not None:
        if hasattr(client, "chat") and hasattr(client.chat, "completions"):
            client.chat.completions.create = wrap_chat_create(client.chat.completions.create)

    return client

def wrap_openai(client: Any, tracer: Any = None) -> Any:
    """
    Convenience functional wrapper that instruments and returns the OpenAI / ChatOpenAI client.
    Example: `client = wrap_openai(OpenAI())` or `llm = wrap_openai(ChatOpenAI())`
    """
    return instrument_openai(client, tracer=tracer)
