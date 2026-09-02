<p align="center">
  <img src="assets/icon.svg" width="72" height="72" alt="Feenion Icon" />
</p>

<h1 align="center">Feenion</h1>

<p align="center">
  <strong>Open-source, self-hosted AI debugging and observability platform.</strong><br/>
  <em>Debug AI systems like you debug production software.</em>
</p>

<p align="center">
  <a href="https://feenion.fun">Website</a> •
  <a href="https://feenion.fun/docs">Documentation</a> •
  <a href="https://feenion.fun/architecture">Architecture</a> •
  <a href="https://feenion.fun/examples">Examples</a> •
  <a href="#quickstart">Quickstart</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-Apache_2.0-indigo.svg" alt="License" />
  <img src="https://img.shields.io/badge/Python-3.10%2B-brightgreen.svg" alt="Python" />
  <img src="https://img.shields.io/badge/Docker-Self--Hosted-blue.svg" alt="Docker" />
  <img src="https://img.shields.io/badge/FastAPI-Async-009688.svg" alt="FastAPI" />
  <img src="https://img.shields.io/badge/React-18-61DAFB.svg" alt="React" />
  <img src="https://img.shields.io/badge/PRs-Welcome-brightgreen.svg" alt="PRs Welcome" />
</p>

---

## ⚡ What is Feenion?

**Feenion** is an open-source, self-hosted developer observability engine built specifically for LLM applications, RAG pipelines, and autonomous multi-step agents.

Traditional APM tools only report flat HTTP timeouts or generic exceptions. Feenion captures the **entire internal execution story**:

```text
User Query
    │
    ▼
[ Agent Reasoning ] ──► [ Vector Retrieval (top_k=5) ]
    │
    ▼
[ Tool Execution (db.query) ] ──► [ LLM Synthesis (gpt-4o) ]
    │
    ▼
Response + Exact Tokens + Exact Cost + Critical Path Latency
```

### 🔒 100% Self-Hosted & Privacy-First
- **Zero Cloud Leakage**: Your proprietary prompts, vector embeddings, retrieved documents, and API keys never leave your infrastructure.
- **Lightweight (< 40MB RAM)**: Embedded single-container mode runs SQLite with Write-Ahead Logging (WAL) alongside your local Ollama or cloud models.
- **Non-Blocking Ingestion**: Background worker threads decouple trace export from application execution so user requests are never delayed.

---

## 🚀 Quickstart

### 1. Launch Feenion Server with Docker

```bash
git clone https://github.com/DarshanAguru/feenion.git
cd feenion
docker compose up -d
```

