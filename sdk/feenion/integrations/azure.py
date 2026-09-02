from __future__ import annotations

import functools
import inspect
from typing import Any
from ..pricing import pricing_registry

def instrument_azure_openai(client: Any = None, tracer: Any = None) -> Any:
    """
    Instruments Azure OpenAI SDK client (both AzureOpenAI and AsyncAzureOpenAI)
    to automatically capture LLM telemetry, tokens, tool calls, and pricing.
    Returns the instrumented client for convenience.
    """
    from .. import tracer as default_tracer
    active_tracer = tracer or default_tracer

    def wrap_chat_create(original_create: Any) -> Any:
        if inspect.iscoroutinefunction(original_create):
            @functools.wraps(original_create)
            async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
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

    if client is not None:
        if hasattr(client, "chat") and hasattr(client.chat, "completions"):
            client.chat.completions.create = wrap_chat_create(client.chat.completions.create)

    return client

def _process_azure_openai_response(span_obj: Any, response: Any, model: str) -> None:
    # Extract usage tokens
    usage = getattr(response, "usage", None)
    p_tok = getattr(usage, "prompt_tokens", 0) if usage else 0
    c_tok = getattr(usage, "completion_tokens", 0) if usage else 0
    t_tok = getattr(usage, "total_tokens", p_tok + c_tok) if usage else (p_tok + c_tok)

    # Extract output text and tool calls
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

    # Compute cost using dynamic tunable registry
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
    Convenience wrapper that instruments and returns the Azure OpenAI client.
    Example:
        from openai import AzureOpenAI
        from feenion.integrations import wrap_azure_openai
        client = wrap_azure_openai(AzureOpenAI(endpoint=..., api_key=...))
    """
    return instrument_azure_openai(client, tracer=tracer)

def instrument_azure_ai(client: Any = None, tracer: Any = None) -> Any:
    """
    Instruments Azure AI Inference SDK client (`ChatCompletionsClient`)
    for Azure AI Foundry & Model Catalog inference.
    """
    from .. import tracer as default_tracer
    active_tracer = tracer or default_tracer

    def wrap_complete(original_fn: Any) -> Any:
        if inspect.iscoroutinefunction(original_fn):
            @functools.wraps(original_fn)
            async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
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
        elif hasattr(client, "chat") and hasattr(client.chat, "completions"):
            client.chat.completions.create = wrap_complete(client.chat.completions.create)

    return client

def wrap_azure_ai(client: Any, tracer: Any = None) -> Any:
    """
    Convenience wrapper that instruments and returns the Azure AI Inference client.
    """
    return instrument_azure_ai(client, tracer=tracer)
