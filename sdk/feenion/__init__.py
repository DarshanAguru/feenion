from typing import Any
from .tracer import (
    Tracer,
    get_active_span,
    get_active_trace,
)
from .models import Span, Trace, Event
from .pricing import (
    PricingRegistry,
    pricing_registry,
    set_model_pricing,
    get_model_cost,
)
from .integrations import (
    instrument_openai,
    wrap_openai,
    instrument_azure_openai,
    wrap_azure_openai,
    instrument_azure_ai,
    wrap_azure_ai,
    instrument_anthropic,
    wrap_anthropic,
    instrument_gemini,
    wrap_gemini,
    instrument_langchain,
    FeenionCallbackHandler,
)

from ._version import __version__

tracer = Tracer()

trace = tracer.trace
span = tracer.span

def current_span() -> Span | None:
    """Returns the currently active Span, or None."""
    return get_active_span()

def current_trace() -> Trace | None:
    """Returns the currently active Trace, or None."""
    return get_active_trace()

def set_attribute(key: str, value: Any) -> None:
    """Sets a metadata attribute on the current active span or trace."""
    sp = get_active_span()
    if sp:
        sp.set_attribute(key, value)
    else:
        tr = get_active_trace()
        if tr:
            tr.metadata[key] = value

def set_attributes(attrs: dict[str, Any]) -> None:
    """Sets multiple metadata attributes on the current active span or trace."""
    for k, v in attrs.items():
        set_attribute(k, v)

def set_tag(key: str, value: Any) -> None:
    """Adds a custom tag to the current active span or trace."""
    sp = get_active_span()
    if sp:
        sp.set_tag(key, value)
    else:
        tr = get_active_trace()
        if tr:
            tags = tr.metadata.setdefault("tags", {})
            if isinstance(tags, dict):
                tags[key] = value
            elif isinstance(tags, list):
                tags.append(f"{key}:{value}")

def set_tags(tags: dict[str, Any] | list[str]) -> None:
    """Attaches multiple tags to the current active span or trace."""
    if isinstance(tags, dict):
        for k, v in tags.items():
            set_tag(k, v)
    elif isinstance(tags, list):
        for item in tags:
            if ":" in item:
                k, v = item.split(":", 1)
                set_tag(k, v)
            else:
                set_tag(item, True)

def set_user(user_id: str) -> None:
    """Attaches a user identifier to the current active span and trace."""
    set_attribute("user_id", user_id)

def set_session(session_id: str) -> None:
    """Attaches a session or conversation ID to the current active span and trace."""
    set_attribute("session_id", session_id)

def set_workspace_id(workspace_id: str) -> None:
    """Attaches a workspace ID to the current active span and root trace."""
    set_attribute("workspace_id", workspace_id)
    tr = get_active_trace()
    if tr:
        tr.metadata["workspace_id"] = workspace_id

def set_workspace(workspace_id: str) -> None:
    """Convenience alias for set_workspace_id."""
    set_workspace_id(workspace_id)

def set_api_key(api_key: str) -> None:
    """Attaches an ingestion API key to the current active root trace for authenticated export."""
    tr = get_active_trace()
    if tr:
        tr.metadata["api_key"] = api_key
    set_attribute("api_key", api_key)

def add_event(event_type: str, payload: dict[str, Any] | None = None) -> Event | None:
    """Adds a point-in-time timestamped event to the current active span."""
    sp = get_active_span()
    if sp:
        return sp.add_event(event_type, payload)
    return None

def log(event_type: str, payload: dict[str, Any] | None = None) -> Event | None:
    """Convenience alias for add_event."""
    return add_event(event_type, payload)

def configure(
    *,
    server_url: str | None = None,
    workspace_id: str | None = None,
    api_key: str | None = None,
    exporter = None,
    model_pricing: dict | None = None,
    fetch_live_pricing: bool = False,
    # Backward compatibility aliases
    workspace: str | None = None,
    project_id: str | None = None,
):
    """
    Global Feenion configuration.
    
    Args:
        server_url: URL of Feenion telemetry server (e.g. 'http://localhost:8000')
        workspace_id: The exact Workspace ID from the Feenion Settings UI (e.g. 'd4b8e2...')
        api_key: Optional API key for authenticating with Feenion server
        exporter: Custom Exporter instance (HTTPExporter, AsyncExporter, ConsoleExporter, CompositeExporter)
        model_pricing: Custom dictionary mapping model names to (prompt_per_1m, completion_per_1m) prices
        fetch_live_pricing: If True, attempts to fetch latest live model rates on startup
    """
    from .exporters import HTTPExporter, AsyncExporter

    target_workspace_id = workspace_id or workspace or project_id

    if exporter is not None:
        tracer.exporter = exporter
    elif server_url is not None:
        tracer.exporter = AsyncExporter(
            HTTPExporter(
                endpoint=server_url,
                api_key=api_key,
                workspace_id=target_workspace_id,
            )
        )

    if model_pricing:
        pricing_registry.register_many(model_pricing)
    if fetch_live_pricing:
        pricing_registry.fetch_live_pricing()

def flush() -> None:
    """Flushes all queued telemetry to configured exporters immediately."""
    if tracer.exporter:
        tracer.exporter.flush()

def shutdown() -> None:
    """Flushes and shuts down all configured exporters."""
    if tracer.exporter:
        tracer.exporter.shutdown()

import atexit
atexit.register(shutdown)

__all__ = [
    "tracer",
    "trace",
    "span",
    "current_span",
    "current_trace",
    "set_attribute",
    "set_attributes",
    "set_tag",
    "set_tags",
    "set_user",
    "set_session",
    "set_workspace_id",
    "set_workspace",
    "set_api_key",
    "add_event",
    "log",
    "configure",
    "flush",
    "shutdown",
    "pricing_registry",
    "set_model_pricing",
    "get_model_cost",
    "PricingRegistry",
    "instrument_openai",
    "wrap_openai",
    "instrument_azure_openai",
    "wrap_azure_openai",
    "instrument_azure_ai",
    "wrap_azure_ai",
    "instrument_anthropic",
    "wrap_anthropic",
    "instrument_gemini",
    "wrap_gemini",
    "instrument_langchain",
    "FeenionCallbackHandler",
]