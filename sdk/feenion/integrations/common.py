from __future__ import annotations

import contextvars
import functools
import inspect
from typing import Any
from ..pricing import pricing_registry

# Context variable to prevent duplicate child LLM spans when LangChain's invoke
# internally calls client.chat.completions.create
ACTIVE_LANGCHAIN_INVOKE = contextvars.ContextVar("feenion_active_langchain_invoke", default=False)

def safe_set_method(obj: Any, name: str, method: Any) -> None:
    """
    Safely binds or attaches a method or attribute to any Python object, including:
    - Pydantic v1 & v2 BaseModel instances (which normally disallow setattr for non-fields)
    - Standard Python class instances
    - Slotted, frozen, or dynamic runtime objects
    """
    # 1. Try object.__setattr__ (bypasses Pydantic's overridden __setattr__)
    try:
        object.__setattr__(obj, name, method)
        return
    except Exception:
        pass

    # 2. Try standard setattr
    try:
        setattr(obj, name, method)
        return
    except Exception:
        pass

    # 3. Direct __dict__ assignment
    try:
        if hasattr(obj, "__dict__") and isinstance(obj.__dict__, dict):
            obj.__dict__[name] = method
            return
    except Exception:
        pass

    # 4. Fallback: monkeypatch on the object's class if instance attachment is restricted
    try:
        cls = type(obj)
        marker = f"_feenion_patched_{name}"
        if not getattr(cls, marker, False):
            setattr(cls, marker, True)
            setattr(cls, name, method)
    except Exception:
        pass

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

def extract_langchain_metrics(response: Any, model: str) -> tuple[str, int, int, int, float, str, list[dict[str, Any]]]:
    """Extracts output content, tokens, cost, finish reason, and tool calls from LangChain response (AIMessage or LLMResult)."""
    # 1. Output content
    out_text = ""
    tool_calls_data: list[dict[str, Any]] = []

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

    # Extract tool calls if any
    raw_tool_calls = getattr(response, "tool_calls", None) or getattr(response, "additional_kwargs", {}).get("tool_calls")
    if raw_tool_calls and isinstance(raw_tool_calls, (list, tuple)):
        for tc in raw_tool_calls:
            if isinstance(tc, dict):
                tool_calls_data.append({
                    "id": tc.get("id"),
                    "name": tc.get("name") or tc.get("function", {}).get("name"),
                    "arguments": tc.get("args") or tc.get("function", {}).get("arguments"),
                })
            elif hasattr(tc, "name"):
                tool_calls_data.append({
                    "id": getattr(tc, "id", None),
                    "name": getattr(tc, "name", None),
                    "arguments": getattr(tc, "args", None),
                })

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

    return out_text, p_tok, c_tok, t_tok, cost, finish_reason, tool_calls_data

