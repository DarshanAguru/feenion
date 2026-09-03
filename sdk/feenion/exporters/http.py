from __future__ import annotations

import gzip
import json
import random
import time
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from ..models import Trace
from .._version import __version__
from .base import Exporter

class HTTPExporter(Exporter):
    """
    HTTP Exporter for pushing trace telemetry batches to Feenion Server API.
    Supports Gzip compression, API key authentication, exponential backoff retries,
    and configurable HTTP timeouts.
    """

    def __init__(
        self,
        endpoint: str = "http://localhost:8000",
        api_key: str | None = None,
        workspace_id: str | None = None,
        project_id: str | None = None,
        timeout: float = 5.0,
        max_retries: int = 3,
        backoff_factor: float = 0.5,
        compress: bool = True,
    ):
        self.endpoint = endpoint.rstrip("/")
        self.api_key = api_key
        self.workspace_id = workspace_id or project_id
        self.timeout = timeout
        self.max_retries = max_retries
        self.backoff_factor = backoff_factor
        self.compress = compress

    def export(self, trace: Trace) -> None:
        self.export_batch([trace])

    def _send_payload(self, traces: list[Trace], api_key: str | None = None, workspace_id: str | None = None) -> None:
        payload_dict = {
            "schema_version": "1.0",
            "sdk_version": __version__,
            "traces": [trace.to_dict() for trace in traces],
        }

        raw_bytes = json.dumps(payload_dict, default=str).encode("utf-8")
        headers = {
            "Content-Type": "application/json",
            "User-Agent": f"Feenion-Python-SDK/{__version__}",
        }

        if api_key:
            headers["X-Feenion-Api-Key"] = api_key
            headers["Authorization"] = f"Bearer {api_key}"

        if workspace_id:
            headers["X-Workspace-Id"] = workspace_id
            headers["X-Project-Id"] = workspace_id

        if self.compress and len(raw_bytes) > 256:
            data = gzip.compress(raw_bytes)
            headers["Content-Encoding"] = "gzip"
        else:
            data = raw_bytes

        url = f"{self.endpoint}/api/v1/traces"

        for attempt in range(1 + self.max_retries):
            try:
                request = Request(url, data=data, headers=headers, method="POST")
                with urlopen(request, timeout=self.timeout) as response:
                    if response.status in (200, 201, 202):
                        return
                    if response.status < 500 and response.status != 429:
                        # Non-retryable client error
                        raise RuntimeError(f"Server returned status {response.status}")
            except (HTTPError, URLError, TimeoutError, RuntimeError) as e:
                if attempt == self.max_retries:
                    raise RuntimeError(f"Failed to export traces after {self.max_retries + 1} attempts: {e}") from e

                # Calculate exponential backoff with jitter
                sleep_time = self.backoff_factor * (2 ** attempt) + random.uniform(0, 0.1)
                time.sleep(sleep_time)

    def export_batch(self, traces: list[Trace]) -> None:
        if not traces:
            return

        # Group traces by effective credentials (api_key, workspace_id)
        grouped: dict[tuple[str | None, str | None], list[Trace]] = {}
        for tr in traces:
            tr_api_key = tr.metadata.get("api_key") if tr.metadata else None
            tr_workspace_id = tr.metadata.get("workspace_id") if tr.metadata else None

            effective_key = tr_api_key or self.api_key
            effective_ws = tr_workspace_id or self.workspace_id

            grouped.setdefault((effective_key, effective_ws), []).append(tr)

        for (eff_key, eff_ws), group_traces in grouped.items():
            self._send_payload(group_traces, api_key=eff_key, workspace_id=eff_ws)

    def shutdown(self) -> None:
        super().shutdown()

    def flush(self) -> None:
        super().flush()
