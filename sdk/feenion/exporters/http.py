from __future__ import annotations

import gzip
import json
import random
import time
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from ..models import Trace
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
        timeout: float = 5.0,
        max_retries: int = 3,
        backoff_factor: float = 0.5,
        compress: bool = True,
    ):
        self.endpoint = endpoint.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        self.max_retries = max_retries
        self.backoff_factor = backoff_factor
        self.compress = compress

    def export(self, trace: Trace) -> None:
        self.export_batch([trace])

    def export_batch(self, traces: list[Trace]) -> None:
        if not traces:
            return

        payload_dict = {
            "schema_version": "1.0",
            "sdk_version": "0.1.0",
            "traces": [trace.to_dict() for trace in traces],
        }

        raw_bytes = json.dumps(payload_dict, default=str).encode("utf-8")
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "Feenion-Python-SDK/0.1.0",
        }

        if self.api_key:
            headers["X-Feenion-Api-Key"] = self.api_key
            headers["Authorization"] = f"Bearer {self.api_key}"

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

    def shutdown(self) -> None:
        super().shutdown()

    def flush(self) -> None:
        super().flush()
