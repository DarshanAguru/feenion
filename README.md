# Feenion — Self-Hosted AI Application Debugger & Observability Platform

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Python](https://img.shields.io/badge/Python-3.11%2B-brightgreen.svg)](https://www.python.org/)
[![Docker](https://img.shields.io/badge/Docker-Lightweight-blue.svg)](https://www.docker.com/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Async-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-Vite-61DAFB.svg)](https://reactjs.org/)

**Feenion** is an open-source, self-hosted AI debugging and observability platform designed for developers building LLM applications, RAG pipelines, and autonomous agent frameworks. It provides millisecond trace timelines, animated execution trees, prompt & output glimpse cards, tunable model pricing, and comprehensive model intelligence analytics—all running 100% locally with zero sensitive data leaving your infrastructure.

---

## 🌟 Key Features

- ⚡ **Zero-Overhead & Lightweight (< 40MB RAM)**: Single-command Docker startup with zero external SQL or Redis dependencies. Runs alongside local Ollama or cloud LLMs without system bloat.
- ⚛️ **Modern React Observability Dashboard**: Fast, responsive Vite React interface with real-time WebSocket telemetry updates.
- 📋 **Trace Glimpse & Overview**: Instant high-level glimpse of user input prompts, final agent completions, token breakdowns, and duration KPIs before inspecting raw spans.
- 🌲 **Latency-Proportional Mindmaps & Waterfall Timelines**: Interactive D3 trees with connection lengths proportional to latency, alongside millisecond flamegraph waterfalls.
- 🤖 **LLM Model & Framework Intelligence Analytics**: Dedicated breakdowns of token volume (input/output), total spend ($), average latency, and cost per 1K tokens by model (OpenAI, Anthropic, Gemini, LangChain, etc.).
- 🦜 **First-Class Framework Integrations**:
  - **LangChain**: Native `FeenionCallbackHandler` and `instrument_langchain()` for chains, agents, tools, and retrievers.
  - **OpenAI**: Drop-in client wrapper `wrap_openai(client)`.
  - **Anthropic**: Drop-in client wrapper `wrap_anthropic(client)`.
  - **Custom Functions**: Elegant `@trace` decorator and `with span(...)` context manager.
- 💵 **Tunable Model Pricing & Live Catalog Sync**: Customize prompt/completion rates per model or sync live pricing automatically.
- ⏸️ **High-Velocity Feed Freeze**: Pause incoming live streams (`⏸️ Pause Feed`) during high-traffic surges to inspect traces without viewport jumping.
- 🛡️ **Admin Data Management & Batch Deletion**: Multi-select traces for batch deletion or purge all telemetry data securely.

---

## ⚡ Quickstart (Run in 2 Commands)

### 1. Launch Feenion Server

```bash
git clone https://github.com/feenion/feenion.git
cd feenion
docker compose up -d
```

Open **[http://localhost:8000](http://localhost:8000)** in your browser to access the dashboard.

### 2. Run the Interactive Telemetry Demo

Install dependencies and run the included simulation script:

```bash
pip install -e .
python examples/demo.py
```

The demo simulates real-world OpenAI, Anthropic, and LangChain agent pipelines with live token metrics, multi-tool reasoning, and error captures.

---

## 💻 Python SDK Usage

### Installation

```bash
pip install feenion
```

### Basic Tracing

```python
from feenion import trace, span, configure
from feenion.exporters import HTTPExporter, AsyncExporter

# Configure async background exporter
configure(exporter=AsyncExporter(HTTPExporter("http://localhost:8000")))

@trace(name="customer_support_agent", span_type="agent")
def handle_support_ticket(query: str):
    # 1. Retrieval Span
    with span("knowledge_base_search", span_type="retrieval") as s:
        s.input = {"query": query}
        docs = ["KB Article #104: Password Reset Guide"]
        s.output = {"docs": docs}

    # 2. LLM Completion Span
    with span("llm_response", span_type="llm") as s:
        s.input = {"query": query, "context": docs}
        response = "Please visit settings to reset your password."
        s.output = {"response": response}
        s.set_llm_metrics(
            model="gpt-4o",
            prompt_tokens=320,
            completion_tokens=45,
            cost=0.00125,
        )
        return response

if __name__ == "__main__":
    print(handle_support_ticket("How do I reset my password?"))
```

### LangChain Integration

```python
from feenion.integrations.langchain import FeenionCallbackHandler

handler = FeenionCallbackHandler(trace_name="rag_agent_workflow")

# Pass handler to any LangChain agent, chain, or runnable
agent_executor.invoke({"input": "Analyze quarterly revenue"}, config={"callbacks": [handler]})
```

### Tunable Pricing

```python
import feenion

# Override or define custom model pricing rates ($ per 1M tokens)
feenion.configure(
    model_pricing={
        "gpt-4o": (2.50, 10.00),
        "custom-llama-3": (0.20, 0.60),
    }
)
```

---

## 📊 Dashboard Capabilities

| View | Purpose |
| :--- | :--- |
| **⚡ Traces & Glimpse** | Instant prompt & response glimpses, millisecond waterfall timelines, and latency-scaled mindmaps. |
| **📊 Metrics & Analytics** | Model intelligence breakdown table, token volume doughnuts, spend distributions, and latency SLAs ($P_{50}, P_{90}, P_{99}$). |
| **⚠️ Error Debugger** | Exception fingerprints, occurrence counters, and 1-click failing trace inspection. |
| **🛡️ Admin Management** | Batch trace selection and one-click data purges with credentials (`admin:admin`). |

---

## 📚 Documentation & Resources

- 🌐 [Official Documentation Site](site/docs.html)
- 🛠️ [SDK Guide & API Reference](docs/sdk.md)
- 🤖 [LLM Auto-Instrumentation](docs/llm-instrumentation.md)
- 🌲 [Tracing & Mindmap Visualization](docs/tracing.md)
- 📡 [REST & WebSocket API Spec](docs/api.md)

---

## 📄 License

Feenion is open-source software licensed under the [Apache License 2.0](LICENSE).
