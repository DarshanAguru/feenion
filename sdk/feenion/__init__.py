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
    instrument_langchain,
    FeenionCallbackHandler,
)

tracer = Tracer()

trace = tracer.trace
span = tracer.span

def configure(
    *,
    exporter = None,
    model_pricing: dict | None = None,
    fetch_live_pricing: bool = False,
):
    """
    Global Feenion configuration.
    
    Args:
        exporter: Exporter instance (HTTPExporter, AsyncExporter, ConsoleExporter)
        model_pricing: Custom dictionary mapping model names to (prompt_per_1m, completion_per_1m) prices
        fetch_live_pricing: If True, attempts to fetch latest live model rates on startup
    """
    if exporter is not None:
        tracer.exporter = exporter
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
    "instrument_langchain",
    "FeenionCallbackHandler",
]