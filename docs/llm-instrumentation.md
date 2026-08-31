# LLM Auto-Instrumentation

Feenion provides integrations for automatic capture of LLM prompts, completions, latency, model types, token usage, and cost estimates.

---

## OpenAI Integration

Instrument the official `openai` SDK client:

```python
from openai import OpenAI
from feenion import configure
from feenion.exporters import HTTPExporter, AsyncExporter
from feenion.integrations.openai import instrument_openai

configure(exporter=AsyncExporter(HTTPExporter("http://localhost:8000")))

client = OpenAI()
instrument_openai(client)

# All client.chat.completions.create calls will be automatically captured as LLM spans
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Explain quantum computing in one sentence."}],
)
print(response.choices[0].message.content)
```

---

## Anthropic Integration

Instrument the official `anthropic` SDK client:

```python
from anthropic import Anthropic
from feenion import configure
from feenion.exporters import HTTPExporter, AsyncExporter
from feenion.integrations.anthropic import instrument_anthropic

configure(exporter=AsyncExporter(HTTPExporter("http://localhost:8000")))

client = Anthropic()
instrument_anthropic(client)

response = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hi Claude!"}],
)
print(response.content[0].text)
```

---

## Google Gemini Integration

Instrument Google Gemini clients (`google-genai` or `google-generativeai`):

```python
from google import genai
from feenion import configure
from feenion.exporters import HTTPExporter, AsyncExporter
from feenion.integrations.gemini import instrument_gemini

configure(exporter=AsyncExporter(HTTPExporter("http://localhost:8000")))

client = genai.Client()
instrument_gemini(client)

response = client.models.generate_content(
    model="gemini-2.0-flash",
    contents="Explain distributed consensus algorithms."
)
print(response.text)
```

---

## Manual LLM Metrics Capture

If using a custom or local LLM (e.g. Ollama, vLLM, llama.cpp):

```python
with span("custom_llm_call", span_type="llm") as s:
    s.input = {"prompt": prompt}
    output_text = my_llm.generate(prompt)
    s.output = {"text": output_text}
    s.set_llm_metrics(
        model="llama3-70b",
        prompt_tokens=120,
        completion_tokens=45,
        cost=0.0
    )
```

---

## Zero-Key Comprehensive Mock AI Ecosystem

To test Feenion locally without setting up API keys or paid accounts, run our self-contained mock ecosystem script mimicking Google Gemini, OpenAI, Claude, Chroma vector retrieval, and Model Context Protocol (MCP) tools:

```bash
python examples/comprehensive_mock_ecosystem.py
```

