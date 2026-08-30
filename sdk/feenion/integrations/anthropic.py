from __future__ import annotations

import functools
from typing import Any
from ..pricing import pricing_registry

def instrument_anthropic(client: Any = None, tracer: Any = None) -> Any:
    """
    Instruments Anthropic SDK client to capture Claude model messages automatically with tunable model pricing.
    Returns the instrumented client for convenience.
    """
    from .. import tracer as default_tracer
    active_tracer = tracer or default_tracer

    def wrap_messages_create(original_create: Any) -> Any:
        @functools.wraps(original_create)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            model = kwargs.get("model", "claude-3-5-sonnet")
            messages = kwargs.get("messages", [])

            with active_tracer.span(f"anthropic.{model}", span_type="llm") as s:
                s.input = {
                    "model": model,
                    "messages": messages,
                    "temperature": kwargs.get("temperature", 1.0),
                }
                try:
                    response = original_create(*args, **kwargs)
                    
                    usage = getattr(response, "usage", None)
                    p_tok = getattr(usage, "input_tokens", 0) if usage else 0
                    c_tok = getattr(usage, "output_tokens", 0) if usage else 0
                    t_tok = p_tok + c_tok

                    content = getattr(response, "content", [])
                    out_text = content[0].text if content and hasattr(content[0], "text") else ""

                    s.output = {"role": "assistant", "content": out_text}

                    # Compute cost using dynamic tunable registry
                    cost = pricing_registry.calculate(model, p_tok, c_tok)

                    s.set_llm_metrics(
                        model=model,
                        prompt_tokens=p_tok,
                        completion_tokens=c_tok,
                        total_tokens=t_tok,
                        cost=cost,
                        finish_reason="stop",
                    )
                    return response
                except Exception as exc:
                    s.fail(exc)
                    raise exc

        return sync_wrapper

    if client is not None:
        if hasattr(client, "messages") and hasattr(client.messages, "create"):
            client.messages.create = wrap_messages_create(client.messages.create)

    return client

def wrap_anthropic(client: Any) -> Any:
    """
    Convenience functional wrapper that instruments and returns the Anthropic client.
    Example: `claude = wrap_anthropic(Anthropic())`
    """
    return instrument_anthropic(client)
