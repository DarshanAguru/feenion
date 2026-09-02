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

    def __init__(self, *exporters: Exporter | list[Exporter] | tuple[Exporter, ...]) -> None:
        flat_exporters: list[Exporter] = []
        for item in exporters:
            if isinstance(item, (list, tuple)):
                flat_exporters.extend(item)
            else:
                flat_exporters.append(item)
        self.exporters = flat_exporters

    def export(self, trace: Trace) -> None:
        for exp in self.exporters:
            try:
                exp.export(trace)
            except Exception as e:
                print(f"[feenion] Exporter {type(exp).__name__} failed: {e}")

    def export_batch(self, traces: list[Trace]) -> None:
        for exp in self.exporters:
            try:
                exp.export_batch(traces)
            except Exception as e:
                print(f"[feenion] Exporter {type(exp).__name__} failed: {e}")

    def flush(self) -> None:
        for exp in self.exporters:
            try:
                exp.flush()
            except Exception:
                pass

    def shutdown(self) -> None:
        for exp in self.exporters:
            try:
                exp.shutdown()
            except Exception:
                pass