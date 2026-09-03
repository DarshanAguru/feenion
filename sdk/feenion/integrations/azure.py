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

def _make_invoke_adapter(client: Any, default_model: str) -> Any:
    """Provides .invoke() support on raw Azure clients for drop-in LangChain compatibility."""
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
            getattr(client, "deployment_name", None) or
            getattr(client, "model", None) or
            default_model
        )

        if hasattr(client, "chat") and hasattr(client.chat, "completions"):
            resp = client.chat.completions.create(model=model, messages=messages, **kwargs)
        elif hasattr(client, "complete"):
            resp = client.complete(model=model, messages=messages, **kwargs)
        else:
            raise AttributeError(f"{type(client).__name__} does not have completions or complete method")

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

def instrument_azure_openai(client: Any = None, tracer: Any = None) -> Any:
    """
    Instruments Azure OpenAI SDK client (both AzureOpenAI and AsyncAzureOpenAI, plus LangChain AzureChatOpenAI)
    to automatically capture LLM telemetry, tokens, tool calls, and pricing.
    Returns the instrumented client for convenience.
    """
    from .. import tracer as default_tracer
    active_tracer = tracer or default_tracer

    # 1. If this is a LangChain model (e.g. AzureChatOpenAI, AzureOpenAI)
    if hasattr(client, "invoke") or hasattr(client, "generate") or hasattr(client, "callbacks"):
        return wrap_langchain_model(client, provider="azure.openai", default_model="azure-gpt-4o", tracer=active_tracer)

    def wrap_chat_create(original_create: Any) -> Any:
        if inspect.iscoroutinefunction(original_create):
            @functools.wraps(original_create)
            async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
                if ACTIVE_LANGCHAIN_INVOKE.get():
                    return await original_create(*args, **kwargs)

                model = kwargs.get("model") or getattr(client, "deployment_name", "azure-gpt-4o")
                messages = kwargs.get("messages", [])

                with active_tracer.span(f"azure.openai.{model}", span_type="llm") as s:
                    s.set_attribute("provider", "azure_openai")
                    s.set_attribute("deployment", model)
                    if hasattr(client, "_client") and hasattr(client._client, "base_url"):
                        s.set_attribute("azure_endpoint", str(client._client.base_url))

                    s.input = {
                        "model": model,
                        "messages": messages,
                        "temperature": kwargs.get("temperature", 1.0),
                    }
                    try:
                        response = await original_create(*args, **kwargs)
                        _process_azure_openai_response(s, response, model)
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

                model = kwargs.get("model") or getattr(client, "deployment_name", "azure-gpt-4o")
                messages = kwargs.get("messages", [])

                with active_tracer.span(f"azure.openai.{model}", span_type="llm") as s:
                    s.set_attribute("provider", "azure_openai")
                    s.set_attribute("deployment", model)
                    if hasattr(client, "_client") and hasattr(client._client, "base_url"):
                        s.set_attribute("azure_endpoint", str(client._client.base_url))

                    s.input = {
                        "model": model,
                        "messages": messages,
                        "temperature": kwargs.get("temperature", 1.0),
                    }
                    try:
                        response = original_create(*args, **kwargs)
                        _process_azure_openai_response(s, response, model)
                        return response
                    except Exception as exc:
                        s.fail(exc)
                        raise exc

            return sync_wrapper

    # 2. Raw AzureOpenAI or AsyncAzureOpenAI client
    if client is not None:
        if hasattr(client, "chat") and hasattr(client.chat, "completions"):
            client.chat.completions.create = wrap_chat_create(client.chat.completions.create)
            # Add .invoke adapter if client doesn't already have invoke
            if not hasattr(client, "invoke"):
                safe_set_method(client, "invoke", _make_invoke_adapter(client, "azure-gpt-4o"))

    return client

