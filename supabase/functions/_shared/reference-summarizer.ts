/**
 * Reference Summarizer
 * Summarizes reference content using OpenAI with caching support
 */

import { OpenAIClient, ChatMessage } from './openai-client.ts'

const SUMMARIZATION_SYSTEM_PROMPT = `You are a research assistant that creates concise summaries of reference content for blog writing.

Your summaries should:
- Extract key facts, statistics, and insights
- Maintain important context
- Be concise (100-200 words)
- Focus on information relevant for writing SEO blog content

Return ONLY the summary text. No additional commentary.`

export interface ReferenceSummary {
  summary: string
  tokens_used: number
}

export class ReferenceSummarizer {
  private openai: OpenAIClient

  constructor(openai: OpenAIClient) {
    this.openai = openai
  }

  /**
   * Summarize reference content
   */
  async summarize(referenceText: string): Promise<ReferenceSummary> {
    // If reference is already short, return as-is
    if (referenceText.length < 500) {
      return {
        summary: referenceText,
        tokens_used: 0,
      }
    }

    // Truncate if too long (to avoid token limits)
    let textToSummarize = referenceText
    if (textToSummarize.length > 4000) {
      textToSummarize = textToSummarize.substring(0, 4000) + '... [content truncated]'
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: SUMMARIZATION_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Summarize the following reference content:\n\n${textToSummarize}`,
      },
    ]

    const response = await this.openai.chat(messages)

    return {
      summary: response.content,
      tokens_used: response.usage.total_tokens,
    }
  }

  /**
   * Create a hash of content for caching
   * Simple hash function for Deno
   */
  hashContent(content: string): string {
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36)
  }

  /**
   * Check if a reference is a URL
   */
  isURL(reference: string): boolean {
    try {
      new URL(reference)
      return true
    } catch {
      return false
    }
  }
}

/**
 * Get or create a summary with database caching
 */
export async function getOrCreateSummary(
  supabase: any,
  summarizer: ReferenceSummarizer,
  referenceText: string,
  keywordLabel: string
): Promise<ReferenceSummary> {
  if (!referenceText || referenceText.trim().length === 0) {
    return {
      summary: `No reference provided for ${keywordLabel} keyword. Use general knowledge to write relevant content.`,
      tokens_used: 0,
    }
  }

  // Check cache
  const contentHash = summarizer.hashContent(referenceText)

  const { data: cached, error: cacheError } = await supabase
    .from('seo_reference_summaries')
    .select('summary, tokens_used')
    .eq('reference_hash', contentHash)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (cacheError) {
    console.error('Cache lookup error:', cacheError)
    // Continue without cache
  }

  if (cached) {
    console.log(`Using cached summary for ${keywordLabel}`)
    return {
      summary: cached.summary,
      tokens_used: 0, // Already paid for
    }
  }

  // Generate new summary
  console.log(`Generating new summary for ${keywordLabel}`)
  const result = await summarizer.summarize(referenceText)

  // Store in cache
  const isURL = summarizer.isURL(referenceText)
  const { error: insertError } = await supabase
    .from('seo_reference_summaries')
    .insert({
      reference_url: isURL ? referenceText : null,
      reference_hash: contentHash,
      summary: result.summary,
      tokens_used: result.tokens_used,
      model_used: 'gpt-4-turbo-preview',
    })

  if (insertError) {
    console.error('Cache insert error:', insertError)
    // Continue even if cache fails
  }

  return result
}