Open **[http://localhost:8000](http://localhost:8000)** to view the live dashboard.

### 2. Install the Python SDK

```bash
# Using uv (Recommended)
uv add feenion

# Or using pip
pip install feenion
```

### 3. Trace Your First Function

```python
import feenion
from feenion import trace, span, configure

# Configure target Feenion server
configure(server_url="http://localhost:8000")

@trace(name="customer_support_agent", span_type="agent", capture_input=True, capture_output=True)
def handle_support_query(user_query: str):
    feenion.set_user("user_9921")
    feenion.set_tag("tier", "enterprise")
    
    with span("vector_kb_search", span_type="retrieval", input={"query": user_query}):
        docs = search_knowledge_base(user_query)
        feenion.add_event("docs_retrieved", {"count": len(docs)})

    with span("llm_synthesis", span_type="llm"):
        return generate_answer(user_query, docs)

handle_support_query("How do I rotate my API keys?")
```

---

## 🏗️ System Architecture

```text
  ┌────────────────────────────────────────────────────────┐
  │                 YOUR PYTHON APPLICATION                │
  │   FastAPI • LangChain • LlamaIndex • Autogen • CrewAI  │
  └──────────────────────────┬─────────────────────────────┘
                             │
                      Feenion SDK
                (ContextVar + Async Queue)
                             │
                             ▼  Non-blocking HTTP Batches
  ┌────────────────────────────────────────────────────────┐
  │                  FEENION INGESTION API                 │
  │               FastAPI • Python 3.12 Runtime            │
  └─────────────┬───────────────────────────┬──────────────┘
                │                           │
                ▼                           ▼
  ┌──────────────────────────┐    ┌────────────────────────┐
  │      STORAGE ENGINE      │    │  WEBSOCKET BROADCASTER │
  │ SQLite WAL / PostgreSQL  │    │  Live Telemetry Stream │
  └─────────────┬────────────┘    └─────────┬──────────────┘
                │                           │
                └─────────────┬─────────────┘
                              ▼
  ┌────────────────────────────────────────────────────────┐
  │               FEENION REACT DASHBOARD                  │
  │  Waterfall Timeline • D3 Mindmaps • Error Intelligence │
  └────────────────────────────────────────────────────────┘
```

---

## 🧩 Framework Integrations

### 1. Azure OpenAI & Azure AI Foundry (with LangChain support)

```python
from langchain_openai import AzureChatOpenAI
from feenion.integrations import wrap_azure_openai

# Wraps LangChain AzureChatOpenAI (.invoke, .ainvoke) or raw openai.AzureOpenAI
llm = wrap_azure_openai(AzureChatOpenAI(
    azure_endpoint="https://my-resource.openai.azure.com/",
    api_key="AZURE_API_KEY",
    azure_deployment="gpt-4o",
    api_version="2024-02-01",
))

# Spans, tokens, costs, and any endpoint errors are captured automatically!
response = llm.invoke([("user", "Verify financial compliance batch #8821")])
```

### 2. OpenAI Auto-Instrumentation (Raw SDK & LangChain)

```python
from openai import OpenAI
from langchain_openai import ChatOpenAI
from feenion.integrations import wrap_openai

# Raw OpenAI client
client = wrap_openai(OpenAI())
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Explain raft consensus."}]
)

# LangChain ChatOpenAI
chat_llm = wrap_openai(ChatOpenAI(model="gpt-4o"))
chat_response = chat_llm.invoke("Summarize quantum computing")
```

### 3. Google Gemini Auto-Instrumentation

```python
from google import genai
from feenion.integrations.gemini import instrument_gemini

client = genai.Client()
instrument_gemini(client)

response = client.models.generate_content(
    model="gemini-2.0-flash",
    contents="Explain vector embeddings in machine learning."
)
```

### 4. Anthropic Auto-Instrumentation

```python
from anthropic import Anthropic
from feenion.integrations.anthropic import instrument_anthropic

client = Anthropic()
instrument_anthropic(client)

response = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Analyze system architecture."}]
)
```

### 5. LangChain Native Callback Handler

```python
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from feenion.integrations.langchain import FeenionCallbackHandler

handler = FeenionCallbackHandler(trace_name="pipeline_execution")
llm = ChatOpenAI(model="gpt-4o", callbacks=[handler])

prompt = ChatPromptTemplate.from_template("Summarize: {topic}")
chain = prompt | llm
chain.invoke({"topic": "Distributed Tracing"}, config={"callbacks": [handler]})
```

### 6. Dynamic Customization & Deep Observability Helpers

```python
import feenion

# Inside any function or span:
feenion.set_user("analyst_404")
feenion.set_session("sess_8831")
feenion.set_tag("jurisdiction", "EU_GDPR")
feenion.set_attribute("risk_score", 0.94)
feenion.add_event("checkpoint_reached", {"completed_rules": 14})
```

---

## 📡 Pluggable Telemetry Exporters

Feenion provides 5 built-in, production-ready exporters for diverse infrastructure environments:

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
# Queues spans in-memory and flushes in batches without blocking request threads
feenion.configure(
    exporter=AsyncExporter(
        HTTPExporter(
            endpoint="http://localhost:8000",
            api_key="your_workspace_api_key",
            project_id="prod-rag-pipeline",
        ),
        batch_size=50,
        flush_interval=0.5,
    )
)

# 2. Local File Exporter (Air-Gapped / Offline Testing / CI Replay)
feenion.configure(exporter=JSONLExporter("telemetry/traces.jsonl"))

# 3. Terminal Console Exporter (Local Development & Debugging)
feenion.configure(exporter=ConsoleExporter(verbose=True))

# 4. Composite Exporter (Multi-Destination Telemetry)
# Streams to remote Feenion server while saving local JSONL audit logs
feenion.configure(
    exporter=CompositeExporter([
        AsyncExporter(HTTPExporter("http://localhost:8000")),
        JSONLExporter("audit_traces.jsonl"),
        ConsoleExporter(verbose=False),
    ])
)
```

---

## 🏢 Multi-Tenant Workspace Routing & Authentication

When running multiple services or LLM agents, route telemetry into isolated workspaces using the unique **Workspace ID** provided in the Feenion Web UI (under **Settings → Workspaces**):

> **🔐 Authentication & Local Hosting**:
> - **Local Hosting**: The `api_key` is optional for local development on the same machine.
> - **Remote / Production Deployments**: When hosting Feenion in production with authentication, provide your `api_key` (generated per workspace in Settings).

```python
import feenion
from feenion import trace

# Option 1: Global Workspace Configuration
feenion.configure(
    server_url="http://localhost:8000",
    workspace_id="60d03b94-82a1-4328-874e-7b5fbfbc4402",
    api_key="fn_live_...",  # Optional for local hosting, required if server has auth enabled
)

# Option 2: Dynamic Per-Agent / Per-Trace Workspace Routing (with per-trace Auth)
@trace(
    name="compliance_scanner",
    workspace_id="60d03b94-82a1-4328-874e-7b5fbfbc4402",
    api_key="fn_live_...",  # Authenticate directly to target workspace
)
def run_compliance():
    # Or attach dynamically inside any function:
    feenion.set_workspace_id("60d03b94-82a1-4328-874e-7b5fbfbc4402")
    feenion.set_api_key("fn_live_...")
    return "completed"
```

---

### 7. Zero-Key Comprehensive Mock AI Ecosystem

Run the standalone executable mock demo mimicking Gemini, OpenAI, Claude, RAG retrievers, and Model Context Protocol (MCP) tools:

```bash
python examples/comprehensive_mock_ecosystem.py
```

---

## 📊 Core Observability Features

- ⏱️ **Distributed Waterfall Timeline**: Interactive time-scale flamegraphs with critical path highlights and duration percentiles (p50, p75, p90, p95, p99).
- 🌳 **D3 Mind Map DAG**: Hierarchical execution trees with link distances scaled proportionally to latency.
- 🎯 **Error Intelligence**: Semantic error fingerprinting that clusters identical exceptions and links to root cause spans.
- 🤖 **Model Analytics Matrix**: Comprehensive breakdown of prompt vs completion tokens, cumulative spend ($), and cost per 1K tokens by model.
- ⏸️ **High-Velocity Feed Freeze**: Pause incoming live streams (`⏸️ Pause Feed`) during high-traffic bursts to inspect traces without viewport jumping.
- 🔍 **Comparative Trace Regression Diff**: Side-by-side comparison modal to isolate why Trace A was 3x slower or used 4x more tokens than Trace B.

---

## ⚙️ Configuration Options

| Variable | Default | Description |
| :--- | :--- | :--- |
| `FEENION_DATABASE_URL` | `sqlite:////app/data/feenion.db` | Storage connection string (SQLite WAL or PostgreSQL) |
| `FEENION_REDIS_URL` | `""` | Optional Redis URL for distributed asynchronous queues |
| `FEENION_LOG_LEVEL` | `INFO` | Logging level (`DEBUG`, `INFO`, `WARNING`, `ERROR`) |
| `FEENION_RETENTION_DAYS` | `30` | Auto-retention period for trace telemetry |

---

## 🛠️ Local Development & Contributing

Contributions are welcome! Feenion is built in the open.

```bash
# 1. Clone repo
git clone https://github.com/DarshanAguru/feenion.git
cd feenion

# 2. Setup Python environment
python3 -m venv .venv
source .venv/bin/activate
pip install -r server/requirements.txt
pip install -e ".[dev]"

# 3. Run test suite
pytest

# 4. Build Frontend UI
cd web
npm install
npm run build
```

---

## 📡 REST & WebSocket API

The Feenion telemetry server provides high-performance asynchronous endpoints for ingestion, exploration, deep analytics, and live WebSocket push:

| Category | Key Endpoints | Description |
| -------- | ------------- | ----------- |
| **Ingestion** | `POST /api/v1/traces`<br/>`WS /api/v1/ws/telemetry` | High-throughput batch ingestion (with Gzip support) and real-time live event streaming. |
| **Queries** | `GET /api/v1/traces`<br/>`GET /api/v1/traces/{id}`<br/>`GET /api/v1/traces/{id}/spans` | Multi-dimensional trace search, full causality tree, and child span hierarchy. |
| **Analytics** | `GET /api/v1/analytics/overview`<br/>`GET /api/v1/analytics/models`<br/>`GET /api/v1/analytics/tools`<br/>`GET /api/v1/analytics/retrieval`<br/>`GET /api/v1/analytics/agents`<br/>`GET /api/v1/errors` | System health scores, latency percentiles (p50-p99), model token economics, tool calling stats, RAG metrics, and error clustering. |
| **Workspaces** | `GET /api/v1/projects`<br/>`POST /api/v1/projects`<br/>`DELETE /api/v1/projects/{id}` | Multi-tenant workspace management and API key provisioning. |
| **Admin** | `DELETE /api/v1/admin/traces`<br/>`POST /api/v1/admin/traces/batch-delete`<br/>`DELETE /api/v1/admin/traces/{id}` | Telemetry database purge, batch trace deletion, and single trace removal. |
| **Probes** | `GET /health`<br/>`GET /ready` | Liveness and readiness health probes for container orchestrators. |

For detailed payloads, schemas, query parameters, and cURL examples, see the **[Full API Specification](docs/api.md)** or the **[Interactive Web Documentation](https://feenion.fun/docs#api-reference)**.

---

## 🗺️ Project Roadmap

- [x] Python SDK with non-blocking async batch exporter
- [x] Google Gemini, OpenAI, Anthropic, and LangChain auto-instrumentation
- [x] Zero-key interactive CLI debugging simulator (`examples/comprehensive_mock_ecosystem.py`)
- [x] Waterfall distributed timeline & D3 latency mind map
- [x] Semantic error grouping & stack trace viewer
- [x] Model economics & prompt inflation analytics
- [x] Workspace & project lifecycle management with cascade deletion
- [ ] TypeScript / Node.js SDK
- [ ] OpenTelemetry (OTel) Collector receiver
- [ ] Automated RAG context evaluation metrics (Faithfulness & Relevance)

---

## 📄 License & Credits

Feenion is open-source software licensed under the **[Apache License 2.0](LICENSE)**.

<p align="center">
  <sub>copyright &copy; 2026 feenion &bull; made with ❤️ by <a href="https://thisdarshiii.in"><strong>A.Darshan</strong></a></sub>
</p>


