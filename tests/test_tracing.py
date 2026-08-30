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