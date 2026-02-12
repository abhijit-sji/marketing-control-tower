/**
 * Cost Calculator for AI Agent Runs
 * Calculates USD cost based on provider, model, and token counts
 *
 * Pricing per 1M tokens: [input_cost, output_cost]
 */

type ProviderName = 'openai' | 'gemini' | 'claude' | 'perplexity' | 'grok';

interface PricingTier {
  [model: string]: [number, number]; // [inputCost, outputCost] per 1M tokens
}

interface ProviderPricing {
  [provider: string]: PricingTier;
}

const PROVIDER_PRICING: ProviderPricing = {
  openai: {
    'gpt-4o': [2.50, 10.00],
    'gpt-4o-mini': [0.15, 0.60],
    'gpt-4-turbo': [10.00, 30.00],
    'gpt-4': [30.00, 60.00],
    'gpt-3.5-turbo': [0.50, 1.50],
    // GPT-5 models (ESTIMATED - adjust as pricing becomes available)
    'gpt-5': [10.00, 30.00],
    'gpt-5-mini': [2.50, 10.00],
    'gpt-5-mini-2025-08-07': [2.50, 10.00],
    // Other OpenAI models (ESTIMATED)
    'gpt-4.1': [2.00, 8.00],
    'o3': [15.00, 60.00],
    'o4-mini': [1.00, 4.00],
  },
  claude: {
    'claude-3-5-sonnet': [3.00, 15.00],
    'claude-3-5-haiku': [0.80, 4.00],
    'claude-3-7-sonnet': [3.00, 15.00],
    'claude-sonnet-4-5': [3.00, 15.00],
  },
  gemini: {
    'gemini-2.5-flash': [0.10, 0.40],
    'gemini-2.5-flash-lite': [0.05, 0.20], // ESTIMATED
    'gemini-2.5-pro': [1.25, 5.00],
  },
  grok: {
    'grok-3': [3.00, 15.00], // ESTIMATED
    'grok-3-mini': [0.50, 2.50], // ESTIMATED
    'grok-2-latest': [2.00, 10.00], // ESTIMATED
  },
  perplexity: {
    // Perplexity uses opaque pricing; using best estimate
    'sonar-reasoning-pro': [1.00, 1.00], // ESTIMATED - flat cost approximation
    'sonar': [1.00, 1.00], // ESTIMATED
  },
};

/**
 * Calculate the cost of an AI agent run
 * @param provider - AI provider (openai, gemini, claude, perplexity, grok)
 * @param model - Full model name/version
 * @param promptTokens - Number of prompt tokens used
 * @param completionTokens - Number of completion tokens used
 * @returns Cost in USD
 */
export function calculateAgentCost(
  provider: string | undefined | null,
  model: string | undefined | null,
  promptTokens: number = 0,
  completionTokens: number = 0
): number {
  // Normalize inputs
  const normalizedProvider = (provider || 'openai').toLowerCase() as ProviderName;
  const normalizedModel = (model || '').toLowerCase();

  // Return 0 if no tokens
  if (promptTokens === 0 && completionTokens === 0) {
    return 0;
  }

  // Get provider pricing table
  const providerTiers = PROVIDER_PRICING[normalizedProvider];
  if (!providerTiers) {
    console.warn(
      `Unknown AI provider: ${provider}. Defaulting to $0 cost.`
    );
    return 0;
  }

  // Find matching pricing tier
  let pricingTier = providerTiers[normalizedModel];

  // If exact match not found, try prefix matching (first 2 segments)
  if (!pricingTier && normalizedModel) {
    const segments = normalizedModel.split('-');
    const prefix = segments.slice(0, Math.min(2, segments.length)).join('-');
    for (const [modelKey, pricing] of Object.entries(providerTiers)) {
      if (modelKey.toLowerCase().startsWith(prefix)) {
        pricingTier = pricing;
        break;
      }
    }
  }

  // Use provider default if still not found
  if (!pricingTier) {
    // Return first available model in provider (fallback default)
    const defaultModel = Object.entries(providerTiers)[0];
    if (defaultModel) {
      pricingTier = defaultModel[1];
    } else {
      console.warn(
        `No pricing found for provider: ${normalizedProvider}. Defaulting to $0 cost.`
      );
      return 0;
    }
  }

  // Calculate cost: (tokens / 1,000,000) * price_per_million
  const [inputPrice, outputPrice] = pricingTier;
  const inputCost = (promptTokens / 1_000_000) * inputPrice;
  const outputCost = (completionTokens / 1_000_000) * outputPrice;

  return inputCost + outputCost;
}
