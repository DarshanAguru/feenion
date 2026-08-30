from __future__ import annotations

import json
import urllib.request
from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple

@dataclass
class ModelCost:
    prompt_per_1m: float
    completion_per_1m: float

    @property
    def prompt_rate(self) -> float:
        """Cost per single prompt token."""
        return self.prompt_per_1m / 1_000_000.0

    @property
    def completion_rate(self) -> float:
        """Cost per single completion token."""
        return self.completion_per_1m / 1_000_000.0

    def calculate_cost(self, prompt_tokens: int, completion_tokens: int) -> float:
        return (prompt_tokens * self.prompt_rate) + (completion_tokens * self.completion_rate)

class PricingRegistry:
    """
    Central, developer-tunable pricing registry for LLM token and API cost calculations.
    Supports dynamic overrides, prefix matching, custom models, and live pricing fetch.
    """

    DEFAULT_PRICING: Dict[str, Tuple[float, float]] = {
        # OpenAI Models (Price per 1M tokens: input, output)
        "gpt-4o": (2.50, 10.00),
        "gpt-4o-2024-08-06": (2.50, 10.00),
        "gpt-4o-2024-11-20": (2.50, 10.00),
        "gpt-4o-mini": (0.15, 0.60),
        "gpt-4-turbo": (10.00, 30.00),
        "gpt-4": (30.00, 60.00),
        "gpt-3.5-turbo": (0.50, 1.50),
        "o1": (15.00, 60.00),
        "o1-preview": (15.00, 60.00),
        "o1-mini": (3.00, 12.00),
        "o3-mini": (1.10, 4.40),

        # Anthropic Claude Models
        "claude-3-5-sonnet": (3.00, 15.00),
        "claude-3-5-sonnet-20241022": (3.00, 15.00),
        "claude-3-5-haiku": (0.80, 4.00),
        "claude-3-opus": (15.00, 75.00),
        "claude-3-haiku": (0.25, 1.25),

        # Google Gemini Models
        "gemini-1.5-pro": (3.50, 10.50),
        "gemini-1.5-flash": (0.075, 0.30),
        "gemini-2.0-flash": (0.10, 0.40),
        "gemini-2.0-pro": (2.50, 10.00),

        # Mistral Models
        "mistral-large": (2.00, 6.00),
        "mistral-small": (0.20, 0.60),
        "codestral": (0.30, 0.90),

        # DeepSeek & Open Source Models
        "deepseek-chat": (0.14, 0.28),
        "deepseek-reasoner": (0.55, 2.19),
        "llama-3.3-70b": (0.70, 0.90),
        "llama-3.1-405b": (3.00, 3.00),
    }

    def __init__(self) -> None:
        self._pricing: Dict[str, ModelCost] = {
            model: ModelCost(prompt_per_1m=p[0], completion_per_1m=p[1])
            for model, p in self.DEFAULT_PRICING.items()
        }

    def set_pricing(
        self,
        model: str,
        prompt_per_1m: Optional[float] = None,
        completion_per_1m: Optional[float] = None,
        *,
        prompt_per_1k: Optional[float] = None,
        completion_per_1k: Optional[float] = None,
    ) -> None:
        """
        Dynamically set or override pricing for a specific model.
        Accepts pricing per 1 Million tokens or per 1 Thousand tokens.
        """
        p_1m = prompt_per_1m if prompt_per_1m is not None else (prompt_per_1k * 1000.0 if prompt_per_1k else 0.0)
        c_1m = completion_per_1m if completion_per_1m is not None else (completion_per_1k * 1000.0 if completion_per_1k else 0.0)
        self._pricing[model.lower()] = ModelCost(prompt_per_1m=p_1m, completion_per_1m=c_1m)

    def register_many(self, pricing_dict: Dict[str, Tuple[float, float] | Dict[str, float]]) -> None:
        """
        Bulk register or update model pricing from a dictionary or JSON config.
        """
        for model, val in pricing_dict.items():
            if isinstance(val, (tuple, list)) and len(val) >= 2:
                self.set_pricing(model, prompt_per_1m=float(val[0]), completion_per_1m=float(val[1]))
            elif isinstance(val, dict):
                p = val.get("prompt_per_1m") or val.get("input") or (val.get("prompt_per_1k", 0) * 1000)
                c = val.get("completion_per_1m") or val.get("output") or (val.get("completion_per_1k", 0) * 1000)
                self.set_pricing(model, prompt_per_1m=float(p), completion_per_1m=float(c))

    def get_pricing(self, model: str) -> ModelCost:
        """
        Lookup model pricing with exact match and prefix/family fallback.
        """
        m = model.lower().strip()
        if m in self._pricing:
            return self._pricing[m]

        # Fuzzy / prefix matching (e.g. gpt-4o-2024-05-13 -> gpt-4o)
        for key, cost in self._pricing.items():
            if m.startswith(key) or key.startswith(m):
                return cost

        # Default fallback rate ($2.50 / $10.00 per 1M tokens)
        return ModelCost(prompt_per_1m=2.50, completion_per_1m=10.00)

    def calculate(self, model: str, prompt_tokens: int, completion_tokens: int) -> float:
        """
        Calculate the total estimated dollar cost for a given model and token usage.
        """
        cost_obj = self.get_pricing(model)
        return cost_obj.calculate_cost(prompt_tokens, completion_tokens)

    def fetch_live_pricing(self, source_url: Optional[str] = None) -> bool:
        """
        Fetch latest model pricing catalog from a public/enterprise HTTP endpoint
        (e.g., LiteLLM open price index or custom provider endpoint).
        """
        url = source_url or "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Feenion-Observability/1.0"})
            with urllib.request.urlopen(req, timeout=3.0) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode("utf-8"))
                    for model_name, info in data.items():
                        if isinstance(info, dict) and "input_cost_per_token" in info and "output_cost_per_token" in info:
                            in_rate = info.get("input_cost_per_token", 0.0) * 1_000_000.0
                            out_rate = info.get("output_cost_per_token", 0.0) * 1_000_000.0
                            self.set_pricing(model_name, prompt_per_1m=in_rate, completion_per_1m=out_rate)
                    return True
        except Exception:
            # Graceful fallback to built-in pricing table
            pass
        return False

# Global default pricing registry
pricing_registry = PricingRegistry()

def set_model_pricing(
    model: str,
    prompt_per_1m: Optional[float] = None,
    completion_per_1m: Optional[float] = None,
    *,
    prompt_per_1k: Optional[float] = None,
    completion_per_1k: Optional[float] = None,
) -> None:
    pricing_registry.set_pricing(
        model,
        prompt_per_1m=prompt_per_1m,
        completion_per_1m=completion_per_1m,
        prompt_per_1k=prompt_per_1k,
        completion_per_1k=completion_per_1k,
    )

def get_model_cost(model: str, prompt_tokens: int, completion_tokens: int) -> float:
    return pricing_registry.calculate(model, prompt_tokens, completion_tokens)

