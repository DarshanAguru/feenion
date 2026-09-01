export interface ModelPricingEntry {
  model: string;
  provider: string;
  prompt_per_1m: number;
  completion_per_1m: number;
  is_custom?: boolean;
}

export const DEFAULT_MODEL_CATALOG: ModelPricingEntry[] = [
  { model: 'gpt-4o', provider: 'OpenAI', prompt_per_1m: 2.50, completion_per_1m: 10.00 },
  { model: 'gpt-4o-mini', provider: 'OpenAI', prompt_per_1m: 0.15, completion_per_1m: 0.60 },
  { model: 'o1', provider: 'OpenAI', prompt_per_1m: 15.00, completion_per_1m: 60.00 },
  { model: 'o3-mini', provider: 'OpenAI', prompt_per_1m: 1.10, completion_per_1m: 4.40 },
  { model: 'gemini-2.0-flash', provider: 'Google', prompt_per_1m: 0.10, completion_per_1m: 0.40 },
  { model: 'gemini-1.5-pro', provider: 'Google', prompt_per_1m: 3.50, completion_per_1m: 10.50 },
  { model: 'gemini-1.5-flash', provider: 'Google', prompt_per_1m: 0.075, completion_per_1m: 0.30 },
  { model: 'claude-3-5-sonnet', provider: 'Anthropic', prompt_per_1m: 3.00, completion_per_1m: 15.00 },
  { model: 'claude-3-5-haiku', provider: 'Anthropic', prompt_per_1m: 0.80, completion_per_1m: 4.00 },
  { model: 'deepseek-chat', provider: 'DeepSeek', prompt_per_1m: 0.14, completion_per_1m: 0.28 },
  { model: 'deepseek-reasoner', provider: 'DeepSeek', prompt_per_1m: 0.55, completion_per_1m: 2.19 },
  { model: 'llama-3.3-70b', provider: 'Meta / Local', prompt_per_1m: 0.70, completion_per_1m: 0.90 },
  { model: 'mistral-large', provider: 'Mistral', prompt_per_1m: 2.00, completion_per_1m: 6.00 },
];

export function getCustomPricing(): ModelPricingEntry[] {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem('feenion_custom_pricing');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    }
  } catch (e) {}
  return [...DEFAULT_MODEL_CATALOG];
}

export function saveCustomPricing(catalog: ModelPricingEntry[]): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem('feenion_custom_pricing', JSON.stringify(catalog));
    window.dispatchEvent(new Event('feenion_pricing_changed'));
  }
}

export function resetPricingToDefaults(): ModelPricingEntry[] {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.removeItem('feenion_custom_pricing');
    window.dispatchEvent(new Event('feenion_pricing_changed'));
  }
  return [...DEFAULT_MODEL_CATALOG];
}

export function calculateEstimatedCost(
  modelName: string,
  promptTokens: number,
  completionTokens: number,
  catalog: ModelPricingEntry[] = getCustomPricing()
): number {
  const m = modelName.toLowerCase().trim();
  const entry = catalog.find(e => e.model.toLowerCase() === m) ||
                catalog.find(e => m.includes(e.model.toLowerCase()) || e.model.toLowerCase().includes(m)) ||
                { prompt_per_1m: 2.50, completion_per_1m: 10.00 };

  const promptCost = (promptTokens / 1_000_000.0) * entry.prompt_per_1m;
  const completionCost = (completionTokens / 1_000_000.0) * entry.completion_per_1m;
  return promptCost + completionCost;
}
