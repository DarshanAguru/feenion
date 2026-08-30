from __future__ import annotations

import json

from ..models import Trace

from .base import Exporter

class ConsoleExporter(Exporter):

    def export(self, trace: Trace)-> None:

        payload = trace.to_dict()

        print(
            json.dumps(payload, indent = 2, default=str)
        )

    def flush(self):
        return super().flush()

    def shutdown(self):
        return super().shutdown()