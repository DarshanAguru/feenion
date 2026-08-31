from __future__ import annotations

from abc import ABC, abstractmethod

from ..models import Trace

class Exporter(ABC):

    @abstractmethod
    def export(self, trace: Trace) -> None:
        """
        Exports the trace
        """
        raise NotImplementedError

    def export_batch(self, traces: list[Trace]) -> None:
        for trace in traces:
            self.export(trace)

    def flush(self) -> None:
        """
        Wait for pending exports to complete.
        """
        pass

    def shutdown(self) -> None:
        """
        Release exporter resources.
        """
        self.flush()


class CompositeExporter(Exporter):
    """
    Exports traces to multiple child exporters simultaneously (e.g. Console + HTTP Server).
    """

    def __init__(self, *exporters: Exporter) -> None:
        self.exporters = list(exporters)

    def export(self, trace: Trace) -> None:
        for exp in self.exporters:
            try:
                exp.export(trace)
            except Exception:
                pass

    def export_batch(self, traces: list[Trace]) -> None:
        for exp in self.exporters:
            try:
                exp.export_batch(traces)
            except Exception:
                pass

    def flush(self) -> None:
        for exp in self.exporters:
            exp.flush()

    def shutdown(self) -> None:
        for exp in self.exporters:
            exp.shutdown()