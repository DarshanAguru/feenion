from uuid import uuid4
from types import SimpleNamespace
from feenion.models import Trace, utc_now
from feenion.redaction import Redactor
from feenion.sampling import AlwaysSampler, NeverSampler, ErrorPrioritySampler
from feenion.replay import TraceReplayEngine
from feenion.integrations.openai import instrument_openai, wrap_openai
from feenion.integrations.anthropic import instrument_anthropic, wrap_anthropic

def test_redaction():
    redactor = Redactor()
    data = {
        "user": "alice",
        "api_key": "sk-12345678901234567890123456789012",
        "password": "secret_password",
        "nested": {"token": "bearer_abc_123"},
    }
    redacted = redactor.redact(data)
    assert redacted["user"] == "alice"
    assert redacted["api_key"] == "[REDACTED]"
    assert redacted["password"] == "[REDACTED]"
    assert redacted["nested"]["token"] == "[REDACTED]"

def test_sampling():
    t_ok = Trace(trace_id=uuid4(), name="t_ok", start_time=utc_now(), status="ok")
    t_err = Trace(trace_id=uuid4(), name="t_err", start_time=utc_now(), status="error")

    assert AlwaysSampler().should_sample(t_ok) is True
    assert NeverSampler().should_sample(t_ok) is False

    err_sampler = ErrorPrioritySampler(success_sample_rate=0.0)
    assert err_sampler.should_sample(t_err) is True
    assert err_sampler.should_sample(t_ok) is False

def test_trace_replay():
    payload = {
        "trace_id": "t-100",
        "name": "ai_agent",
        "status": "ok",
        "duration_ms": 1500.0,
        "spans": [
            {
                "span_id": "s-1",
                "name": "vector_search",
                "span_type": "retrieval",
                "output": ["doc_1", "doc_2"],
            },
            {
                "span_id": "s-2",
                "name": "gpt-4o",
                "span_type": "llm",
                "output": {"text": "Replayed LLM Answer"},
            },
        ],
    }

    engine = TraceReplayEngine(payload)
    assert engine.get_mock_retrieval_docs("vector_search") == ["doc_1", "doc_2"]
    assert engine.get_mock_llm_response("gpt-4o") == {"text": "Replayed LLM Answer"}
    summary = engine.replay_summary()
    assert summary["total_spans"] == 2

from feenion.integrations.gemini import instrument_gemini, wrap_gemini

def test_openai_and_anthropic_wrappers():
    mock_openai = SimpleNamespace(
        chat=SimpleNamespace(completions=SimpleNamespace(create=lambda **kw: SimpleNamespace(choices=[], usage=None)))
    )
    wrapped = wrap_openai(mock_openai)
    assert wrapped is mock_openai

    mock_anthropic = SimpleNamespace(
        messages=SimpleNamespace(create=lambda **kw: SimpleNamespace(content=[], usage=None))
    )
    wrapped_claude = wrap_anthropic(mock_anthropic)
    assert wrapped_claude is mock_anthropic

    mock_genai_client = SimpleNamespace(
        models=SimpleNamespace(generate_content=lambda *args, **kw: SimpleNamespace(text="gemini response", usage_metadata=None))
    )
    wrapped_gemini = wrap_gemini(mock_genai_client)
    assert wrapped_gemini is mock_genai_client

    mock_legacy_model = SimpleNamespace(
        model_name="gemini-1.5-pro",
        generate_content=lambda *args, **kw: SimpleNamespace(text="legacy response", usage_metadata=None)
    )
    wrapped_legacy = wrap_gemini(mock_legacy_model)
    assert wrapped_legacy is mock_legacy_model
