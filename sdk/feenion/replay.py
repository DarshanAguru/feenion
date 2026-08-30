from __future__ import annotations

from typing import Any, Callable, Dict
from .models import Trace, Span

class TraceReplayEngine:
    """
    Reconstructs execution environment from stored trace data,
    mocking LLM calls, vector retrieval, and tool side-effects safely for offline debugging.
    """

    def __init__(self, trace_payload: dict[str, Any]):
        self.trace_payload = trace_payload
        self.spans_by_id: Dict[str, dict[str, Any]] = {
            s["span_id"]: s for s in trace_payload.get("spans", [])
        }
        self.spans_by_name: Dict[str, list[dict[str, Any]]] = {}
        for s in trace_payload.get("spans", []):
            self.spans_by_name.setdefault(s["name"], []).append(s)

    def get_mock_llm_response(self, span_name_or_id: str) -> Any:
        span_data = self._find_span(span_name_or_id)
        if not span_data:
            raise KeyError(f"Span '{span_name_or_id}' not found in recorded trace.")
        return span_data.get("output")

    def get_mock_retrieval_docs(self, span_name_or_id: str) -> Any:
        span_data = self._find_span(span_name_or_id)
        if not span_data:
            raise KeyError(f"Span '{span_name_or_id}' not found in recorded trace.")
        return span_data.get("output")

    def _find_span(self, key: str) -> dict[str, Any] | None:
        if key in self.spans_by_id:
            return self.spans_by_id[key]
        if key in self.spans_by_name and self.spans_by_name[key]:
            return self.spans_by_name[key][0]
        return None

    def replay_summary(self) -> dict[str, Any]:
        return {
            "trace_id": self.trace_payload.get("trace_id"),
            "name": self.trace_payload.get("name"),
            "total_spans": len(self.spans_by_id),
            "status": self.trace_payload.get("status"),
            "recorded_duration_ms": self.trace_payload.get("duration_ms"),
        }

