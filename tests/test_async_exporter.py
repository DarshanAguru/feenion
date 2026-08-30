import time

from feenion.exporters import AsyncExporter
from feenion.models import Trace, utc_now 
from uuid import uuid4


class SlowExporter:

    def __init__(self):
        self.exported = []

    def export(self, trace):
        time.sleep(0.5)
        self.exported.append(
            trace
        )

    def shutdown(self):
        pass


def test_async_export_does_not_block():
    slow = SlowExporter()

    exporter = AsyncExporter(
        slow,
        max_queue_size=10,
    )

    trace = Trace(
        trace_id=uuid4(),
        name="test",
        start_time=utc_now(),
    )

    start = time.perf_counter()

    exporter.export(trace)

    elapsed = (
        time.perf_counter() - start
    )

    assert elapsed < 0.1

    exporter.shutdown()

    assert len(slow.exported) == 1