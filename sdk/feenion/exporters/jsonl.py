from __future__ import annotations

import json

from ..models import Trace
from .base import Exporter

from pathlib import Path
from threading import Lock

class JSONLExporter(Exporter):

    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = Lock()

    def export(self, trace: Trace) -> None:

        payload = trace.to_dict()

        line = json.dumps(payload, default=str)

        with self._lock:
            with self.path.open("a", encoding="utf-8") as f:
                f.write(line)
                f.write("\n")
                f.flush()

    def shutdown(self):
        return super().shutdown()

    def flush(self):
        return super().flush()