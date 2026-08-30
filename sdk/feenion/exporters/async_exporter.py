from __future__ import annotations

import queue
import threading
import time
from typing import Any

from ..models import Trace
from .base import Exporter

class AsyncExporter(Exporter):
    """
    Asynchronous, non-blocking telemetry exporter wrapper using a bounded queue
    and background worker thread with batching and failure isolation.
    """

    def __init__(
        self,
        exporter: Exporter,
        max_queue_size: int = 1000,
        batch_size: int = 20,
        flush_interval: float = 1.0,
    ):
        self.exporter = exporter
        self.max_queue_size = max_queue_size
        self.queue: queue.Queue[Trace | None] = queue.Queue(maxsize=max_queue_size)
        self.batch_size = batch_size
        self.flush_interval = flush_interval
        self._shutdown = threading.Event()

        # Telemetry counters
        self.dropped_traces_count = 0
        self.exported_traces_count = 0

        self._worker = threading.Thread(
            target=self._run,
            name="feenion-exporter",
            daemon=True,
        )
        self._worker.start()

    def export(self, trace: Trace) -> None:
        try:
            self.queue.put_nowait(trace)
        except queue.Full:
            self.dropped_traces_count += 1

    def _run(self) -> None:
        while not self._shutdown.is_set() or not self.queue.empty():
            try:
                first = self.queue.get(timeout=self.flush_interval)
            except queue.Empty:
                continue

            if first is None:
                self.queue.task_done()
                break

            batch: list[Trace] = [first]

            while len(batch) < self.batch_size:
                try:
                    item = self.queue.get_nowait()
                    if item is None:
                        # Put poison pill back so outer loop terminates cleanly
                        self.queue.task_done()
                        break
                    batch.append(item)
                except queue.Empty:
                    break

            self._export_batch(batch)

    def _export_batch(self, traces: list[Trace]) -> None:
        if not traces:
            return

        try:
            if hasattr(self.exporter, "export_batch"):
                self.exporter.export_batch(traces)
            else:
                for trace in traces:
                    self.exporter.export(trace)
            self.exported_traces_count += len(traces)
        except Exception as exc:
            self.dropped_traces_count += len(traces)
            print(f"[feenion] export failed: {exc}")
        finally:
            for _ in traces:
                self.queue.task_done()

    def flush(self) -> None:
        self.queue.join()
        if hasattr(self.exporter, "flush"):
            try:
                self.exporter.flush()
            except Exception:
                pass

    def shutdown(self) -> None:
        self.flush()
        self._shutdown.set()

        try:
            self.queue.put_nowait(None)
        except queue.Full:
            pass

        if self._worker.is_alive():
            self._worker.join(timeout=5.0)

        if hasattr(self.exporter, "shutdown"):
            try:
                self.exporter.shutdown()
            except Exception:
                pass
