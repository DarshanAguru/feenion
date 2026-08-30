from __future__ import annotations

import dataclasses
from datetime import datetime, date
from typing import Any
from uuid import UUID

class TelemetrySerializer:
    """
    Safely serializes arbitrary Python data structures into JSON-compatible primitives.
    Guarantees no serialization errors crash the host application.
    Enforces depth, string length, and collection size limits.
    """

    def __init__(
        self,
        max_depth: int = 10,
        max_string_length: int = 10_000,
        max_collection_size: int = 500,
    ) -> None:
        self.max_depth = max_depth
        self.max_string_length = max_string_length
        self.max_collection_size = max_collection_size

    def serialize(self, obj: Any, depth: int = 0) -> Any:
        if depth > self.max_depth:
            return "<max_depth_exceeded>"

        if obj is None or isinstance(obj, (bool, int, float)):
            return obj

        if isinstance(obj, str):
            if len(obj) > self.max_string_length:
                return obj[: self.max_string_length] + f"... [truncated {len(obj) - self.max_string_length} chars]"
            return obj

        if isinstance(obj, UUID):
            return str(obj)

        if isinstance(obj, (date, datetime)):
            return obj.isoformat()

        if isinstance(obj, BaseException):
            return {
                "error_type": type(obj).__name__,
                "message": str(obj),
            }

        if isinstance(obj, dict):
            res = {}
            items = list(obj.items())
            if len(items) > self.max_collection_size:
                items = items[: self.max_collection_size]
                res["_truncated"] = True
            for k, v in items:
                key_str = str(k) if not isinstance(k, str) else k
                res[key_str] = self.serialize(v, depth=depth + 1)
            return res

        if isinstance(obj, (list, tuple, set)):
            items = list(obj)
            is_truncated = False
            if len(items) > self.max_collection_size:
                items = items[: self.max_collection_size]
                is_truncated = True
            converted = [self.serialize(item, depth=depth + 1) for item in items]
            if is_truncated:
                converted.append(f"... [truncated {len(obj) - self.max_collection_size} items]")
            return converted

        # Check Pydantic model (v2 and v1 compatibility)
        if hasattr(obj, "model_dump") and callable(getattr(obj, "model_dump", None)):
            try:
                return self.serialize(obj.model_dump(), depth=depth + 1)
            except Exception:
                pass
        elif hasattr(obj, "dict") and callable(getattr(obj, "dict", None)):
            try:
                return self.serialize(obj.dict(), depth=depth + 1)
            except Exception:
                pass

        # Check dataclasses
        if dataclasses.is_dataclass(obj) and not isinstance(obj, type):
            try:
                fields = {f.name: getattr(obj, f.name) for f in dataclasses.fields(obj)}
                return self.serialize(fields, depth=depth + 1)
            except Exception:
                pass

        # Fallback to string representation
        try:
            val_str = str(obj)
            if len(val_str) > self.max_string_length:
                return val_str[: self.max_string_length] + "... [truncated]"
            return val_str
        except Exception:
            return f"<unserializable {type(obj).__name__}>"

default_serializer = TelemetrySerializer()

def safe_serialize(
    obj: Any,
    max_depth: int = 10,
    max_string_length: int = 10_000,
    max_collection_size: int = 500,
) -> Any:
    serializer = TelemetrySerializer(
        max_depth=max_depth,
        max_string_length=max_string_length,
        max_collection_size=max_collection_size,
    )
    try:
        return serializer.serialize(obj)
    except Exception as exc:
        return {"_error": f"Serialization failed: {exc}"}

