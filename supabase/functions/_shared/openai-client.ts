/**
 * OpenAI API Client
 * Wrapper for OpenAI Chat Completions API with cost tracking
 */

export interface OpenAIConfig {
  apiKey: string
  model: string
  temperature?: number
  maxTokens?: number
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface OpenAIUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

export interface OpenAIResponse {
  content: string
  usage: OpenAIUsage
  cost_usd: number
  model: string
}

/**
 * Pricing for OpenAI models (as of 2024)
 * Update these if pricing changes
 */
const MODEL_PRICING: Record<string, { prompt: number; completion: number }> = {
  'gpt-4-turbo': {
    prompt: 0.01,  // $0.01 per 1K tokens
    completion: 0.03,  // $0.03 per 1K tokens
  },
  'gpt-4-turbo-preview': {
    prompt: 0.01,
    completion: 0.03,
  },
  'gpt-4': {
    prompt: 0.03,
    completion: 0.06,
  },
  'gpt-3.5-turbo': {
    prompt: 0.0005,
    completion: 0.0015,
  },
}

export class OpenAIClient {
  private config: OpenAIConfig

  constructor(config: OpenAIConfig) {
    this.config = config
  }

  /**
   * Call OpenAI Chat Completions API
   */
  async chat(messages: ChatMessage[]): Promise<OpenAIResponse> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        temperature: this.config.temperature ?? 0.3,
        max_tokens: this.config.maxTokens ?? 2500,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('OpenAI API Error:', errorText)
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()

    // Extract response content
    const content = data.choices?.[0]?.message?.content || ''
    const usage: OpenAIUsage = {
      prompt_tokens: data.usage?.prompt_tokens || 0,
      completion_tokens: data.usage?.completion_tokens || 0,
      total_tokens: data.usage?.total_tokens || 0,
    }

    // Calculate cost
    const cost = this.calculateCost(usage, this.config.model)

    return {
      content,
      usage,
      cost_usd: cost,
      model: this.config.model,
    }
  }

  /**
   * Calculate cost based on token usage and model
   */
  private calculateCost(usage: OpenAIUsage, model: string): number {
    // Find pricing for the model
    let pricing = MODEL_PRICING[model]

    // Fallback to gpt-4-turbo pricing if model not found
    if (!pricing) {
      console.warn(`Pricing not found for model ${model}, using gpt-4-turbo pricing`)
      pricing = MODEL_PRICING['gpt-4-turbo']
    }

    const promptCost = (usage.prompt_tokens / 1000) * pricing.prompt
    const completionCost = (usage.completion_tokens / 1000) * pricing.completion
    const totalCost = promptCost + completionCost

    return totalCost
  }

  /**
   * Test connection to OpenAI API
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.chat([
        { role: 'user', content: 'Say "OK" if you can hear me.' }
      ])
      return response.content.length > 0
    } catch (error) {
      console.error('OpenAI connection test failed:', error)
      return false
    }
  }
}

/**
 * Create an OpenAI client from environment variables
 */
export function createOpenAIClient(options?: {
  model?: string
  temperature?: number
  maxTokens?: number
}): OpenAIClient {
  const apiKey = Deno.env.get('OPENAI_KEY')

  if (!apiKey) {
    throw new Error('OPENAI_KEY environment variable is not set')
  }

  return new OpenAIClient({
    apiKey,
    model: options?.model || Deno.env.get('OPENAI_MODEL') || 'gpt-4-turbo-preview',
    temperature: (options?.temperature ?? Number(Deno.env.get('OPENAI_TEMPERATURE'))) || 0.3,
    maxTokens: (options?.maxTokens ?? Number(Deno.env.get('OPENAI_MAX_TOKENS'))) || 4000,
  })
}
