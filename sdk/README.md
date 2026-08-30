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
pip install feenion
```

## Quickstart Examples

### 1. Manual Tracing with Spans

```python
from feenion import trace, span, configure
from feenion.exporters import HTTPExporter, AsyncExporter

configure(exporter=AsyncExporter(HTTPExporter("http://localhost:8000")))

@trace(name="rag_search_agent", span_type="agent")
def run_agent(query: str):
    # Vector Search Span
    with span("hybrid_search", span_type="retrieval") as s:
        s.input = {"query": query}
        docs = ["Feenion is a self-hosted AI observability platform."]
        s.output = {"documents": docs}

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

### 2. LangChain Integration

```python
from feenion.integrations.langchain import FeenionCallbackHandler

handler = FeenionCallbackHandler(trace_name="conversational_agent")

# Attach to agent execution
result = agent_executor.invoke(
    {"input": "Summarize today's active support tickets"},
    config={"callbacks": [handler]},
)
```

### 3. OpenAI Auto-Instrumentation

```python
from openai import OpenAI
from feenion.integrations.openai import wrap_openai

client = wrap_openai(OpenAI())

# Spans, prompt tokens, completion tokens, and dollar costs are recorded automatically
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Explain quantum computing in 2 sentences"}],
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
