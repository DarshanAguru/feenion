import asyncio
import pytest
from feenion.tracer import Tracer
from feenion.exporters.base import Exporter
from feenion.models import Trace

class MemoryExporter(Exporter):
    def __init__(self):
        self.traces: list[Trace] = []

    def export(self, trace: Trace) -> None:
        self.traces.append(trace)

@pytest.mark.anyio
async def test_async_tracing():
    exporter = MemoryExporter()
    tracer = Tracer(exporter=exporter)

    @tracer.trace
    async def sub_task(x: int):
        async with tracer.span("inner_step", span_type="tool") as sp:
            await asyncio.sleep(0.01)
            sp.output = x * 2
            return x * 2

    @tracer.trace
    async def main_task():
        res1, res2 = await asyncio.gather(
            sub_task(5),
            sub_task(10),
        )
        return res1 + res2

    result = await main_task()
    assert result == 30

    assert len(exporter.traces) == 1
    trace = exporter.traces[0]
    assert trace.name == "main_task"
    assert len(trace.spans) == 5  # root_span + 2 * (sub_task + inner_step)

