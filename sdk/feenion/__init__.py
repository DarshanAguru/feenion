from .tracer import Tracer
from .pricing import (
    PricingRegistry,
    pricing_registry,
    set_model_pricing,
    get_model_cost,
)
from .integrations import (
    instrument_openai,
    wrap_openai,
    instrument_anthropic,
    wrap_anthropic,
    instrument_gemini,
    wrap_gemini,
    instrument_langchain,
    FeenionCallbackHandler,
)

tracer = Tracer()

trace = tracer.trace
span = tracer.span

def configure(
    *,
    server_url: str | None = None,
    api_key: str | None = None,
    exporter = None,
    model_pricing: dict | None = None,
    fetch_live_pricing: bool = False,
):
    """
    Global Feenion configuration.
    
    Args:
        server_url: URL of Feenion telemetry server (e.g. 'http://localhost:8000')
        api_key: Optional API key for authenticating with Feenion server
        exporter: Custom Exporter instance (HTTPExporter, AsyncExporter, ConsoleExporter, CompositeExporter)
        model_pricing: Custom dictionary mapping model names to (prompt_per_1m, completion_per_1m) prices
        fetch_live_pricing: If True, attempts to fetch latest live model rates on startup
    """
    from .exporters import HTTPExporter, AsyncExporter

    if exporter is not None:
        tracer.exporter = exporter
    elif server_url is not None:
        tracer.exporter = AsyncExporter(HTTPExporter(endpoint=server_url, api_key=api_key))

    if model_pricing:
        pricing_registry.register_many(model_pricing)
    if fetch_live_pricing:
        pricing_registry.fetch_live_pricing()

__all__ = [
    "tracer",
    "trace",
    "span",
    "configure",
    "pricing_registry",
    "set_model_pricing",
    "get_model_cost",
    "PricingRegistry",
    "instrument_openai",
    "wrap_openai",
    "instrument_anthropic",
    "wrap_anthropic",
    "instrument_gemini",
    "wrap_gemini",
    "instrument_langchain",
    "FeenionCallbackHandler",
]