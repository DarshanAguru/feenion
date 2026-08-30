from __future__ import annotations

import random
from abc import ABC, abstractmethod
from typing import Any
from .models import Trace

class Sampler(ABC):
    @abstractmethod
    def should_sample(self, trace: Trace) -> bool:
        pass

class AlwaysSampler(Sampler):
    def should_sample(self, trace: Trace) -> bool:
        return True

class NeverSampler(Sampler):
    def should_sample(self, trace: Trace) -> bool:
        return False

class ProbabilisticSampler(Sampler):
    def __init__(self, sample_rate: float = 0.1):
        self.sample_rate = max(0.0, min(1.0, sample_rate))

    def should_sample(self, trace: Trace) -> bool:
        return random.random() < self.sample_rate

class ErrorPrioritySampler(Sampler):
    """
    Guarantees 100% sampling for failed traces, while sampling successful traces
    at configured probabilistic rate.
    """

    def __init__(self, success_sample_rate: float = 0.1):
        self.success_sample_rate = max(0.0, min(1.0, success_sample_rate))

    def should_sample(self, trace: Trace) -> bool:
        if trace.status == "error" or any(s.status == "error" for s in trace.spans):
            return True
        return random.random() < self.success_sample_rate

