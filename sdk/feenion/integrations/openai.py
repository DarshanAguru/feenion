from __future__ import annotations

import functools
import inspect
from typing import Any
from ..pricing import pricing_registry
from .common import (
    ACTIVE_LANGCHAIN_INVOKE,
    safe_set_method,
    wrap_langchain_model,
)

def _make_openai_invoke_adapter(client: Any, default_model: str = "gpt-4o") -> Any:
    """Provides .invoke() support on raw OpenAI clients for drop-in LangChain compatibility."""
    def sync_adapter(*args: Any, **kwargs: Any) -> Any:
        input_data = args[0] if args else kwargs.get("input", kwargs)
        messages: list[dict[str, Any]] = []
        if isinstance(input_data, str):
            messages = [{"role": "user", "content": input_data}]
        elif isinstance(input_data, (list, tuple)):
            for item in input_data:
                if isinstance(item, (tuple, list)) and len(item) == 2:
                    messages.append({"role": str(item[0]), "content": str(item[1])})
                elif hasattr(item, "content"):
                    role = getattr(item, "type", None) or getattr(item, "role", "user")
                    messages.append({"role": str(role), "content": str(item.content)})
                elif isinstance(item, dict):
                    messages.append(item)
                else:
                    messages.append({"role": "user", "content": str(item)})
        elif isinstance(input_data, dict):
            messages = [input_data]
        else:
            messages = [{"role": "user", "content": str(input_data)}]

        model = (
            kwargs.pop("model", None) or
            getattr(client, "model", None) or
            default_model
        )

        if hasattr(client, "chat") and hasattr(client.chat, "completions"):
            resp = client.chat.completions.create(model=model, messages=messages, **kwargs)
        else:
            raise AttributeError(f"{type(client).__name__} does not have chat.completions method")

        if not hasattr(resp, "content"):
            try:
                choices = getattr(resp, "choices", [])
                if choices:
                    msg = getattr(choices[0], "message", None)
                    content = getattr(msg, "content", "") if msg else ""
                    safe_set_method(resp, "content", content)
            except Exception:
                pass
        return resp

    return sync_adapter

def instrument_openai(client: Any = None, tracer: Any = None) -> Any:
    """
    Instruments OpenAI SDK client (both OpenAI and AsyncOpenAI, plus LangChain ChatOpenAI)
    to capture LLM calls automatically with tunable model pricing.
    Returns the instrumented client for convenience.
    """
    from .. import tracer as default_tracer
    active_tracer = tracer or default_tracer

    # 1. If this is a LangChain model (e.g. ChatOpenAI, OpenAI)
    if hasattr(client, "invoke") or hasattr(client, "generate") or hasattr(client, "callbacks"):
        return wrap_langchain_model(client, provider="openai", default_model="gpt-4o", tracer=active_tracer)

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
                if ACTIVE_LANGCHAIN_INVOKE.get():
                    return await original_create(*args, **kwargs)

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
                if ACTIVE_LANGCHAIN_INVOKE.get():
                    return original_create(*args, **kwargs)

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

    # 2. Raw OpenAI or AsyncOpenAI client
    if client is not None:
        if hasattr(client, "chat") and hasattr(client.chat, "completions"):
            client.chat.completions.create = wrap_chat_create(client.chat.completions.create)
            if not hasattr(client, "invoke"):
                safe_set_method(client, "invoke", _make_openai_invoke_adapter(client, "gpt-4o"))

    return client

def wrap_openai(client: Any, tracer: Any = None) -> Any:
    """
    Convenience functional wrapper that instruments and returns the OpenAI / ChatOpenAI client.
    Example: `client = wrap_openai(OpenAI())` or `llm = wrap_openai(ChatOpenAI())`
    """
    return instrument_openai(client, tracer=tracer)
