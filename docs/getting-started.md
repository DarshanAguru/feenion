# Getting Started with Feenion

Welcome to **Feenion**! This guide walks you through setting up Feenion in ultra-lightweight Docker mode, installing the Python SDK, instrumenting your AI application, and viewing execution traces in the Web UI dashboard.

---

## 📋 Prerequisites

- **Docker** & **Docker Compose** installed on your machine.
- **Python 3.11+** installed for your application environment.

> [!NOTE]
> You do **NOT** need to install PostgreSQL, Redis, or any external SQL servers. Feenion runs out-of-the-box in a single lightweight container (~40MB RAM) so your system RAM and GPU remain fully available for running local LLMs, Ollama, or API calls.

---

## ⚡ Step 1: Launch Feenion Server Stack

Clone the repository and spin up Feenion:

```bash
git clone https://github.com/DarshanAguru/feenion.git
cd feenion
docker compose up -d
```

Verify that the container is running:

```bash
docker compose ps
```

Access the Web UI Dashboard at **[http://localhost:8000](http://localhost:8000)**.

---

## 📦 Step 2: Install the Feenion Python SDK

In your AI application environment, install `feenion`:

```bash
# Using uv (Recommended)
uv add feenion

# Or using pip
pip install feenion
```

---

## 💻 Step 3: Instrument Your AI Application

Create a file `main.py`:

```python
import time
from feenion import trace, span, configure
from feenion.exporters import HTTPExporter, AsyncExporter

# Configure async non-blocking HTTP exporter
configure(
    exporter=AsyncExporter(
        HTTPExporter("http://localhost:8000")
    )
)

def perform_vector_search(query: str):
    with span("vector_search", span_type="retrieval") as s:
        s.input = {"query": query, "top_k": 3}
        time.sleep(0.05) # Simulate database search
        docs = ["Doc 1: Refund within 30 days", "Doc 2: Contact support@company.com"]
        s.output = docs
        return docs

def call_language_model(prompt: str, context: list[str]):
    with span("gpt-4o_completion", span_type="llm") as s:
        s.input = {"prompt": prompt, "context": context}
        time.sleep(0.15) # Simulate LLM API call
        answer = "Our refund policy allows returns within 30 days of purchase."
        s.output = answer
        s.set_llm_metrics(
            model="gpt-4o",
            prompt_tokens=35,
            completion_tokens=18,
            cost=0.0015
        )
        return answer

@trace(name="customer_support_agent")
def handle_customer_inquiry(user_question: str):
    docs = perform_vector_search(user_question)
    response = call_language_model(user_question, docs)
    return response

if __name__ == "__main__":
    print("Executing AI agent...")
    result = handle_customer_inquiry("What is your refund policy?")
    print("Agent Result:", result)
```

Run your application:

```bash
python main.py
```

---

## 🖥️ Step 4: Visual Debugging in Web Dashboard

1. Open **[http://localhost:8000](http://localhost:8000)** in your browser.
2. Click on **`customer_support_agent`** in the left sidebar.
3. View the trace tree and Gantt timeline chart to inspect inputs, outputs, attributes, token metrics, and execution latency.
