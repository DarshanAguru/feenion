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