def _process_azure_openai_response(span_obj: Any, response: Any, model: str) -> None:
    usage = getattr(response, "usage", None)
    p_tok = getattr(usage, "prompt_tokens", 0) if usage else 0
    c_tok = getattr(usage, "completion_tokens", 0) if usage else 0
    t_tok = getattr(usage, "total_tokens", p_tok + c_tok) if usage else (p_tok + c_tok)

    choices = getattr(response, "choices", [])
    out_text = ""
    finish_reason = "stop"
    tool_calls_data = []

    if choices:
        msg = getattr(choices[0], "message", None)
        out_text = getattr(msg, "content", "") or ""
        finish_reason = getattr(choices[0], "finish_reason", "stop") or "stop"
        
        raw_tool_calls = getattr(msg, "tool_calls", None)
        if raw_tool_calls:
            for tc in raw_tool_calls:
                fn = getattr(tc, "function", None)
                tool_calls_data.append({
                    "id": getattr(tc, "id", None),
                    "name": getattr(fn, "name", None) if fn else None,
                    "arguments": getattr(fn, "arguments", None) if fn else None,
                })

    output_payload: dict[str, Any] = {"role": "assistant", "content": out_text}
    if tool_calls_data:
        output_payload["tool_calls"] = tool_calls_data
    span_obj.output = output_payload

    cost = pricing_registry.calculate(model, p_tok, c_tok)

    span_obj.set_llm_metrics(
        model=model,
        prompt_tokens=p_tok,
        completion_tokens=c_tok,
        total_tokens=t_tok,
        cost=cost,
        finish_reason=finish_reason,
    )

def wrap_azure_openai(client: Any, tracer: Any = None) -> Any:
    """
    Convenience wrapper that instruments and returns the Azure OpenAI client
    (works seamlessly for raw AzureOpenAI, AsyncAzureOpenAI, and LangChain AzureChatOpenAI).
    Example:
        from langchain_openai import AzureChatOpenAI
        from feenion import wrap_azure_openai
        llm = wrap_azure_openai(AzureChatOpenAI(...))
    """
    return instrument_azure_openai(client, tracer=tracer)

def instrument_azure_ai(client: Any = None, tracer: Any = None) -> Any:
    """
    Instruments Azure AI Inference SDK client (`ChatCompletionsClient`)
    and LangChain Azure AI models for Azure AI Foundry & Model Catalog inference.
    """
    from .. import tracer as default_tracer
    active_tracer = tracer or default_tracer

    # 1. If this is a LangChain model
    if hasattr(client, "invoke") or hasattr(client, "generate") or hasattr(client, "callbacks"):
        return wrap_langchain_model(client, provider="azure.ai", default_model="azure-gpt-4o", tracer=active_tracer)

    def wrap_complete(original_fn: Any) -> Any:
        if inspect.iscoroutinefunction(original_fn):
            @functools.wraps(original_fn)
            async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
                if ACTIVE_LANGCHAIN_INVOKE.get():
                    return await original_fn(*args, **kwargs)

                model = kwargs.get("model") or getattr(client, "model", "azure-ai-model")
                messages = kwargs.get("messages", [])

                with active_tracer.span(f"azure.ai.{model}", span_type="llm") as s:
                    s.set_attribute("provider", "azure_ai_inference")
                    s.input = {"model": model, "messages": str(messages)}
                    try:
                        response = await original_fn(*args, **kwargs)
                        _process_azure_openai_response(s, response, model)
                        return response
                    except Exception as exc:
                        s.fail(exc)
                        raise exc
            return async_wrapper
        else:
            @functools.wraps(original_fn)
            def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
                if ACTIVE_LANGCHAIN_INVOKE.get():
                    return original_fn(*args, **kwargs)

                model = kwargs.get("model") or getattr(client, "model", "azure-ai-model")
                messages = kwargs.get("messages", [])

                with active_tracer.span(f"azure.ai.{model}", span_type="llm") as s:
                    s.set_attribute("provider", "azure_ai_inference")
                    s.input = {"model": model, "messages": str(messages)}
                    try:
                        response = original_fn(*args, **kwargs)
                        _process_azure_openai_response(s, response, model)
                        return response
                    except Exception as exc:
                        s.fail(exc)
                        raise exc
            return sync_wrapper

    if client is not None:
        if hasattr(client, "complete"):
            client.complete = wrap_complete(client.complete)
            if not hasattr(client, "invoke"):
                safe_set_method(client, "invoke", _make_invoke_adapter(client, "azure-ai-model"))
        elif hasattr(client, "chat") and hasattr(client.chat, "completions"):
            client.chat.completions.create = wrap_complete(client.chat.completions.create)
            if not hasattr(client, "invoke"):
                safe_set_method(client, "invoke", _make_invoke_adapter(client, "azure-ai-model"))

    return client

def wrap_azure_ai(client: Any, tracer: Any = None) -> Any:
    """
    Convenience wrapper that instruments and returns the Azure AI Inference client or LangChain Azure model.
    """
    return instrument_azure_ai(client, tracer=tracer)
