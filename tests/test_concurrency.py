import asyncio
import threading
import time
import pytest
from feenion.tracer import Tracer
from feenion.exporters.base import Exporter
from feenion.models import Trace

class MultiExporter(Exporter):
    def __init__(self):
        self.traces: list[Trace] = []
        self._lock = threading.Lock()

    def export(self, trace: Trace) -> None:
        with self._lock:
            self.traces.append(trace)

def test_threaded_concurrency():
    exporter = MultiExporter()
    tracer = Tracer(exporter=exporter)

    def worker_fn(worker_id: int):
        with tracer.trace_context(f"thread_worker_{worker_id}"):
            with tracer.span("step_1"):
                time.sleep(0.01)
            with tracer.span("step_2"):
                time.sleep(0.01)

    threads = [threading.Thread(target=worker_fn, args=(i,)) for i in range(10)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert len(exporter.traces) == 10
    names = {t.name for t in exporter.traces}
    assert len(names) == 10

@pytest.mark.anyio
async def test_async_task_concurrency():
    exporter = MultiExporter()
    tracer = Tracer(exporter=exporter)

    @tracer.trace
    async def async_worker(task_id: int):
        async with tracer.span(f"sub_span_{task_id}"):
            await asyncio.sleep(0.01)

    await asyncio.gather(*(async_worker(i) for i in range(15)))

    assert len(exporter.traces) == 15

