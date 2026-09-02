# Feenion Python SDK (`feenion`)

The official, high-performance Python client library for Feenion — the self-hosted AI debugging and observability platform.

## Features

- 🌲 **Dual Sync & Async Tracing**: Trace synchronous functions and `asyncio` coroutines using `@trace` and `with span(...)`.
- ⚡ **Non-Blocking Background Export**: Bounded memory queue (`AsyncExporter`) ensures telemetry export never adds latency to production loops.
- 🦜 **First-Class Framework Integrations**:
  - `feenion.integrations.langchain`: `FeenionCallbackHandler` capturing chains, LLMs, tools, and retrievers.
  - `feenion.integrations.openai`: `wrap_openai(client)` with automatic token counts and model pricing calculations.
  - `feenion.integrations.anthropic`: `wrap_anthropic(client)` wrapping messages and tools.
- 💵 **Dynamic & Tunable Pricing Registry**: Built-in default rates for OpenAI, Anthropic, Gemini, Mistral, and DeepSeek, with developer override APIs (`feenion.configure(model_pricing={...})`).
- 🛡️ **Sensitive Data Redaction**: Automatic masking of passwords, credit cards, bearer tokens, and API keys.
- 🔁 **Trace Replay Engine**: Mock and replay execution trees for deterministic offline testing.

## Installation

```bash
# Using uv (Recommended)
uv add feenion

# Or using pip
pip install feenion
```

## Quickstart Examples

### 1. Manual Tracing with Spans & Customization

```python
import feenion
from feenion import trace, span, configure
from feenion.exporters import HTTPExporter, AsyncExporter

configure(exporter=AsyncExporter(HTTPExporter("http://localhost:8000")))

@trace(name="rag_search_agent", span_type="agent", capture_input=True, capture_output=True)
def run_agent(query: str):
    feenion.set_user("user_401")
    feenion.set_tag("pipeline", "compliance")

    # Vector Search Span
    with span("hybrid_search", span_type="retrieval") as s:
        s.input = {"query": query}
        docs = ["Feenion is a self-hosted AI observability platform."]
        s.output = {"documents": docs}
        feenion.add_event("docs_retrieved", {"count": len(docs)})

    # LLM Completion Span
    with span("llm_completion", span_type="llm") as s:
        s.input = {"prompt": query, "context": docs}
        response = "Feenion runs locally with zero external dependencies."
        s.output = {"response": response}
        s.set_llm_metrics(
            model="gpt-4o",
            prompt_tokens=180,
            completion_tokens=42,
            cost=0.00087,
        )
        return response
```

### 2. LangChain Chat Models & Azure OpenAI Auto-Instrumentation

```python
from langchain_openai import AzureChatOpenAI, ChatOpenAI
from feenion.integrations import wrap_azure_openai, wrap_openai

# Azure OpenAI (LangChain AzureChatOpenAI or raw AzureOpenAI)
azure_llm = wrap_azure_openai(
    AzureChatOpenAI(
        azure_endpoint="https://my-resource.openai.azure.com/",
        api_key="AZURE_API_KEY",
        azure_deployment="gpt-4o",
        api_version="2024-02-01",
    )
)

# OpenAI (LangChain ChatOpenAI or raw OpenAI)
openai_llm = wrap_openai(ChatOpenAI(model="gpt-4o"))

# Telemetry, tokens, and errors are captured automatically across .invoke() / .ainvoke()
response = azure_llm.invoke([("user", "Explain quantum computing in 2 sentences")])
```

### 3. Pluggable Telemetry Exporters

```python
import feenion
from feenion.exporters import (
    AsyncExporter,
    HTTPExporter,
    JSONLExporter,
    ConsoleExporter,
    CompositeExporter,
)

# 1. Non-Blocking Async Exporter (Default for Production)
feenion.configure(
    exporter=AsyncExporter(
        HTTPExporter(
            endpoint="http://localhost:8000",
            api_key="your_api_key",
            project_id="prod-workspace",
        )
    )
)

# 2. Local File Exporter (Air-gapped / CI / Offline Replay)
feenion.configure(exporter=JSONLExporter("traces.jsonl"))

# 3. Terminal Console Exporter
feenion.configure(exporter=ConsoleExporter(verbose=True))

# 4. Multi-Destination Composite Exporter
feenion.configure(
    exporter=CompositeExporter([
        AsyncExporter(HTTPExporter("http://localhost:8000")),
        JSONLExporter("audit_traces.jsonl"),
        ConsoleExporter(verbose=False),
    ])
)
```

### 4. Custom Pricing Overrides

```python
import feenion

feenion.configure(
    model_pricing={
        "gpt-4o": (2.50, 10.00),          # $2.50 prompt / $10.00 completion per 1M tokens
        "custom-llama-3": (0.30, 0.90),
    }
)
```
