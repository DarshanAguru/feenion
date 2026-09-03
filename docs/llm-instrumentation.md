# LLM Auto-Instrumentation

Feenion provides seamless auto-instrumentation for the leading LLM SDKs and agentic frameworks, automatically capturing prompts, completions, latency, model types, token usage, cost estimates, and tool calls.

---

## 🔷 Azure OpenAI & LangChain Integration

Feenion supports both the raw **Azure OpenAI SDK** (`openai.AzureOpenAI`) and **LangChain** (`langchain_openai.AzureChatOpenAI`).

### With LangChain (`AzureChatOpenAI`):
```python
from langchain_openai import AzureChatOpenAI
from feenion import configure, wrap_azure_openai

configure(server_url="http://localhost:8000", workspace_id="default")

# Wrap the LangChain AzureChatOpenAI instance
client = wrap_azure_openai(
    AzureChatOpenAI(
        azure_endpoint="https://your-resource.openai.azure.com/",
        api_key="your-api-key",
        azure_deployment="gpt-4o",
        api_version="2024-02-15-preview",
        temperature=0.1,
    )
)

# .invoke(), .ainvoke(), and .stream() are automatically traced
response = client.invoke(
    [
        ("system", "You are a compliance monitoring system."),
        ("user", "Analyze corporate communications for security risks."),
    ],
    response_format={"type": "json_object"}
)
print(response.content)
```

### With Official Azure OpenAI SDK:
```python
from openai import AzureOpenAI
from feenion import configure, wrap_azure_openai

configure(server_url="http://localhost:8000", workspace_id="default")

client = wrap_azure_openai(
    AzureOpenAI(
        azure_endpoint="https://your-resource.openai.azure.com/",
        api_key="your-api-key",
        api_version="2024-02-15-preview",
    )
)

# Standard completions
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Explain quantum computing in one sentence."}],
)
print(response.choices[0].message.content)

# Drop-in .invoke() compatibility adapter is also available!
resp = client.invoke([("user", "Hello Azure!")])
print(resp.content)
```

---

## ⚡ Azure AI Foundry & Model Catalog (`azure-ai-inference`)

For models hosted in Azure AI Foundry (e.g. Llama 3, Mistral, Cohere):

```python
from azure.ai.inference import ChatCompletionsClient
from azure.core.credentials import AzureKeyCredential
from feenion import configure, wrap_azure_ai

configure(server_url="http://localhost:8000", workspace_id="default")

client = wrap_azure_ai(
    ChatCompletionsClient(
        endpoint="https://your-foundry-model.services.ai.azure.com/models",
        credential=AzureKeyCredential("your-key"),
    )
)

response = client.complete(
    messages=[{"role": "user", "content": "Analyze compliance policies"}],
    model="azure-llama-3-70b",
)
print(response.choices[0].message.content)
```

---

## 🟢 OpenAI Integration

Works with both the official `openai` SDK (`OpenAI`, `AsyncOpenAI`) and LangChain's `ChatOpenAI`:

```python
from openai import OpenAI
from feenion import configure, wrap_openai

configure(server_url="http://localhost:8000", workspace_id="default")

client = wrap_openai(OpenAI())

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Explain quantum computing in one sentence."}],
)
print(response.choices[0].message.content)
```

---

## 🟣 Anthropic Claude Integration

Instruments official `anthropic` SDK clients (`Anthropic`, `AsyncAnthropic`, and LangChain's `ChatAnthropic`):

```python
from anthropic import Anthropic
from feenion import configure, wrap_anthropic

configure(server_url="http://localhost:8000", workspace_id="default")

client = wrap_anthropic(Anthropic())

response = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hi Claude!"}],
)
print(response.content[0].text)
```

---

## 🔵 Google Gemini Integration

Instruments Google Gemini clients (`google-genai` or `google-generativeai`, and LangChain's `ChatGoogleGenerativeAI`):

```python
from google import genai
from feenion import configure, wrap_gemini

configure(server_url="http://localhost:8000", workspace_id="default")

client = wrap_gemini(genai.Client())

response = client.models.generate_content(
    model="gemini-2.0-flash",
    contents="Explain distributed consensus algorithms."
)
print(response.text)
```

---

## 🦜 LangChain Callback Handler

For complex LangChain chains, agents, and multi-step tool execution pipelines:

```python
from feenion.integrations.langchain import instrument_langchain
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

feenion_handler = instrument_langchain(trace_name="customer_onboarding_chain")

chain = prompt | model | parser
result = chain.invoke(
    {"user_name": "Alice"},
    config={"callbacks": [feenion_handler]}
)
```

---

## ⚙️ Manual LLM Metrics Capture

If using a custom or local LLM (e.g. Ollama, vLLM, llama.cpp):

```python
from feenion import span

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

## 🚀 Zero-Key Comprehensive Mock AI Ecosystem

To test Feenion locally without setting up API keys or paid accounts, run our self-contained mock ecosystem script mimicking Google Gemini, OpenAI, Claude, Azure OpenAI, Chroma vector retrieval, and Model Context Protocol (MCP) tools:

```bash
python examples/comprehensive_mock_ecosystem.py
```
