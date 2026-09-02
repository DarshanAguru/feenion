from feenion.tracer import Tracer
from pathlib import Path

from feenion.exporters import JSONLExporter
from feenion.tracer import Tracer

def test_tracer_creation():
    tracer = Tracer()

    with tracer.trace_context("test") as t:
        assert t.name == "test"
        assert t.status == "running"

    assert t.status == "ok"
    assert t.end_time is not None

def test_nested_spans():

    tracer = Tracer()

    with tracer.trace_context("test") as trace:

        with tracer.span_context("parent"):

            with tracer.span_context("child"):
                pass

    spans = trace.spans

    assert len(spans) == 3

    root = spans[0]
    parent = spans[1]
    child = spans[2]

    assert root.parent_span_id is None

    assert parent.parent_span_id == root.span_id

    assert child.parent_span_id == parent.span_id

def test_span_error():

    tracer = Tracer()

    try:

        with tracer.trace_context("test"):

            with tracer.span_context("failing"):

                raise ValueError("boom")

    except ValueError:
        pass

    trace = next(
        iter(tracer.traces.values())
    )

    assert trace.status == "error"

    failing_span = trace.spans[1]

    assert failing_span.status == "error"

def test_jsonl_exporter(tmp_path: Path):

    output_file = tmp_path / "traces.jsonl"

    exporter = JSONLExporter(
        output_file
    )

    tracer = Tracer(
        exporter=exporter
    )

    with tracer.trace_context("test"):
        pass

    assert output_file.exists()

    lines = output_file.read_text().splitlines()

    assert len(lines) == 1

def test_customization_helpers():
    import feenion
    tracer = Tracer()
    
    with tracer.trace_context("custom_trace", tags={"env": "prod"}, user_id="u-123"):
        sp = feenion.current_span()
        assert sp is not None
        
        feenion.set_tag("tier", "enterprise")
        feenion.set_attribute("threshold", 0.95)
        feenion.add_event("cache_hit", {"key": "rule_1"})
        
        with tracer.span_context("sub_task") as child:
            child_sp = feenion.current_span()
            assert child_sp.span_id == child.span_id
            feenion.set_user("u-456")
            feenion.log("step_finished", {"status": "ok"})
            
    trace = next(iter(tracer.traces.values()))
    assert trace.metadata["user_id"] == "u-123"
    assert len(trace.spans) == 2
    root = trace.spans[0]
    assert root.attributes["tags"]["tier"] == "enterprise"
    assert root.attributes["threshold"] == 0.95
    assert len(root.events) == 1
    
    child_span = trace.spans[1]
    assert child_span.attributes["user_id"] == "u-456"
    assert len(child_span.events) == 1

def test_workspace_routing_helpers():
    import feenion
    from feenion import trace

    @trace(name="compliance_agent", workspace_id="ws_12345", api_key="fn_secret_key")
    def run_compliance():
        feenion.set_workspace_id("ws_12345")
        feenion.set_api_key("fn_secret_key")
        feenion.set_tag("jurisdiction", "EU_GDPR")
        return "completed"

    result = run_compliance()
    assert result == "completed"