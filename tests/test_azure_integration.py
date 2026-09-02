import pytest
from dataclasses import dataclass, field
from typing import List, Any
from feenion import Tracer
from feenion.integrations import wrap_azure_openai, instrument_azure_openai, wrap_azure_ai
from feenion.exporters.base import Exporter

@dataclass
class MockUsage:
    prompt_tokens: int = 120
    completion_tokens: int = 40
    total_tokens: int = 160

@dataclass
class MockMessage:
    role: str = "assistant"
    content: str = "Azure OpenAI verified response."

@dataclass
class MockChoice:
    message: MockMessage = field(default_factory=MockMessage)
    finish_reason: str = "stop"

@dataclass
class MockResponse:
    choices: List[MockChoice] = field(default_factory=lambda: [MockChoice()])
    usage: MockUsage = field(default_factory=MockUsage)

class MockCompletions:
    def create(self, model="gpt-4o", messages=None, **kwargs):
        return MockResponse()

class MockAzureOpenAIClient:
    def __init__(self, endpoint="https://my-azure-resource.openai.azure.com/"):
        self.deployment_name = "gpt-4o-deployment"
        self.chat = type("Chat", (), {"completions": MockCompletions()})()
        self._client = type("Client", (), {"base_url": endpoint})()

class MockAzureAIModelClient:
    def complete(self, messages=None, model="azure-llama-3", **kwargs):
        return MockResponse()

class ListExporter(Exporter):
    def __init__(self):
        self.traces = []
    def export(self, trace):
        self.traces.append(trace.to_dict())
    def export_batch(self, traces):
        for t in traces:
            self.traces.append(t.to_dict())

def test_azure_openai_sync_instrumentation():
    test_tracer = Tracer()
    exporter = ListExporter()
    test_tracer.exporter = exporter

    raw_client = MockAzureOpenAIClient()
    instrumented_client = wrap_azure_openai(raw_client, tracer=test_tracer)

    @test_tracer.trace("azure_agent")
    def execute():
        return instrumented_client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": "Hello Azure"}]
        )

    resp = execute()
    assert resp.choices[0].message.content == "Azure OpenAI verified response."
    assert len(exporter.traces) == 1

    exported_trace = exporter.traces[0]
    llm_span = next((s for s in exported_trace["spans"] if s["span_type"] == "llm"), None)
    assert llm_span is not None
    assert llm_span["name"] == "azure.openai.gpt-4o"
    assert llm_span["attributes"]["provider"] == "azure_openai"
    assert llm_span["attributes"]["azure_endpoint"] == "https://my-azure-resource.openai.azure.com/"
    assert llm_span["metrics"]["tokens"]["total"] == 160
    assert llm_span["metrics"]["cost"] > 0

def test_azure_ai_inference_instrumentation():
    test_tracer = Tracer()
    exporter = ListExporter()
    test_tracer.exporter = exporter

    raw_client = MockAzureAIModelClient()
    instrumented_client = wrap_azure_ai(raw_client, tracer=test_tracer)

    @test_tracer.trace("azure_ai_agent")
    def execute_ai():
        return instrumented_client.complete(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": "Hello Azure AI"}]
        )

    resp = execute_ai()
    assert len(exporter.traces) == 1
    exported_trace = exporter.traces[0]
    llm_span = next((s for s in exported_trace["spans"] if s["span_type"] == "llm"), None)
    assert llm_span is not None
    assert llm_span["name"] == "azure.ai.gpt-4o-mini"
    assert llm_span["attributes"]["provider"] == "azure_ai_inference"
    assert llm_span["metrics"]["tokens"]["prompt"] == 120
    assert llm_span["metrics"]["cost"] > 0
