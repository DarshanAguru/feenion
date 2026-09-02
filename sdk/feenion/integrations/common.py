from __future__ import annotations

import functools
import inspect
from typing import Any
from ..pricing import pricing_registry

def serialize_llm_input(input_data: Any) -> Any:
    """Serializes strings, dicts, message tuples, or LangChain BaseMessage objects into JSON-friendly structures."""
    if isinstance(input_data, str):
        return {"prompt": input_data}
    if isinstance(input_data, (list, tuple)):
        serialized = []
        for item in input_data:
            if isinstance(item, (tuple, list)) and len(item) == 2:
                serialized.append({"role": str(item[0]), "content": str(item[1])})
            elif hasattr(item, "content"):
                role = getattr(item, "type", None) or getattr(item, "role", "user")
                serialized.append({"role": str(role), "content": str(item.content)})
            elif isinstance(item, dict):
                serialized.append(item)
            else:
                serialized.append({"content": str(item)})
        return {"messages": serialized}
    if isinstance(input_data, dict):
        return input_data
    return {"input": str(input_data)}

def extract_langchain_metrics(response: Any, model: str) -> tuple[str, int, int, int, float, str]:
    """Extracts output content, tokens, cost, and finish reason from LangChain response (AIMessage or LLMResult)."""
    # 1. Output content
    out_text = ""
    if hasattr(response, "content"):
        out_text = str(response.content)
    elif hasattr(response, "generations") and response.generations:
        first_gen = response.generations[0]
        if isinstance(first_gen, list) and first_gen:
            out_text = getattr(first_gen[0], "text", str(first_gen[0]))
        else:
            out_text = getattr(first_gen, "text", str(first_gen))
    elif isinstance(response, str):
        out_text = response

    # 2. Token counts from usage_metadata or response_metadata
    usage_meta = getattr(response, "usage_metadata", None) or {}
    resp_meta = getattr(response, "response_metadata", None) or {}
    token_usage = resp_meta.get("token_usage") or resp_meta.get("usage") or usage_meta or {}

    p_tok = int(
        usage_meta.get("input_tokens") or
        token_usage.get("prompt_tokens") or
        token_usage.get("input_tokens") or
        0
    )
    c_tok = int(
        usage_meta.get("output_tokens") or
        token_usage.get("completion_tokens") or
        token_usage.get("output_tokens") or
        0
    )
    t_tok = int(
        usage_meta.get("total_tokens") or
        token_usage.get("total_tokens") or
        (p_tok + c_tok)
    )

    detected_model = (
        resp_meta.get("model_name") or
        resp_meta.get("model") or
        resp_meta.get("deployment_name") or
        model
    )
    finish_reason = resp_meta.get("finish_reason") or "stop"
    cost = pricing_registry.calculate(detected_model, p_tok, c_tok)

    return out_text, p_tok, c_tok, t_tok, cost, finish_reason

def wrap_langchain_model(model_instance: Any, provider: str, default_model: str, tracer: Any = None) -> Any:
    """Wraps LangChain ChatModel or LLM instance (.invoke, .ainvoke, .generate, .agenerate)."""
    from .. import tracer as default_tracer
    active_tracer = tracer or default_tracer

    def get_model_name() -> str:
        return (
            getattr(model_instance, "model_name", None) or
            getattr(model_instance, "model", None) or
            getattr(model_instance, "azure_deployment", None) or
            getattr(model_instance, "deployment_name", None) or
            default_model
        )

    # Wrap .invoke()
    if hasattr(model_instance, "invoke"):
        original_invoke = model_instance.invoke

        @functools.wraps(original_invoke)
        def sync_invoke_wrapper(input_data: Any, *args: Any, **kwargs: Any) -> Any:
            model = get_model_name()
            span_name = f"{provider}.{model}"

            with active_tracer.span(span_name, span_type="llm") as s:
                s.set_attribute("provider", provider)
                s.set_attribute("model", model)
                if hasattr(model_instance, "azure_endpoint"):
                    s.set_attribute("azure_endpoint", str(model_instance.azure_endpoint))

                s.input = serialize_llm_input(input_data)
                try:
                    response = original_invoke(input_data, *args, **kwargs)
                    out_text, p_tok, c_tok, t_tok, cost, finish_reason = extract_langchain_metrics(response, model)
                    s.output = {"content": out_text}
                    s.set_llm_metrics(
                        model=model,
                        prompt_tokens=p_tok,
                        completion_tokens=c_tok,
                        total_tokens=t_tok,
                        cost=cost,
                        finish_reason=finish_reason,
                    )
                    return response
                except Exception as exc:
                    s.fail(exc)
                    raise exc

        model_instance.invoke = sync_invoke_wrapper

    # Wrap .ainvoke()
    if hasattr(model_instance, "ainvoke"):
        original_ainvoke = model_instance.ainvoke

        @functools.wraps(original_ainvoke)
        async def async_invoke_wrapper(input_data: Any, *args: Any, **kwargs: Any) -> Any:
            model = get_model_name()
            span_name = f"{provider}.{model}"

            with active_tracer.span(span_name, span_type="llm") as s:
                s.set_attribute("provider", provider)
                s.set_attribute("model", model)
                if hasattr(model_instance, "azure_endpoint"):
                    s.set_attribute("azure_endpoint", str(model_instance.azure_endpoint))

                s.input = serialize_llm_input(input_data)
                try:
                    response = await original_ainvoke(input_data, *args, **kwargs)
                    out_text, p_tok, c_tok, t_tok, cost, finish_reason = extract_langchain_metrics(response, model)
                    s.output = {"content": out_text}
                    s.set_llm_metrics(
                        model=model,
                        prompt_tokens=p_tok,
                        completion_tokens=c_tok,
                        total_tokens=t_tok,
                        cost=cost,
                        finish_reason=finish_reason,
                    )
                    return response
                except Exception as exc:
                    s.fail(exc)
                    raise exc

        model_instance.ainvoke = async_invoke_wrapper

    # Wrap underlying .client and .async_client if available
    if hasattr(model_instance, "client") and model_instance.client is not None:
        if hasattr(model_instance.client, "chat") and hasattr(model_instance.client.chat, "completions"):
            # Also instrument raw underlying OpenAI/Azure client
            if provider == "azure.openai":
                from .azure import instrument_azure_openai
                instrument_azure_openai(model_instance.client, tracer=active_tracer)
            elif provider == "openai":
                from .openai import instrument_openai
                instrument_openai(model_instance.client, tracer=active_tracer)

    if hasattr(model_instance, "async_client") and model_instance.async_client is not None:
        if hasattr(model_instance.async_client, "chat") and hasattr(model_instance.async_client.chat, "completions"):
            if provider == "azure.openai":
                from .azure import instrument_azure_openai
                instrument_azure_openai(model_instance.async_client, tracer=active_tracer)
            elif provider == "openai":
                from .openai import instrument_openai
                instrument_openai(model_instance.async_client, tracer=active_tracer)

    return model_instance
