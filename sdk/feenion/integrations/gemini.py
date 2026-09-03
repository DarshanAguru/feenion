from __future__ import annotations

import functools
import inspect
from typing import Any
from ..pricing import pricing_registry

def instrument_gemini(target: Any = None, tracer: Any = None) -> Any:
    """
    Instruments Google Gemini SDK clients or GenerativeModel instances (plus LangChain ChatGoogleGenerativeAI)
    to capture LLM calls automatically with model tracking, token metrics, latency, and cost calculation.

    Supports:
    - google-genai Client (`client.models.generate_content`)
    - google-generativeai GenerativeModel (`model.generate_content`)
    - google-generativeai ChatSession (`chat.send_message`)
    - langchain-google-genai `ChatGoogleGenerativeAI` (.invoke, .ainvoke)

    Returns the instrumented object for convenience.
    """
    from .. import tracer as default_tracer
    active_tracer = tracer or default_tracer

    def _process_response(s: Any, response: Any, model: str) -> None:
        usage = getattr(response, "usage_metadata", None)
        p_tok = getattr(usage, "prompt_token_count", 0) if usage else 0
        c_tok = getattr(usage, "candidates_token_count", 0) if usage else 0
        t_tok = getattr(usage, "total_token_count", p_tok + c_tok) if usage else (p_tok + c_tok)

        out_text = getattr(response, "text", "")
        finish_reason = "stop"
        candidates = getattr(response, "candidates", [])
        if candidates and hasattr(candidates[0], "finish_reason"):
            finish_reason = str(getattr(candidates[0], "finish_reason", "stop"))

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

    from .common import ACTIVE_LANGCHAIN_INVOKE, wrap_langchain_model

    # 1. LangChain model (e.g. ChatGoogleGenerativeAI)
    if hasattr(target, "invoke") or hasattr(target, "generate") or hasattr(target, "callbacks"):
        return wrap_langchain_model(target, provider="gemini", default_model="gemini-2.0-flash", tracer=active_tracer)

    def wrap_google_genai_generate(original_func: Any, default_model: str = "gemini-2.0-flash") -> Any:
        if inspect.iscoroutinefunction(original_func):
            @functools.wraps(original_func)
            async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
                if ACTIVE_LANGCHAIN_INVOKE.get():
                    return await original_func(*args, **kwargs)

                model = kwargs.get("model") or (args[0] if len(args) > 0 and isinstance(args[0], str) else default_model)
                contents = kwargs.get("contents") or (args[1] if len(args) > 1 else (args[0] if len(args) > 0 and not isinstance(args[0], str) else None))

                with active_tracer.span(f"gemini.{model}", span_type="llm") as s:
                    s.set_attribute("provider", "google_genai")
                    s.input = {
                        "model": model,
                        "contents": str(contents) if contents is not None else "",
                    }
                    try:
                        response = await original_func(*args, **kwargs)
                        _process_response(s, response, model)
                        return response
                    except Exception as exc:
                        s.fail(exc)
                        raise exc
            return async_wrapper
        else:
            @functools.wraps(original_func)
            def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
                if ACTIVE_LANGCHAIN_INVOKE.get():
                    return original_func(*args, **kwargs)

                model = kwargs.get("model") or (args[0] if len(args) > 0 and isinstance(args[0], str) else default_model)
                contents = kwargs.get("contents") or (args[1] if len(args) > 1 else (args[0] if len(args) > 0 and not isinstance(args[0], str) else None))

                with active_tracer.span(f"gemini.{model}", span_type="llm") as s:
                    s.set_attribute("provider", "google_genai")
                    s.input = {
                        "model": model,
                        "contents": str(contents) if contents is not None else "",
                    }
                    try:
                        response = original_func(*args, **kwargs)
                        _process_response(s, response, model)
                        return response
                    except Exception as exc:
                        s.fail(exc)
                        raise exc
            return sync_wrapper

    if target is not None:
        # Case 1: google-genai Client instance (has client.models.generate_content)
        if hasattr(target, "models") and hasattr(target.models, "generate_content"):
            target.models.generate_content = wrap_google_genai_generate(target.models.generate_content)

        # Case 2: google-generativeai GenerativeModel instance
        elif hasattr(target, "generate_content"):
            model_name = getattr(target, "model_name", "gemini-2.0-flash")
            target.generate_content = wrap_google_genai_generate(target.generate_content, default_model=model_name)

        # Case 3: google-generativeai ChatSession instance
        elif hasattr(target, "send_message"):
            model_name = getattr(getattr(target, "model", None), "model_name", "gemini-2.0-flash")
            target.send_message = wrap_google_genai_generate(target.send_message, default_model=model_name)

    return target

def wrap_gemini(client_or_model: Any, tracer: Any = None) -> Any:
    """
    Convenience functional wrapper that instruments and returns the Gemini client or model.
    Example:
    `client = wrap_gemini(genai.Client())` or `model = wrap_gemini(genai.GenerativeModel('gemini-2.0-flash'))`
    """
    return instrument_gemini(client_or_model, tracer=tracer)

