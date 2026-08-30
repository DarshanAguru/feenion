from __future__ import annotations

import re
from typing import Any, Callable, Pattern, Set

DEFAULT_SENSITIVE_KEYS: Set[str] = {
    "password",
    "token",
    "authorization",
    "api_key",
    "apikey",
    "secret",
    "cookie",
    "credit_card",
    "creditcard",
    "access_token",
    "refresh_token",
    "private_key",
}

DEFAULT_SENSITIVE_REGEXES: list[Pattern[str]] = [
    re.compile(r"sk-[a-zA-Z0-9]{32,}", re.IGNORECASE),  # OpenAI API Keys
    re.compile(r"bearer\s+[a-zA-Z0-9\-\._~\+\/]+=*", re.IGNORECASE),  # Bearer tokens
    re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"),  # Email addresses (optional/configurable)
]

class Redactor:
    """
    Sanitizes telemetry data before export by redacting sensitive keys and regex patterns.
    """

    def __init__(
        self,
        sensitive_keys: Set[str] | None = None,
        sensitive_regexes: list[Pattern[str]] | None = None,
        redact_val: str = "[REDACTED]",
        enabled: bool = True,
    ):
        self.sensitive_keys = {k.lower() for k in (sensitive_keys or DEFAULT_SENSITIVE_KEYS)}
        self.sensitive_regexes = sensitive_regexes or DEFAULT_SENSITIVE_REGEXES
        self.redact_val = redact_val
        self.enabled = enabled

    def redact(self, obj: Any, depth: int = 0) -> Any:
        if not self.enabled or depth > 10 or obj is None:
            return obj

        if isinstance(obj, str):
            res = obj
            for pattern in self.sensitive_regexes:
                res = pattern.sub(self.redact_val, res)
            return res

        if isinstance(obj, dict):
            new_dict = {}
            for k, v in obj.items():
                key_str = str(k).lower()
                if any(sens_k in key_str for sens_k in self.sensitive_keys):
                    new_dict[k] = self.redact_val
                else:
                    new_dict[k] = self.redact(v, depth=depth + 1)
            return new_dict

        if isinstance(obj, (list, tuple)):
            return [self.redact(item, depth=depth + 1) for item in obj]

        return obj

default_redactor = Redactor()

def redact_data(data: Any, redactor: Redactor | None = None) -> Any:
    r = redactor or default_redactor
    return r.redact(data)

