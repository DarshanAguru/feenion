import pytest
from feenion.pricing import PricingRegistry, set_model_pricing, get_model_cost

def test_default_pricing_lookup():
    reg = PricingRegistry()
    cost_gpt4o = reg.calculate("gpt-4o", prompt_tokens=1000, completion_tokens=1000)
    # 1000 * 2.50/1M = 0.0025 + 1000 * 10.00/1M = 0.0100 = 0.0125
    assert cost_gpt4o == pytest.approx(0.0125, rel=1e-4)

def test_custom_developer_override():
    reg = PricingRegistry()
    reg.set_pricing("my-finetuned-llama", prompt_per_1m=0.50, completion_per_1m=1.50)
    cost = reg.calculate("my-finetuned-llama", prompt_tokens=2000, completion_tokens=1000)
    # 2000 * 0.5/1M = 0.001 + 1000 * 1.5/1M = 0.0015 = 0.0025
    assert cost == pytest.approx(0.0025, rel=1e-4)

def test_bulk_pricing_registration():
    reg = PricingRegistry()
    reg.register_many({
        "deepseek-coder": (0.20, 0.40),
        "mistral-finetune": {"input": 1.0, "output": 2.0},
    })
    c1 = reg.calculate("deepseek-coder", prompt_tokens=10000, completion_tokens=10000)
    assert c1 == pytest.approx(0.006, rel=1e-4)

def test_prefix_fuzzy_matching():
    reg = PricingRegistry()
    cost_dated = reg.calculate("gpt-4o-2024-11-20", prompt_tokens=1000, completion_tokens=1000)
    cost_base = reg.calculate("gpt-4o", prompt_tokens=1000, completion_tokens=1000)
    assert cost_dated == cost_base

def test_global_helper_functions():
    set_model_pricing("custom-enterprise-model", prompt_per_1k=0.002, completion_per_1k=0.006)
    cost = get_model_cost("custom-enterprise-model", 1000, 1000)
    assert cost == pytest.approx(0.008, rel=1e-4)

