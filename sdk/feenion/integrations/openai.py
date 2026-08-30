from __future__ import annotations

import functools
from typing import Any
from ..pricing import pricing_registry

def instrument_openai(client: Any = None, tracer: Any = None) -> Any:
    """
    Instruments OpenAI SDK client to capture LLM calls automatically with tunable model pricing.
    Returns the instrumented client for convenience.
    """
    from .. import tracer as default_tracer
    active_tracer = tracer or default_tracer

    def wrap_chat_create(original_create: Any) -> Any:
        @functools.wraps(original_create)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            model = kwargs.get("model", "gpt-4o")
            messages = kwargs.get("messages", [])

            with active_tracer.span(f"openai.{model}", span_type="llm") as s:
                s.input = {
                    "model": model,
                    "messages": messages,
                    "temperature": kwargs.get("temperature", 1.0),
                }
                try:
                    response = original_create(*args, **kwargs)
                    
                    # Extract usage
                    usage = getattr(response, "usage", None)
                    p_tok = getattr(usage, "prompt_tokens", 0) if usage else 0
                    c_tok = getattr(usage, "completion_tokens", 0) if usage else 0
                    t_tok = getattr(usage, "total_tokens", p_tok + c_tok) if usage else (p_tok + c_tok)

                    # Extract output text
                    choices = getattr(response, "choices", [])
                    out_text = ""
                    finish_reason = "stop"
                    if choices:
                        msg = getattr(choices[0], "message", None)
                        out_text = getattr(msg, "content", "") if msg else ""
                        finish_reason = getattr(choices[0], "finish_reason", "stop")

                    s.output = {"role": "assistant", "content": out_text}

                    # Compute cost using dynamic tunable registry
                    cost = pricing_registry.calculate(model, p_tok, c_tok)

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

        return sync_wrapper

    if client is not None:
        if hasattr(client, "chat") and hasattr(client.chat, "completions"):
            client.chat.completions.create = wrap_chat_create(client.chat.completions.create)

    return client

def wrap_openai(client: Any) -> Any:
    """
    Convenience functional wrapper that instruments and returns the OpenAI client.
    Example: `client = wrap_openai(OpenAI())`
    """
    return instrument_openai(client)
