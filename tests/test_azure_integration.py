import pytest
from dataclasses import dataclass, field
from typing import List, Any
import feenion
from feenion import Tracer, wrap_azure_openai, instrument_azure_openai, wrap_azure_ai
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

# Mock for LangChain AzureChatOpenAI
@dataclass
class MockLangChainAIMessage:
    content: str = '{"results": ["policy_violation_flagged"]}'
    usage_metadata: dict = field(default_factory=lambda: {"input_tokens": 145, "output_tokens": 55, "total_tokens": 200})
    response_metadata: dict = field(default_factory=lambda: {"model_name": "gpt-4o", "finish_reason": "stop"})

class MockLangChainAzureChatOpenAI:
    def __init__(self, should_fail=False):
        self.azure_deployment = "gpt-4o"
        self.azure_endpoint = "https://bfsi-compliance.openai.azure.com/"
        self.should_fail = should_fail

    def invoke(self, input_data, **kwargs):
        if self.should_fail:
            raise RuntimeError("Azure Resource 'bfsi-compliance' not found (404 NotFound)")
        return MockLangChainAIMessage()

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

def test_azure_langchain_chat_model_instrumentation():
    test_tracer = Tracer()
    exporter = ListExporter()
    test_tracer.exporter = exporter

    # LangChain AzureChatOpenAI instance
    lc_client = MockLangChainAzureChatOpenAI(should_fail=False)
    wrapped_lc = wrap_azure_openai(lc_client, tracer=test_tracer)

    @test_tracer.trace(name="bfsi_compliance_service", span_type="agent")
    def run_compliance():
        feenion.set_user("analyst_404")
        feenion.set_tag("jurisdiction", "EU_GDPR")
        feenion.add_event("rule_engine_loaded", {"rules": 14})

        messages = [
            ("system", "You are a BFSI compliance monitoring system."),
            ("user", "Analyze internal transfer #8812")
        ]
        return wrapped_lc.invoke(messages, response_format={"type": "json_object"})

    res = run_compliance()
    assert "policy_violation_flagged" in res.content
    assert len(exporter.traces) == 1

    trace_dict = exporter.traces[0]
    assert trace_dict["name"] == "bfsi_compliance_service"
    
    # Check root span
    root = next(s for s in trace_dict["spans"] if s["parent_span_id"] is None)
    assert root["attributes"]["user_id"] == "analyst_404"
    assert root["attributes"]["tags"]["jurisdiction"] == "EU_GDPR"
    assert len(root["events"]) >= 1
    assert root["events"][0]["event_type"] == "rule_engine_loaded"

    # Check child LLM span
    llm_span = next(s for s in trace_dict["spans"] if s["span_type"] == "llm")
    assert llm_span["name"] == "azure.openai.gpt-4o"
    assert llm_span["metrics"]["tokens"]["prompt"] == 145
    assert llm_span["metrics"]["tokens"]["completion"] == 55
    assert llm_span["metrics"]["tokens"]["total"] == 200
    assert llm_span["metrics"]["cost"] > 0

def test_azure_langchain_chat_model_error_capture():
    test_tracer = Tracer()
    exporter = ListExporter()
    test_tracer.exporter = exporter

    lc_client = MockLangChainAzureChatOpenAI(should_fail=True)
    wrapped_lc = wrap_azure_openai(lc_client, tracer=test_tracer)

    @test_tracer.trace(name="failing_compliance_call")
    def run_failing_call():
        return wrapped_lc.invoke([("user", "Hello")])

    with pytest.raises(RuntimeError) as exc_info:
        run_failing_call()

    assert "404 NotFound" in str(exc_info.value)
    assert len(exporter.traces) == 1

    trace_dict = exporter.traces[0]
    assert trace_dict["status"] == "error"
    
    llm_span = next(s for s in trace_dict["spans"] if s["span_type"] == "llm")
    assert llm_span["status"] == "error"
    assert "404 NotFound" in llm_span["error"]["message"]

def test_standalone_wrap_azure_without_trace_decorator():
    test_tracer = Tracer()
    exporter = ListExporter()
    test_tracer.exporter = exporter

    lc_client = MockLangChainAzureChatOpenAI(should_fail=False)
    wrapped_lc = wrap_azure_openai(lc_client, tracer=test_tracer)

    # Standalone invocation without enclosing @trace
    res = wrapped_lc.invoke("Standalone prompt")
    assert res is not None
    assert len(exporter.traces) == 1
    assert exporter.traces[0]["spans"][0]["span_type"] == "llm"

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

def test_pydantic_azure_chat_openai_with_wrappers():
    """Verifies that LangChain's Pydantic-based AzureChatOpenAI works with wrap_azure_openai & wrap_azure_ai."""
    from pydantic import BaseModel

    class MockPydanticAzureChat(BaseModel):
        azure_deployment: str = "gpt-4o-deployment"
        azure_endpoint: str = "https://compliance.openai.azure.com/"

        def invoke(self, messages, **kwargs):
            return MockLangChainAIMessage(content='{"compliance": "pass"}')

    test_tracer = Tracer()
    exporter = ListExporter()
    test_tracer.exporter = exporter

    # 1. wrap_azure_openai with Pydantic model
    client1 = MockPydanticAzureChat()
    wrapped1 = wrap_azure_openai(client1, tracer=test_tracer)
    res1 = wrapped1.invoke([("system", "Analyze"), ("user", "Check tx #101")])
    assert '{"compliance": "pass"}' in res1.content
    assert len(exporter.traces) == 1
    assert exporter.traces[0]["spans"][0]["span_type"] == "llm"
    assert exporter.traces[0]["spans"][0]["name"] == "azure.openai.gpt-4o-deployment"

    # 2. wrap_azure_ai with Pydantic model
    exporter.traces.clear()
    client2 = MockPydanticAzureChat()
    wrapped2 = wrap_azure_ai(client2, tracer=test_tracer)
    res2 = wrapped2.invoke([("user", "Hello Azure AI")])
    assert '{"compliance": "pass"}' in res2.content
    assert len(exporter.traces) == 1
    assert exporter.traces[0]["spans"][0]["span_type"] == "llm"

def test_raw_azure_client_invoke_adapter():
    """Verifies that raw AzureOpenAI clients gain .invoke() compatibility when wrapped."""
    test_tracer = Tracer()
    exporter = ListExporter()
    test_tracer.exporter = exporter

    raw_client = MockAzureOpenAIClient()
    wrapped = wrap_azure_openai(raw_client, tracer=test_tracer)

    assert hasattr(wrapped, "invoke")
    messages = [
        ("system", "You are compliance monitor"),
        ("user", "Analyze payload")
    ]
    resp = wrapped.invoke(messages, response_format={"type": "json_object"})
    assert hasattr(resp, "content")
    assert resp.content == "Azure OpenAI verified response."
    assert len(exporter.traces) == 1
    assert exporter.traces[0]["spans"][0]["span_type"] == "llm"