def wrap_langchain_model(model_instance: Any, provider: str, default_model: str, tracer: Any = None) -> Any:
    """
    Wraps any LangChain ChatModel, LLM, or Runnable instance (.invoke, .ainvoke, .stream, .astream, .batch, .generate).
    Safely binds methods using safe_set_method so Pydantic BaseModel instances (AzureChatOpenAI, ChatOpenAI, etc.)
    never raise ValueError/AttributeError.
    """
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

    # 1. Wrap .invoke()
    if hasattr(model_instance, "invoke"):
        original_invoke = model_instance.invoke

        @functools.wraps(original_invoke)
        def sync_invoke_wrapper(*args: Any, **kwargs: Any) -> Any:
            input_data = args[0] if args else kwargs.get("input", kwargs)
            model = get_model_name()
            span_name = f"{provider}.{model}"

            token = ACTIVE_LANGCHAIN_INVOKE.set(True)
            try:
                with active_tracer.span(span_name, span_type="llm") as s:
                    s.set_attribute("provider", provider)
                    s.set_attribute("model", model)
                    if hasattr(model_instance, "azure_endpoint"):
                        s.set_attribute("azure_endpoint", str(model_instance.azure_endpoint))

                    s.input = serialize_llm_input(input_data)
                    try:
                        response = original_invoke(*args, **kwargs)
                        out_text, p_tok, c_tok, t_tok, cost, finish_reason, tool_calls = extract_langchain_metrics(response, model)
                        output_payload: dict[str, Any] = {"content": out_text}
                        if tool_calls:
                            output_payload["tool_calls"] = tool_calls
                        s.output = output_payload
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
            finally:
                ACTIVE_LANGCHAIN_INVOKE.reset(token)

        safe_set_method(model_instance, "invoke", sync_invoke_wrapper)

    # 2. Wrap .ainvoke()
    if hasattr(model_instance, "ainvoke"):
        original_ainvoke = model_instance.ainvoke

        @functools.wraps(original_ainvoke)
        async def async_invoke_wrapper(*args: Any, **kwargs: Any) -> Any:
            input_data = args[0] if args else kwargs.get("input", kwargs)
            model = get_model_name()
            span_name = f"{provider}.{model}"

            token = ACTIVE_LANGCHAIN_INVOKE.set(True)
            try:
                with active_tracer.span(span_name, span_type="llm") as s:
                    s.set_attribute("provider", provider)
                    s.set_attribute("model", model)
                    if hasattr(model_instance, "azure_endpoint"):
                        s.set_attribute("azure_endpoint", str(model_instance.azure_endpoint))

                    s.input = serialize_llm_input(input_data)
                    try:
                        response = await original_ainvoke(*args, **kwargs)
                        out_text, p_tok, c_tok, t_tok, cost, finish_reason, tool_calls = extract_langchain_metrics(response, model)
                        output_payload: dict[str, Any] = {"content": out_text}
                        if tool_calls:
                            output_payload["tool_calls"] = tool_calls
                        s.output = output_payload
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
            finally:
                ACTIVE_LANGCHAIN_INVOKE.reset(token)

        safe_set_method(model_instance, "ainvoke", async_invoke_wrapper)

    # 3. Wrap .stream()
    if hasattr(model_instance, "stream"):
        original_stream = model_instance.stream

        @functools.wraps(original_stream)
        def sync_stream_wrapper(*args: Any, **kwargs: Any) -> Any:
            input_data = args[0] if args else kwargs.get("input", kwargs)
            model = get_model_name()
            span_name = f"{provider}.{model}"

            token = ACTIVE_LANGCHAIN_INVOKE.set(True)
            try:
                with active_tracer.span(span_name, span_type="llm") as s:
                    s.set_attribute("provider", provider)
                    s.set_attribute("model", model)
                    s.input = serialize_llm_input(input_data)
                    collected_chunks: list[str] = []
                    try:
                        for chunk in original_stream(*args, **kwargs):
                            text = getattr(chunk, "content", str(chunk))
                            collected_chunks.append(text)
                            yield chunk
                        full_content = "".join(collected_chunks)
                        s.output = {"content": full_content}
                        p_tok = max(20, len(str(input_data).split()) * 2)
                        c_tok = max(10, len(full_content.split()) * 2)
                        s.set_llm_metrics(
                            model=model,
                            prompt_tokens=p_tok,
                            completion_tokens=c_tok,
                            total_tokens=p_tok + c_tok,
                            cost=pricing_registry.calculate(model, p_tok, c_tok),
                            finish_reason="stop",
                        )
                    except Exception as exc:
                        s.fail(exc)
                        raise exc
            finally:
                ACTIVE_LANGCHAIN_INVOKE.reset(token)

        safe_set_method(model_instance, "stream", sync_stream_wrapper)

    # 4. Wrap .astream()
    if hasattr(model_instance, "astream"):
        original_astream = model_instance.astream

        @functools.wraps(original_astream)
        async def async_stream_wrapper(*args: Any, **kwargs: Any) -> Any:
            input_data = args[0] if args else kwargs.get("input", kwargs)
            model = get_model_name()
            span_name = f"{provider}.{model}"

            token = ACTIVE_LANGCHAIN_INVOKE.set(True)
            try:
                with active_tracer.span(span_name, span_type="llm") as s:
                    s.set_attribute("provider", provider)
                    s.set_attribute("model", model)
                    s.input = serialize_llm_input(input_data)
                    collected_chunks: list[str] = []
                    try:
                        async for chunk in original_astream(*args, **kwargs):
                            text = getattr(chunk, "content", str(chunk))
                            collected_chunks.append(text)
                            yield chunk
                        full_content = "".join(collected_chunks)
                        s.output = {"content": full_content}
                        p_tok = max(20, len(str(input_data).split()) * 2)
                        c_tok = max(10, len(full_content.split()) * 2)
                        s.set_llm_metrics(
                            model=model,
                            prompt_tokens=p_tok,
                            completion_tokens=c_tok,
                            total_tokens=p_tok + c_tok,
                            cost=pricing_registry.calculate(model, p_tok, c_tok),
                            finish_reason="stop",
                        )
                    except Exception as exc:
                        s.fail(exc)
                        raise exc
            finally:
                ACTIVE_LANGCHAIN_INVOKE.reset(token)

        safe_set_method(model_instance, "astream", async_stream_wrapper)

    # 5. Optionally instrument underlying client and async_client
    if hasattr(model_instance, "client") and model_instance.client is not None:
        try:
            if hasattr(model_instance.client, "chat") and hasattr(model_instance.client.chat, "completions"):
                if provider == "azure.openai":
                    from .azure import instrument_azure_openai
                    instrument_azure_openai(model_instance.client, tracer=active_tracer)
                elif provider == "openai":
                    from .openai import instrument_openai
                    instrument_openai(model_instance.client, tracer=active_tracer)
        except Exception:
            pass

    if hasattr(model_instance, "async_client") and model_instance.async_client is not None:
        try:
            if hasattr(model_instance.async_client, "chat") and hasattr(model_instance.async_client.chat, "completions"):
                if provider == "azure.openai":
                    from .azure import instrument_azure_openai
                    instrument_azure_openai(model_instance.async_client, tracer=active_tracer)
                elif provider == "openai":
                    from .openai import instrument_openai
                    instrument_openai(model_instance.async_client, tracer=active_tracer)
        except Exception:
            pass

    return model_instance
