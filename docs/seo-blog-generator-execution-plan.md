# SEO Blog Generator - Complete Execution Plan

## Executive Summary

A sophisticated AI-powered blog generation system that produces SEO-optimized content with strict validation rules. The system integrates with existing brand management and uses OpenAI GPT-4-turbo to generate blogs that automatically pass stringent quality and formatting requirements.

---

## Hard Requirements Specification

### Content Rules (Strictly Enforced)

```yaml
word_count:
  minimum: 600
  maximum: 700
  includes: "title + all paragraphs"

title:
  word_count_min: 7
  word_count_max: 14
  primary_keyword_rule: "exact phrase match, case-insensitive, words must be adjacent"
  forbidden_characters: [":", "-"]

paragraphs:
  structure: "exactly 4 sentences per paragraph"
  minimum_paragraphs: 5
  maximum_paragraphs: 8
  word_count_variation: "15% minimum difference between adjacent paragraphs"

keywords:
  primary:
    title_count: 1        # Must appear exactly once in title
    body_count: 1         # Must appear exactly once in body
    total_count: 2        # Total across title + body
    match_type: "exact phrase, case-insensitive, adjacent words"

  secondary:
    count: 1              # Exactly once in body only
    match_type: "exact phrase, case-insensitive"

  third:
    count: 1              # Exactly once in body only
    match_type: "exact phrase, case-insensitive"

  separation_rule: "No two keywords can appear in the same paragraph"

brand_name:
  count: 1
  location: "last paragraph only"
  match_type: "case-insensitive"

bullet_paragraph:
  required: true
  count: 1               # Exactly one paragraph with bullets
  bullet_count_min: 3
  bullet_count_max: 5

forbidden_characters:
  hyphens: "banned completely (no exceptions)"
  colons: "banned completely (no exceptions)"
  examples_to_avoid:
    - "real-time" → use "real time"
    - "e-commerce" → use "ecommerce" or "online shopping"
    - "Title: Subtitle" → just "Title Subtitle"
```

---

## System Architecture

### Technology Stack

```yaml
Backend:
  platform: "Supabase Edge Functions (Deno)"
  llm_provider: "OpenAI"
  llm_model: "gpt-4-turbo"
  database: "PostgreSQL (Supabase)"

Frontend:
  framework: "React 18 + TypeScript"
  ui_library: "shadcn/ui + Radix UI"
  state_management: "@tanstack/react-query"
  routing: "react-router-dom"

Validation:
  language: "TypeScript"
  runtime: "Deno (backend) + Node (frontend for preview)"
```

### High-Level Flow

```
User Input → Reference Summarization → Blog Generation → Validation
                                              ↓ (if invalid)
                                         Repair Attempt → Validation
                                              ↓ (if still invalid)
                                         Return Best Attempt + Errors
```

---

## Phase 1: Database Schema (Day 1)

### Migration File: `supabase/migrations/[timestamp]_create_seo_blog_system.sql`

```sql
-- ============================================================================
-- SEO Blog Content Generation System
-- ============================================================================

-- Main table for generated blogs
CREATE TABLE IF NOT EXISTS public.seo_blog_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Input Parameters
  primary_keyword TEXT NOT NULL,
  primary_reference TEXT,
  primary_reference_summary TEXT,

  secondary_keyword TEXT NOT NULL,
  secondary_reference TEXT,
  secondary_reference_summary TEXT,

  third_keyword TEXT NOT NULL,
  third_reference TEXT,
  third_reference_summary TEXT,

  brand_name TEXT NOT NULL,
  tone TEXT DEFAULT 'informative',
  audience TEXT,

  -- Generated Output
  title TEXT,
  paragraphs JSONB, -- Array of paragraph strings

  -- Validation Results
  validation_result JSONB,
  is_valid BOOLEAN DEFAULT false,
  validation_errors TEXT[],
  validation_warnings TEXT[],

  -- Generation Metadata
  generation_attempts INTEGER DEFAULT 0,
  llm_model TEXT DEFAULT 'gpt-4-turbo',
  total_tokens_used INTEGER,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  cost_usd DECIMAL(10, 4),
  generation_time_ms INTEGER,

  -- Status Management
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'validated', 'failed', 'published')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

-- Generation attempt logs for debugging
CREATE TABLE IF NOT EXISTS public.seo_blog_generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_id UUID NOT NULL REFERENCES public.seo_blog_content(id) ON DELETE CASCADE,

  attempt_number INTEGER NOT NULL,
  attempt_type TEXT NOT NULL CHECK (attempt_type IN ('initial', 'repair')),

  -- Prompts and Responses
  system_prompt TEXT,
  user_prompt TEXT,
  llm_response TEXT,
  llm_raw_response JSONB,

  -- Validation for this attempt
  validation_errors JSONB,
  validation_warnings JSONB,
  was_valid BOOLEAN DEFAULT false,

  -- Token usage for this attempt
  tokens_used INTEGER,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reference summaries cache (to avoid re-summarizing same URLs)
CREATE TABLE IF NOT EXISTS public.seo_reference_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  reference_url TEXT UNIQUE,
  reference_hash TEXT UNIQUE, -- Hash of full text content
  summary TEXT NOT NULL,

  tokens_used INTEGER,
  model_used TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
);

-- Indexes for performance
CREATE INDEX idx_seo_blogs_brand_id ON public.seo_blog_content(brand_id);
CREATE INDEX idx_seo_blogs_user_id ON public.seo_blog_content(user_id);
CREATE INDEX idx_seo_blogs_status ON public.seo_blog_content(status);
CREATE INDEX idx_seo_blogs_created_at ON public.seo_blog_content(created_at DESC);
CREATE INDEX idx_seo_blog_logs_blog_id ON public.seo_blog_generation_logs(blog_id);
CREATE INDEX idx_seo_reference_expires ON public.seo_reference_summaries(expires_at);

-- RLS Policies
ALTER TABLE public.seo_blog_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_blog_generation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_reference_summaries ENABLE ROW LEVEL SECURITY;

-- Users can view their own blogs
CREATE POLICY "Users can view own blogs"
  ON public.seo_blog_content FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert blogs
CREATE POLICY "Users can create blogs"
  ON public.seo_blog_content FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own blogs
CREATE POLICY "Users can update own blogs"
  ON public.seo_blog_content FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own blogs
CREATE POLICY "Users can delete own blogs"
  ON public.seo_blog_content FOR DELETE
  USING (auth.uid() = user_id);

-- Logs are viewable by blog owners
CREATE POLICY "Users can view own blog logs"
  ON public.seo_blog_generation_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.seo_blog_content
      WHERE id = blog_id AND user_id = auth.uid()
    )
  );

-- Reference summaries are readable by authenticated users
CREATE POLICY "Authenticated users can view reference summaries"
  ON public.seo_reference_summaries FOR SELECT
  USING (auth.role() = 'authenticated');

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_seo_blog_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_seo_blog_content_updated_at
  BEFORE UPDATE ON public.seo_blog_content
  FOR EACH ROW
  EXECUTE FUNCTION update_seo_blog_updated_at();

-- Cleanup expired reference summaries
CREATE OR REPLACE FUNCTION cleanup_expired_reference_summaries()
RETURNS void AS $$
BEGIN
  DELETE FROM public.seo_reference_summaries
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
```

---

## Phase 2: Validation Engine (Days 2-3)

### File: `supabase/functions/_shared/blog-validator.ts`

```typescript
/**
 * SEO Blog Validator
 * Enforces all hard rules for blog content generation
 */

export interface ValidationConfig {
  primary_keyword: string
  secondary_keyword: string
  third_keyword: string
  brand_name: string
}

export interface ParagraphStats {
  index: number
  word_count: number
  sentence_count: number
  has_bullets: boolean
  bullet_count: number
  keywords_found: string[]
}

export interface ValidationStats {
  total_word_count: number
  title_word_count: number
  body_word_count: number
  paragraph_count: number
  keyword_counts: {
    primary_in_title: number
    primary_in_body: number
    primary_total: number
    secondary: number
    third: number
    brand: number
  }
  paragraph_stats: ParagraphStats[]
  has_bullet_paragraph: boolean
  bullet_paragraph_index: number | null
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  stats: ValidationStats
}

export class BlogValidator {
  private config: ValidationConfig

  constructor(config: ValidationConfig) {
    this.config = config
  }

  /**
   * Main validation function
   */
  validate(title: string, paragraphs: string[]): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Build stats
    const stats = this.buildStats(title, paragraphs)

    // Run all validations
    errors.push(...this.validateWordCount(stats))
    errors.push(...this.validateTitle(title, stats))
    errors.push(...this.validateKeywordCounts(stats))
    errors.push(...this.validateKeywordSeparation(stats))
    errors.push(...this.validateBrandPlacement(paragraphs, stats))
    errors.push(...this.validateBulletParagraph(stats))
    errors.push(...this.validateParagraphStructure(stats))
    errors.push(...this.validateParagraphVariation(stats))
    errors.push(...this.validateForbiddenCharacters(title, paragraphs))

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      stats,
    }
  }

  /**
   * Build comprehensive stats about the content
   */
  private buildStats(title: string, paragraphs: string[]): ValidationStats {
    const titleWords = this.countWords(title)
    let bodyWords = 0

    const paragraphStats: ParagraphStats[] = paragraphs.map((para, index) => {
      const wordCount = this.countWords(para)
      bodyWords += wordCount

      const sentences = this.splitIntoSentences(para)
      const hasBullets = this.hasBulletPoints(para)
      const bulletCount = hasBullets ? this.countBullets(para) : 0

      // Find keywords in this paragraph
      const keywordsFound: string[] = []
      const lowerPara = para.toLowerCase()

      if (this.containsExactPhrase(lowerPara, this.config.primary_keyword)) {
        keywordsFound.push('primary')
      }
      if (this.containsExactPhrase(lowerPara, this.config.secondary_keyword)) {
        keywordsFound.push('secondary')
      }
      if (this.containsExactPhrase(lowerPara, this.config.third_keyword)) {
        keywordsFound.push('third')
      }
      if (this.containsExactPhrase(lowerPara, this.config.brand_name)) {
        keywordsFound.push('brand')
      }

      return {
        index,
        word_count: wordCount,
        sentence_count: sentences.length,
        has_bullets: hasBullets,
        bullet_count: bulletCount,
        keywords_found: keywordsFound,
      }
    })

    // Count keywords
    const primaryInTitle = this.countExactPhrases(title.toLowerCase(), this.config.primary_keyword)
    const primaryInBody = this.countExactPhrasesInParagraphs(paragraphs, this.config.primary_keyword)
    const secondaryCount = this.countExactPhrasesInParagraphs(paragraphs, this.config.secondary_keyword)
    const thirdCount = this.countExactPhrasesInParagraphs(paragraphs, this.config.third_keyword)
    const brandCount = this.countExactPhrasesInParagraphs(paragraphs, this.config.brand_name)

    // Find bullet paragraph
    const bulletParagraphIndex = paragraphStats.findIndex(p => p.has_bullets)

    return {
      total_word_count: titleWords + bodyWords,
      title_word_count: titleWords,
      body_word_count: bodyWords,
      paragraph_count: paragraphs.length,
      keyword_counts: {
        primary_in_title: primaryInTitle,
        primary_in_body: primaryInBody,
        primary_total: primaryInTitle + primaryInBody,
        secondary: secondaryCount,
        third: thirdCount,
        brand: brandCount,
      },
      paragraph_stats: paragraphStats,
      has_bullet_paragraph: bulletParagraphIndex !== -1,
      bullet_paragraph_index: bulletParagraphIndex !== -1 ? bulletParagraphIndex : null,
    }
  }

  /**
   * Validate total word count (600-700)
   */
  private validateWordCount(stats: ValidationStats): string[] {
    const errors: string[] = []
    const count = stats.total_word_count

    if (count < 600) {
      errors.push(`Word count too low: ${count} words (minimum: 600). Need ${600 - count} more words.`)
    } else if (count > 700) {
      errors.push(`Word count too high: ${count} words (maximum: 700). Need to remove ${count - 700} words.`)
    }

    return errors
  }

  /**
   * Validate title requirements
   */
  private validateTitle(title: string, stats: ValidationStats): string[] {
    const errors: string[] = []

    // Word count: 7-14 words
    if (stats.title_word_count < 7) {
      errors.push(`Title too short: ${stats.title_word_count} words (minimum: 7)`)
    } else if (stats.title_word_count > 14) {
      errors.push(`Title too long: ${stats.title_word_count} words (maximum: 14)`)
    }

    // Primary keyword must appear exactly once
    if (stats.keyword_counts.primary_in_title !== 1) {
      errors.push(
        `Primary keyword "${this.config.primary_keyword}" must appear exactly once in title (found: ${stats.keyword_counts.primary_in_title})`
      )
    }

    return errors
  }

  /**
   * Validate keyword counts
   */
  private validateKeywordCounts(stats: ValidationStats): string[] {
    const errors: string[] = []

    // Primary: 1 in title + 1 in body = 2 total
    if (stats.keyword_counts.primary_total !== 2) {
      errors.push(
        `Primary keyword "${this.config.primary_keyword}" must appear exactly 2 times total (1 in title, 1 in body). Found: ${stats.keyword_counts.primary_total} (${stats.keyword_counts.primary_in_title} in title, ${stats.keyword_counts.primary_in_body} in body)`
      )
    }

    // Secondary: exactly 1
    if (stats.keyword_counts.secondary !== 1) {
      errors.push(
        `Secondary keyword "${this.config.secondary_keyword}" must appear exactly once. Found: ${stats.keyword_counts.secondary}`
      )
    }

    // Third: exactly 1
    if (stats.keyword_counts.third !== 1) {
      errors.push(
        `Third keyword "${this.config.third_keyword}" must appear exactly once. Found: ${stats.keyword_counts.third}`
      )
    }

    // Brand: exactly 1
    if (stats.keyword_counts.brand !== 1) {
      errors.push(
        `Brand name "${this.config.brand_name}" must appear exactly once. Found: ${stats.keyword_counts.brand}`
      )
    }

    return errors
  }

  /**
   * Validate that no two keywords appear in the same paragraph
   */
  private validateKeywordSeparation(stats: ValidationStats): string[] {
    const errors: string[] = []

    stats.paragraph_stats.forEach((para) => {
      if (para.keywords_found.length > 1) {
        errors.push(
          `Paragraph ${para.index + 1} contains multiple keywords: ${para.keywords_found.join(', ')}. Each keyword must be in a separate paragraph.`
        )
      }
    })

    return errors
  }

  /**
   * Validate brand name placement (last paragraph only)
   */
  private validateBrandPlacement(paragraphs: string[], stats: ValidationStats): string[] {
    const errors: string[] = []

    if (stats.keyword_counts.brand === 0) {
      return errors // Already caught by keyword count validation
    }

    const lastParagraphIndex = paragraphs.length - 1
    const brandParagraphs = stats.paragraph_stats
      .filter(p => p.keywords_found.includes('brand'))
      .map(p => p.index)

    if (brandParagraphs.length > 0 && !brandParagraphs.includes(lastParagraphIndex)) {
      errors.push(
        `Brand name "${this.config.brand_name}" must appear in the last paragraph only. Found in paragraph(s): ${brandParagraphs.map(i => i + 1).join(', ')}`
      )
    }

    return errors
  }

  /**
   * Validate bullet paragraph (exactly one, with 3-5 bullets)
   */
  private validateBulletParagraph(stats: ValidationStats): string[] {
    const errors: string[] = []

    const bulletParagraphs = stats.paragraph_stats.filter(p => p.has_bullets)

    if (bulletParagraphs.length === 0) {
      errors.push('No bullet point paragraph found. Exactly one paragraph must contain bullet points.')
    } else if (bulletParagraphs.length > 1) {
      errors.push(
        `Multiple bullet paragraphs found (paragraphs: ${bulletParagraphs.map(p => p.index + 1).join(', ')}). Only one paragraph should have bullets.`
      )
    } else {
      const bulletPara = bulletParagraphs[0]
      if (bulletPara.bullet_count < 3) {
        errors.push(
          `Bullet paragraph (paragraph ${bulletPara.index + 1}) has too few bullets: ${bulletPara.bullet_count} (minimum: 3)`
        )
      } else if (bulletPara.bullet_count > 5) {
        errors.push(
          `Bullet paragraph (paragraph ${bulletPara.index + 1}) has too many bullets: ${bulletPara.bullet_count} (maximum: 5)`
        )
      }
    }

    return errors
  }

  /**
   * Validate paragraph structure (4 sentences each)
   */
  private validateParagraphStructure(stats: ValidationStats): string[] {
    const errors: string[] = []

    stats.paragraph_stats.forEach((para) => {
      // Skip bullet paragraphs from sentence count validation
      if (para.has_bullets) {
        return
      }

      if (para.sentence_count !== 4) {
        errors.push(
          `Paragraph ${para.index + 1} has ${para.sentence_count} sentences (required: 4 sentences per paragraph)`
        )
      }
    })

    return errors
  }

  /**
   * Validate paragraph word count variation (15% minimum between adjacent)
   */
  private validateParagraphVariation(stats: ValidationStats): string[] {
    const errors: string[] = []

    for (let i = 0; i < stats.paragraph_stats.length - 1; i++) {
      const current = stats.paragraph_stats[i]
      const next = stats.paragraph_stats[i + 1]

      const diff = Math.abs(current.word_count - next.word_count)
      const avgCount = (current.word_count + next.word_count) / 2
      const percentDiff = (diff / avgCount) * 100

      if (percentDiff < 15) {
        errors.push(
          `Paragraphs ${i + 1} and ${i + 2} have similar word counts (${current.word_count} and ${next.word_count} words, ${percentDiff.toFixed(1)}% difference). Minimum 15% variation required.`
        )
      }
    }

    return errors
  }

  /**
   * Validate no forbidden characters (hyphens and colons)
   */
  private validateForbiddenCharacters(title: string, paragraphs: string[]): string[] {
    const errors: string[] = []
    const fullText = title + '\n' + paragraphs.join('\n')

    // Check for hyphens
    const hyphenMatches = fullText.match(/-/g)
    if (hyphenMatches) {
      const firstHyphenIndex = fullText.indexOf('-')
      const context = fullText.substring(Math.max(0, firstHyphenIndex - 20), firstHyphenIndex + 20)
      errors.push(
        `Hyphens are not allowed. Found ${hyphenMatches.length} hyphen(s). First occurrence near: "...${context}..."`
      )
    }

    // Check for colons
    const colonMatches = fullText.match(/:/g)
    if (colonMatches) {
      const firstColonIndex = fullText.indexOf(':')
      const context = fullText.substring(Math.max(0, firstColonIndex - 20), firstColonIndex + 20)
      errors.push(
        `Colons are not allowed. Found ${colonMatches.length} colon(s). First occurrence near: "...${context}..."`
      )
    }

    return errors
  }

  // ========== Helper Methods ==========

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length
  }

  private splitIntoSentences(text: string): string[] {
    // Remove bullet markers first
    const cleanText = text.replace(/^[\s\-\*•]\s*/gm, '')
    // Split by sentence endings
    return cleanText
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0)
  }

  private hasBulletPoints(text: string): boolean {
    // Check for common bullet markers at start of lines
    return /^[\s\-\*•]/m.test(text)
  }

  private countBullets(text: string): number {
    const lines = text.split('\n')
    return lines.filter(line => /^[\s\-\*•]/.test(line)).length
  }

  private containsExactPhrase(text: string, phrase: string): boolean {
    const lowerText = text.toLowerCase()
    const lowerPhrase = phrase.toLowerCase()

    // Create regex for exact phrase match with word boundaries
    const regex = new RegExp(`\\b${this.escapeRegex(lowerPhrase)}\\b`, 'i')
    return regex.test(lowerText)
  }

  private countExactPhrases(text: string, phrase: string): number {
    const lowerText = text.toLowerCase()
    const lowerPhrase = phrase.toLowerCase()

    const regex = new RegExp(`\\b${this.escapeRegex(lowerPhrase)}\\b`, 'gi')
    const matches = lowerText.match(regex)
    return matches ? matches.length : 0
  }

  private countExactPhrasesInParagraphs(paragraphs: string[], phrase: string): number {
    return paragraphs.reduce((count, para) => {
      return count + this.countExactPhrases(para, phrase)
    }, 0)
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
}

/**
 * Convenience function for quick validation
 */
export function validateBlog(
  title: string,
  paragraphs: string[],
  config: ValidationConfig
): ValidationResult {
  const validator = new BlogValidator(config)
  return validator.validate(title, paragraphs)
}
```

---

## Phase 3: OpenAI Integration & Prompts (Days 4-5)

### File: `supabase/functions/_shared/openai-client.ts`

```typescript
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

export interface OpenAIResponse {
  content: string
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  cost_usd: number
}

export class OpenAIClient {
  private config: OpenAIConfig

  constructor(config: OpenAIConfig) {
    this.config = config
  }

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
        max_tokens: this.config.maxTokens ?? 2000,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${error}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content || ''
    const usage = data.usage

    // Calculate cost (GPT-4-turbo pricing as of 2024)
    const promptCost = (usage.prompt_tokens / 1000) * 0.01  // $0.01 per 1K prompt tokens
    const completionCost = (usage.completion_tokens / 1000) * 0.03  // $0.03 per 1K completion tokens
    const totalCost = promptCost + completionCost

    return {
      content,
      usage: {
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        total_tokens: usage.total_tokens,
      },
      cost_usd: totalCost,
    }
  }
}
```

### File: `supabase/functions/_shared/blog-prompts.ts`

```typescript
export const SYSTEM_PROMPT = `You are an expert SEO blog writer specializing in creating content that follows STRICT formatting and keyword placement rules.

CRITICAL RULES YOU MUST FOLLOW EXACTLY:

═══════════════════════════════════════════════════════
1. WORD COUNT
═══════════════════════════════════════════════════════
- Total blog (title + all paragraphs) must be between 600-700 words
- Count every single word carefully before returning

═══════════════════════════════════════════════════════
2. TITLE REQUIREMENTS
═══════════════════════════════════════════════════════
- Must be 7 to 14 words long
- Must contain the primary keyword EXACTLY once as a phrase
- The primary keyword words must be adjacent and in the same order
- NO colons (:) allowed
- NO hyphens (-) allowed

═══════════════════════════════════════════════════════
3. KEYWORD PLACEMENT (CRITICAL)
═══════════════════════════════════════════════════════
Primary keyword:
  - Appears EXACTLY ONCE in title (as exact phrase)
  - Appears EXACTLY ONCE in body (as exact phrase)
  - Total: 2 times across entire blog

Secondary keyword:
  - Appears EXACTLY ONCE in body only (as exact phrase)

Third keyword:
  - Appears EXACTLY ONCE in body only (as exact phrase)

KEYWORD SEPARATION RULE:
  - NO TWO KEYWORDS can appear in the same paragraph
  - If primary keyword is in paragraph 1, secondary and third must be in different paragraphs
  - Plan your paragraph structure carefully to separate all keywords

═══════════════════════════════════════════════════════
4. PARAGRAPHS STRUCTURE
═══════════════════════════════════════════════════════
- Minimum 5 paragraphs, maximum 8 paragraphs
- Each regular paragraph must have EXACTLY 4 sentences
- Adjacent paragraphs must differ in word count by at least 15%
- Example: If paragraph 1 has 100 words, paragraph 2 must have either <85 or >115 words

═══════════════════════════════════════════════════════
5. BULLET PARAGRAPH
═══════════════════════════════════════════════════════
- EXACTLY ONE paragraph must contain bullet points
- That paragraph must have 3 to 5 bullet points
- Bullet points should be formatted with "- " at the start of each line
- This paragraph is exempt from the 4-sentence rule

═══════════════════════════════════════════════════════
6. BRAND NAME
═══════════════════════════════════════════════════════
- Must appear EXACTLY ONCE
- Must appear in the LAST PARAGRAPH ONLY
- Cannot appear anywhere else in the blog

═══════════════════════════════════════════════════════
7. FORBIDDEN CHARACTERS (ABSOLUTE)
═══════════════════════════════════════════════════════
- NO hyphens (-) anywhere in the blog
- NO colons (:) anywhere in the blog
- Instead of "real-time" write "real time"
- Instead of "e-commerce" write "ecommerce" or "online shopping"
- Instead of "Title: Subtitle" write "Title Subtitle"

═══════════════════════════════════════════════════════
8. OUTPUT FORMAT
═══════════════════════════════════════════════════════
Return ONLY valid JSON in this exact format:

{
  "title": "Your 7-14 word title with primary keyword",
  "paragraphs": [
    "First paragraph with exactly 4 sentences. Sentence two here. Sentence three here. Sentence four here.",
    "Second paragraph with exactly 4 sentences. Different word count from first. Sentence three here. Sentence four here.",
    "Third paragraph with bullet points:\n- Bullet point one\n- Bullet point two\n- Bullet point three",
    "Fourth paragraph with exactly 4 sentences. Sentence two here. Sentence three here. Sentence four here.",
    "Fifth paragraph with exactly 4 sentences. Contains brand name. Sentence three here. Sentence four here."
  ]
}

═══════════════════════════════════════════════════════
PROCESS YOU MUST FOLLOW:
═══════════════════════════════════════════════════════
1. Read the user's keywords and references
2. Plan which paragraph will contain which keyword (ensure separation)
3. Decide which paragraph will have bullet points (not the last one if brand goes there)
4. Write the title (7-14 words, primary keyword exactly once, no hyphens/colons)
5. Write each paragraph (4 sentences each, except bullet paragraph)
6. Ensure word count variation between adjacent paragraphs (15% minimum)
7. Place brand name in last paragraph only
8. Count total words (must be 600-700)
9. Check for hyphens and colons (remove all)
10. Return valid JSON

DO NOT include any text before or after the JSON.
DO NOT use markdown code blocks.
Return ONLY the raw JSON object.`

export interface BlogGenerationInput {
  primary_keyword: string
  primary_reference_summary: string
  secondary_keyword: string
  secondary_reference_summary: string
  third_keyword: string
  third_reference_summary: string
  brand_name: string
  tone: string
  audience: string
}

export function buildUserPrompt(input: BlogGenerationInput): string {
  return `Generate an SEO-optimized blog post with the following requirements:

═══════════════════════════════════════════════════════
KEYWORDS & REFERENCES
═══════════════════════════════════════════════════════

PRIMARY KEYWORD: "${input.primary_keyword}"
Reference context:
${input.primary_reference_summary}

SECONDARY KEYWORD: "${input.secondary_keyword}"
Reference context:
${input.secondary_reference_summary}

THIRD KEYWORD: "${input.third_keyword}"
Reference context:
${input.third_reference_summary}

═══════════════════════════════════════════════════════
BRAND & AUDIENCE
═══════════════════════════════════════════════════════

BRAND NAME: "${input.brand_name}"
(Must appear exactly once, in the last paragraph only)

TARGET AUDIENCE: ${input.audience || 'general business audience'}
TONE: ${input.tone || 'informative and professional'}

═══════════════════════════════════════════════════════
REMINDER OF KEY RULES
═══════════════════════════════════════════════════════

- Total word count: 600-700 words
- Title: 7-14 words with primary keyword
- Primary keyword: 1x in title + 1x in body = 2 total
- Secondary keyword: 1x in body
- Third keyword: 1x in body
- NO TWO KEYWORDS in the same paragraph
- Brand name: 1x in last paragraph only
- Exactly 4 sentences per paragraph (except bullet paragraph)
- One paragraph with 3-5 bullets
- Adjacent paragraphs must vary by 15% word count
- NO hyphens, NO colons anywhere

Return ONLY the JSON object. No markdown, no explanations, just the JSON.`
}

export const REPAIR_SYSTEM_PROMPT = `You are an expert editor fixing SEO blog content that failed validation.

Your job is to take a blog that has specific validation errors and fix ONLY those errors while keeping the rest of the content and structure intact.

RULES:
1. Fix only the specific errors mentioned
2. Keep the same general content and meaning
3. Maintain all the original SEO rules from the initial generation
4. Return ONLY valid JSON in the same format as the original

DO NOT rewrite the entire blog. Make surgical fixes only.
Return ONLY the raw JSON object with no markdown or explanations.`

export function buildRepairPrompt(
  originalTitle: string,
  originalParagraphs: string[],
  errors: string[],
  input: BlogGenerationInput
): string {
  return `Fix the following blog that failed validation.

ORIGINAL BLOG:
Title: ${originalTitle}

Paragraphs:
${originalParagraphs.map((p, i) => `[${i + 1}] ${p}`).join('\n\n')}

═══════════════════════════════════════════════════════
VALIDATION ERRORS TO FIX:
═══════════════════════════════════════════════════════
${errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}

═══════════════════════════════════════════════════════
REQUIREMENTS (DO NOT FORGET):
═══════════════════════════════════════════════════════
- Primary keyword: "${input.primary_keyword}" (1x title + 1x body)
- Secondary keyword: "${input.secondary_keyword}" (1x body)
- Third keyword: "${input.third_keyword}" (1x body)
- Brand name: "${input.brand_name}" (1x last paragraph only)
- NO keywords in same paragraph
- Word count: 600-700 total
- Title: 7-14 words
- Paragraphs: 4 sentences each (except bullet paragraph)
- One bullet paragraph with 3-5 bullets
- 15% word variation between adjacent paragraphs
- NO hyphens, NO colons

Fix the errors and return the corrected blog as a JSON object:
{
  "title": "...",
  "paragraphs": ["...", "...", ...]
}

Return ONLY the JSON. No explanations.`
}
```

---

## Phase 4: Reference Summarization (Day 6)

### File: `supabase/functions/_shared/reference-summarizer.ts`

```typescript
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

  async summarize(referenceText: string): Promise<ReferenceSummary> {
    // If reference is already short, return as-is
    if (referenceText.length < 500) {
      return {
        summary: referenceText,
        tokens_used: 0,
      }
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: SUMMARIZATION_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Summarize the following reference content:\n\n${referenceText}`,
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
   */
  hashContent(content: string): string {
    // Simple hash function for Deno
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString(36)
  }
}
```

---

## Phase 5: Main Edge Function (Days 7-9)

### File: `supabase/functions/generate-seo-blog/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { OpenAIClient } from '../_shared/openai-client.ts'
import { BlogValidator, ValidationResult } from '../_shared/blog-validator.ts'
import { ReferenceSummarizer } from '../_shared/reference-summarizer.ts'
import {
  SYSTEM_PROMPT,
  REPAIR_SYSTEM_PROMPT,
  buildUserPrompt,
  buildRepairPrompt,
  BlogGenerationInput,
} from '../_shared/blog-prompts.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  primary_keyword: string
  primary_reference: string
  secondary_keyword: string
  secondary_reference: string
  third_keyword: string
  third_reference: string
  brand_name: string
  brand_id: string
  tone?: string
  audience?: string
}

interface BlogOutput {
  title: string
  paragraphs: string[]
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize clients
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get authenticated user
    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    // Parse request
    const body: RequestBody = await req.json()

    console.log('Starting blog generation for user:', user.id)

    // Initialize OpenAI
    const openai = new OpenAIClient({
      apiKey: Deno.env.get('OPENAI_API_KEY') ?? '',
      model: 'gpt-4-turbo-preview',
      temperature: 0.3,
      maxTokens: 2500,
    })

    // Initialize summarizer
    const summarizer = new ReferenceSummarizer(openai)

    // Step 1: Create blog record
    const { data: blogRecord, error: insertError } = await supabaseClient
      .from('seo_blog_content')
      .insert({
        user_id: user.id,
        brand_id: body.brand_id,
        primary_keyword: body.primary_keyword,
        primary_reference: body.primary_reference,
        secondary_keyword: body.secondary_keyword,
        secondary_reference: body.secondary_reference,
        third_keyword: body.third_keyword,
        third_reference: body.third_reference,
        brand_name: body.brand_name,
        tone: body.tone || 'informative',
        audience: body.audience || 'general business audience',
        status: 'generating',
      })
      .select()
      .single()

    if (insertError) throw insertError

    const blogId = blogRecord.id
    const startTime = Date.now()

    // Step 2: Summarize references
    console.log('Summarizing references...')

    const primarySummary = await getOrCreateSummary(
      supabaseClient,
      summarizer,
      body.primary_reference,
      'primary'
    )

    const secondarySummary = await getOrCreateSummary(
      supabaseClient,
      summarizer,
      body.secondary_reference,
      'secondary'
    )

    const thirdSummary = await getOrCreateSummary(
      supabaseClient,
      summarizer,
      body.third_reference,
      'third'
    )

    // Update summaries in database
    await supabaseClient
      .from('seo_blog_content')
      .update({
        primary_reference_summary: primarySummary.summary,
        secondary_reference_summary: secondarySummary.summary,
        third_reference_summary: thirdSummary.summary,
      })
      .eq('id', blogId)

    // Step 3: Generate initial blog
    console.log('Generating initial blog...')

    const generationInput: BlogGenerationInput = {
      primary_keyword: body.primary_keyword,
      primary_reference_summary: primarySummary.summary,
      secondary_keyword: body.secondary_keyword,
      secondary_reference_summary: secondarySummary.summary,
      third_keyword: body.third_keyword,
      third_reference_summary: thirdSummary.summary,
      brand_name: body.brand_name,
      tone: body.tone || 'informative',
      audience: body.audience || 'general business audience',
    }

    let currentAttempt = 1
    let totalTokens = primarySummary.tokens_used + secondarySummary.tokens_used + thirdSummary.tokens_used
    let totalCost = 0

    const { blog, validation, tokens, cost } = await generateAndValidate(
      openai,
      generationInput,
      SYSTEM_PROMPT,
      buildUserPrompt(generationInput),
      blogId,
      currentAttempt,
      'initial',
      supabaseClient
    )

    totalTokens += tokens
    totalCost += cost

    // Step 4: If validation failed, attempt repair
    if (!validation.valid && currentAttempt < 3) {
      console.log('Validation failed. Attempting repair...')
      currentAttempt++

      const repairResult = await generateAndValidate(
        openai,
        generationInput,
        REPAIR_SYSTEM_PROMPT,
        buildRepairPrompt(blog.title, blog.paragraphs, validation.errors, generationInput),
        blogId,
        currentAttempt,
        'repair',
        supabaseClient,
        blog
      )

      if (repairResult.validation.valid) {
        // Repair successful
        Object.assign(blog, repairResult.blog)
        Object.assign(validation, repairResult.validation)
        totalTokens += repairResult.tokens
        totalCost += repairResult.cost
      }
    }

    // Step 5: Update final blog record
    const generationTime = Date.now() - startTime

    await supabaseClient
      .from('seo_blog_content')
      .update({
        title: blog.title,
        paragraphs: blog.paragraphs,
        validation_result: validation,
        is_valid: validation.valid,
        validation_errors: validation.errors,
        validation_warnings: validation.warnings,
        generation_attempts: currentAttempt,
        total_tokens_used: totalTokens,
        cost_usd: totalCost,
        generation_time_ms: generationTime,
        status: validation.valid ? 'validated' : 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', blogId)

    // Step 6: Return result
    return new Response(
      JSON.stringify({
        success: true,
        blog_id: blogId,
        title: blog.title,
        paragraphs: blog.paragraphs,
        validation: validation,
        meta: {
          attempts: currentAttempt,
          total_tokens: totalTokens,
          cost_usd: totalCost,
          generation_time_ms: generationTime,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error generating blog:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

// ========== Helper Functions ==========

async function getOrCreateSummary(
  supabase: any,
  summarizer: ReferenceSummarizer,
  referenceText: string,
  keyword: string
): Promise<{ summary: string; tokens_used: number }> {
  if (!referenceText || referenceText.trim().length === 0) {
    return {
      summary: `No reference provided for ${keyword} keyword.`,
      tokens_used: 0,
    }
  }

  // Check cache
  const contentHash = summarizer.hashContent(referenceText)

  const { data: cached } = await supabase
    .from('seo_reference_summaries')
    .select('summary, tokens_used')
    .eq('reference_hash', contentHash)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (cached) {
    console.log(`Using cached summary for ${keyword}`)
    return {
      summary: cached.summary,
      tokens_used: 0, // Already paid for
    }
  }

  // Generate new summary
  console.log(`Generating new summary for ${keyword}`)
  const result = await summarizer.summarize(referenceText)

  // Cache it
  await supabase.from('seo_reference_summaries').insert({
    reference_hash: contentHash,
    summary: result.summary,
    tokens_used: result.tokens_used,
    model_used: 'gpt-4-turbo-preview',
  })

  return result
}

async function generateAndValidate(
  openai: OpenAIClient,
  input: BlogGenerationInput,
  systemPrompt: string,
  userPrompt: string,
  blogId: string,
  attemptNumber: number,
  attemptType: 'initial' | 'repair',
  supabase: any,
  previousBlog?: BlogOutput
): Promise<{
  blog: BlogOutput
  validation: ValidationResult
  tokens: number
  cost: number
}> {
  // Call OpenAI
  const response = await openai.chat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ])

  // Parse response
  let blog: BlogOutput
  try {
    const cleaned = response.content.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '')
    blog = JSON.parse(cleaned)
  } catch (parseError) {
    console.error('Failed to parse LLM response:', response.content)
    throw new Error('LLM returned invalid JSON')
  }

  // Validate
  const validator = new BlogValidator({
    primary_keyword: input.primary_keyword,
    secondary_keyword: input.secondary_keyword,
    third_keyword: input.third_keyword,
    brand_name: input.brand_name,
  })

  const validation = validator.validate(blog.title, blog.paragraphs)

  // Log attempt
  await supabase.from('seo_blog_generation_logs').insert({
    blog_id: blogId,
    attempt_number: attemptNumber,
    attempt_type: attemptType,
    system_prompt: systemPrompt,
    user_prompt: userPrompt,
    llm_response: response.content,
    llm_raw_response: blog,
    validation_errors: validation.errors,
    validation_warnings: validation.warnings,
    was_valid: validation.valid,
    tokens_used: response.usage.total_tokens,
    prompt_tokens: response.usage.prompt_tokens,
    completion_tokens: response.usage.completion_tokens,
  })

  return {
    blog,
    validation,
    tokens: response.usage.total_tokens,
    cost: response.cost_usd,
  }
}
```

---

## Phase 6: Frontend Components (Days 10-13)

### File: `src/hooks/useSEOBlogGenerator.ts`

```typescript
import { useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export interface BlogGenerationInput {
  primary_keyword: string
  primary_reference: string
  secondary_keyword: string
  secondary_reference: string
  third_keyword: string
  third_reference: string
  brand_name: string
  brand_id: string
  tone?: string
  audience?: string
}

export interface BlogGenerationResult {
  success: boolean
  blog_id: string
  title: string
  paragraphs: string[]
  validation: {
    valid: boolean
    errors: string[]
    warnings: string[]
    stats: any
  }
  meta: {
    attempts: number
    total_tokens: number
    cost_usd: number
    generation_time_ms: number
  }
}

export function useSEOBlogGenerator() {
  return useMutation({
    mutationFn: async (input: BlogGenerationInput): Promise<BlogGenerationResult> => {
      const { data, error } = await supabase.functions.invoke('generate-seo-blog', {
        body: input,
      })

      if (error) throw error
      if (!data.success) throw new Error(data.error || 'Generation failed')

      return data
    },
  })
}

export function useSEOBlogHistory(brandId?: string) {
  return useQuery({
    queryKey: ['seo-blogs', brandId],
    enabled: !!brandId,
    queryFn: async () => {
      const query = supabase
        .from('seo_blog_content')
        .select('*')
        .order('created_at', { ascending: false })

      if (brandId) {
        query.eq('brand_id', brandId)
      }

      const { data, error } = await query

      if (error) throw error
      return data
    },
  })
}

export function useSEOBlogDetails(blogId: string) {
  return useQuery({
    queryKey: ['seo-blog', blogId],
    enabled: !!blogId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seo_blog_content')
        .select('*')
        .eq('id', blogId)
        .single()

      if (error) throw error
      return data
    },
  })
}

export function useSEOBlogLogs(blogId: string) {
  return useQuery({
    queryKey: ['seo-blog-logs', blogId],
    enabled: !!blogId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seo_blog_generation_logs')
        .select('*')
        .eq('blog_id', blogId)
        .order('attempt_number', { ascending: true })

      if (error) throw error
      return data
    },
  })
}
```

### File: `src/pages/content/SEOBlogGenerator.tsx`

```typescript
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useSEOBlogGenerator } from '@/hooks/useSEOBlogGenerator'
import { useToast } from '@/hooks/use-toast'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Sparkles, FileText } from 'lucide-react'
import Unauthorized from '@/pages/Unauthorized'

export default function SEOBlogGenerator() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const generateBlog = useSEOBlogGenerator()

  // Form state
  const [selectedBrandId, setSelectedBrandId] = useState('')
  const [primaryKeyword, setPrimaryKeyword] = useState('')
  const [primaryReference, setPrimaryReference] = useState('')
  const [secondaryKeyword, setSecondaryKeyword] = useState('')
  const [secondaryReference, setSecondaryReference] = useState('')
  const [thirdKeyword, setThirdKeyword] = useState('')
  const [thirdReference, setThirdReference] = useState('')
  const [tone, setTone] = useState('informative')
  const [audience, setAudience] = useState('')

  // Load user's brands
  const { data: brands, isLoading: loadingBrands } = useQuery({
    queryKey: ['user-brands', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_brands')
        .select('brand_id, brands(*)')
        .eq('user_id', user!.id)

      if (error) throw error
      return data.map((ub) => ub.brands)
    },
  })

  const selectedBrand = brands?.find((b) => b.id === selectedBrandId)

  const handleGenerate = async () => {
    if (!selectedBrand) {
      toast({
        title: 'Select a brand',
        description: 'Please select a brand to generate content for.',
        variant: 'destructive',
      })
      return
    }

    if (!primaryKeyword || !secondaryKeyword || !thirdKeyword) {
      toast({
        title: 'Missing keywords',
        description: 'Please provide all three keywords.',
        variant: 'destructive',
      })
      return
    }

    try {
      const result = await generateBlog.mutateAsync({
        brand_id: selectedBrand.id,
        brand_name: selectedBrand.name,
        primary_keyword: primaryKeyword,
        primary_reference: primaryReference,
        secondary_keyword: secondaryKeyword,
        secondary_reference: secondaryReference,
        third_keyword: thirdKeyword,
        third_reference: thirdReference,
        tone,
        audience,
      })

      toast({
        title: 'Blog generated!',
        description: result.validation.valid
          ? 'Your SEO blog passed all validations.'
          : 'Blog generated with some validation warnings.',
      })

      // Navigate to result page
      navigate(`/content/seo-blog/${result.blog_id}`)
    } catch (error) {
      console.error(error)
      toast({
        title: 'Generation failed',
        description: error.message || 'Unable to generate blog. Please try again.',
        variant: 'destructive',
      })
    }
  }

  if (!user) {
    return <Unauthorized />
  }

  return (
    <div className="container max-w-4xl mx-auto py-8 space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-3xl">SEO Blog Generator</CardTitle>
              <CardDescription>
                Generate SEO-optimized blog posts with strict keyword placement and formatting rules
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Brand Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Brand</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a brand..." />
            </SelectTrigger>
            <SelectContent>
              {brands?.map((brand) => (
                <SelectItem key={brand.id} value={brand.id}>
                  {brand.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Keywords & References */}
      <Card>
        <CardHeader>
          <CardTitle>Keywords & References</CardTitle>
          <CardDescription>
            Provide three keywords and optional reference content for context
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Primary Keyword */}
          <div className="space-y-3 p-4 border rounded-lg">
            <h3 className="font-semibold text-sm text-primary">Primary Keyword</h3>
            <div className="space-y-2">
              <Label htmlFor="primary-keyword">Keyword (appears 2x: 1x in title, 1x in body)</Label>
              <Input
                id="primary-keyword"
                placeholder="e.g., cloud computing solutions"
                value={primaryKeyword}
                onChange={(e) => setPrimaryKeyword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="primary-reference">Reference Content (optional)</Label>
              <Textarea
                id="primary-reference"
                placeholder="Paste text or URL for context..."
                rows={3}
                value={primaryReference}
                onChange={(e) => setPrimaryReference(e.target.value)}
              />
            </div>
          </div>

          {/* Secondary Keyword */}
          <div className="space-y-3 p-4 border rounded-lg">
            <h3 className="font-semibold text-sm text-muted-foreground">Secondary Keyword</h3>
            <div className="space-y-2">
              <Label htmlFor="secondary-keyword">Keyword (appears 1x in body)</Label>
              <Input
                id="secondary-keyword"
                placeholder="e.g., data security"
                value={secondaryKeyword}
                onChange={(e) => setSecondaryKeyword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="secondary-reference">Reference Content (optional)</Label>
              <Textarea
                id="secondary-reference"
                placeholder="Paste text or URL for context..."
                rows={3}
                value={secondaryReference}
                onChange={(e) => setSecondaryReference(e.target.value)}
              />
            </div>
          </div>

          {/* Third Keyword */}
          <div className="space-y-3 p-4 border rounded-lg">
            <h3 className="font-semibold text-sm text-muted-foreground">Third Keyword</h3>
            <div className="space-y-2">
              <Label htmlFor="third-keyword">Keyword (appears 1x in body)</Label>
              <Input
                id="third-keyword"
                placeholder="e.g., business scalability"
                value={thirdKeyword}
                onChange={(e) => setThirdKeyword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="third-reference">Reference Content (optional)</Label>
              <Textarea
                id="third-reference"
                placeholder="Paste text or URL for context..."
                rows={3}
                value={thirdReference}
                onChange={(e) => setThirdReference(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tone & Audience */}
      <Card>
        <CardHeader>
          <CardTitle>Tone & Audience</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tone">Tone</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger id="tone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="informative">Informative</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="friendly">Friendly</SelectItem>
                <SelectItem value="technical">Technical</SelectItem>
                <SelectItem value="conversational">Conversational</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="audience">Target Audience</Label>
            <Input
              id="audience"
              placeholder="e.g., small business owners, IT professionals"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Generate Button */}
      <Card>
        <CardContent className="pt-6">
          <Button
            size="lg"
            className="w-full"
            onClick={handleGenerate}
            disabled={generateBlog.isPending || !selectedBrandId}
          >
            {generateBlog.isPending ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Generating blog...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-5 w-5" />
                Generate SEO Blog
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
```

---

## Phase 7: Result & History Pages (Days 14-15)

### File: `src/pages/content/SEOBlogResult.tsx`

```typescript
import { useParams, Link } from 'react-router-dom'
import { useSEOBlogDetails } from '@/hooks/useSEOBlogGenerator'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/use-toast'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  CheckCircle2,
  AlertCircle,
  Copy,
  Download,
  ArrowLeft,
  FileText,
} from 'lucide-react'
import Unauthorized from '@/pages/Unauthorized'

export default function SEOBlogResult() {
  const { blogId } = useParams<{ blogId: string }>()
  const { user } = useAuth()
  const { toast } = useToast()

  const { data: blog, isLoading } = useSEOBlogDetails(blogId!)

  const handleCopy = () => {
    if (!blog) return

    const fullText = `${blog.title}\n\n${(blog.paragraphs as string[]).join('\n\n')}`

    navigator.clipboard.writeText(fullText).then(() => {
      toast({
        title: 'Copied to clipboard',
        description: 'Blog content copied successfully.',
      })
    })
  }

  const handleDownload = () => {
    if (!blog) return

    const fullText = `# ${blog.title}\n\n${(blog.paragraphs as string[]).join('\n\n')}`
    const blob = new Blob([fullText], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${blog.title.slice(0, 50).replace(/[^a-z0-9]/gi, '-')}.md`
    a.click()
    URL.revokeObjectURL(url)

    toast({
      title: 'Downloaded',
      description: 'Blog saved as Markdown file.',
    })
  }

  if (!user) {
    return <Unauthorized />
  }

  if (isLoading) {
    return (
      <div className="container max-w-4xl mx-auto py-8 space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!blog) {
    return (
      <div className="container max-w-4xl mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Blog not found</CardTitle>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const validation = blog.validation_result as any
  const paragraphs = blog.paragraphs as string[]

  return (
    <div className="container max-w-4xl mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" asChild>
          <Link to="/content/seo-blog-generator">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Generator
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleCopy}>
            <Copy className="mr-2 h-4 w-4" />
            Copy
          </Button>
          <Button variant="outline" onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
        </div>
      </div>

      {/* Validation Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Validation Status</CardTitle>
              <CardDescription>
                Generated in {blog.generation_time_ms}ms • {blog.generation_attempts} attempt(s)
              </CardDescription>
            </div>
            {blog.is_valid ? (
              <Badge variant="default" className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                All Rules Passed
              </Badge>
            ) : (
              <Badge variant="destructive" className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Has Errors
              </Badge>
            )}
          </div>
        </CardHeader>
        {validation?.errors?.length > 0 && (
          <CardContent>
            <div className="space-y-2">
              <h4 className="font-semibold text-sm text-destructive">Validation Errors:</h4>
              <ul className="space-y-1">
                {validation.errors.map((error: string, index: number) => (
                  <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Generated Blog */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{blog.title}</CardTitle>
          <CardDescription>
            {validation?.stats?.total_word_count} words • {paragraphs.length} paragraphs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 prose prose-sm max-w-none">
          {paragraphs.map((para: string, index: number) => (
            <div key={index} className="text-sm leading-relaxed">
              {para.split('\n').map((line, lineIndex) => (
                <p key={lineIndex} className="mb-2">
                  {line}
                </p>
              ))}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Stats */}
      {validation?.stats && (
        <Card>
          <CardHeader>
            <CardTitle>Content Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Words</p>
                <p className="text-2xl font-bold">{validation.stats.total_word_count}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Paragraphs</p>
                <p className="text-2xl font-bold">{validation.stats.paragraph_count}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Primary Keyword</p>
                <p className="text-2xl font-bold">{validation.stats.keyword_counts.primary_total}x</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cost</p>
                <p className="text-2xl font-bold">${blog.cost_usd?.toFixed(4)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

---

## Phase 8: Testing (Days 16-17)

### File: `supabase/functions/_shared/blog-validator.test.ts`

```typescript
import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { BlogValidator } from './blog-validator.ts'

Deno.test('BlogValidator - Valid blog passes all checks', () => {
  const validator = new BlogValidator({
    primary_keyword: 'cloud computing',
    secondary_keyword: 'data security',
    third_keyword: 'business growth',
    brand_name: 'TechCorp',
  })

  const title = 'How Cloud Computing Transforms Modern Business Operations Today'
  const paragraphs = [
    'Cloud computing has revolutionized how businesses operate. Companies now access powerful tools remotely. This shift reduces infrastructure costs significantly. Digital transformation drives competitive advantage.',
    'Data security remains a critical priority. Organizations implement robust protection measures. Compliance requirements guide security strategies. Trust builds through transparent practices.',
    'Business growth accelerates with scalable solutions. Teams collaborate more effectively online. Remote work capabilities expand talent pools. Innovation thrives in flexible environments.',
    'Key benefits include:\n- Reduced operational costs\n- Enhanced flexibility\n- Improved collaboration',
    'Modern enterprises embrace digital transformation continually. TechCorp provides comprehensive cloud solutions. Strategic partnerships drive mutual success. Future ready organizations lead their industries.',
  ]

  const result = validator.validate(title, paragraphs)

  assertEquals(result.valid, true)
  assertEquals(result.errors.length, 0)
})

Deno.test('BlogValidator - Detects word count violations', () => {
  const validator = new BlogValidator({
    primary_keyword: 'test',
    secondary_keyword: 'test2',
    third_keyword: 'test3',
    brand_name: 'Brand',
  })

  const title = 'Short Test Title With Test Keyword'
  const paragraphs = ['Too short. Only few words. Not enough content. Bad.']

  const result = validator.validate(title, paragraphs)

  assertEquals(result.valid, false)
  assertEquals(result.errors.some(e => e.includes('Word count too low')), true)
})

Deno.test('BlogValidator - Detects hyphen usage', () => {
  const validator = new BlogValidator({
    primary_keyword: 'test',
    secondary_keyword: 'test2',
    third_keyword: 'test3',
    brand_name: 'Brand',
  })

  const title = 'Valid Test Title Without Hyphens'
  const paragraphs = [
    'This has a real-time example. Another sentence. Third sentence. Fourth sentence.',
  ]

  const result = validator.validate(title, paragraphs)

  assertEquals(result.valid, false)
  assertEquals(result.errors.some(e => e.includes('Hyphens are not allowed')), true)
})

// Add more tests for each validation rule...
```

---

## Phase 9: Deployment & Monitoring (Day 18)

### Environment Variables

Add to `.env`:

```env
# OpenAI Configuration
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo-preview
OPENAI_MAX_TOKENS=2500
OPENAI_TEMPERATURE=0.3
```

### Deployment Checklist

```yaml
Pre-Deployment:
  - [ ] Run database migration
  - [ ] Deploy edge function `generate-seo-blog`
  - [ ] Set environment variables
  - [ ] Run validation tests
  - [ ] Test reference summarization
  - [ ] Test full generation flow

Post-Deployment:
  - [ ] Generate 5 test blogs with real data
  - [ ] Verify all validation rules work
  - [ ] Check cost tracking accuracy
  - [ ] Monitor error logs for 24 hours
  - [ ] Set up alerts for failures

Documentation:
  - [ ] User guide
  - [ ] API reference
  - [ ] Troubleshooting guide
  - [ ] Add feature to navigation menu
```

---

## Cost Estimation

### OpenAI Costs (GPT-4-turbo)

```
Reference Summarization (3x):
  - ~500 tokens per summary
  - Cost: ~$0.02 per blog

Initial Generation:
  - ~1000 prompt tokens
  - ~1500 completion tokens
  - Cost: ~$0.05 per blog

Repair Attempt (if needed):
  - ~1500 prompt tokens
  - ~1500 completion tokens
  - Cost: ~$0.06 per blog

Average per blog: $0.05 - $0.13
Monthly (100 blogs): $5 - $13
```

---

## Success Metrics

Track these KPIs:

1. **Validation Success Rate**: % of blogs that pass on first attempt (target: >80%)
2. **Average Generation Time**: Time from request to completion (target: <30s)
3. **Cost per Blog**: Average OpenAI cost (target: <$0.15)
4. **User Satisfaction**: Feedback on blog quality (target: >4/5)
5. **Edit Rate**: % of blogs requiring manual edits (target: <20%)

---

## Timeline Summary

| Phase | Days | Description |
|-------|------|-------------|
| 1 | 1 | Database schema & migration |
| 2-3 | 2 | Validation engine |
| 3 | 2 | OpenAI integration & prompts |
| 4 | 1 | Reference summarization |
| 5 | 3 | Main edge function |
| 6 | 4 | Frontend components |
| 7 | 2 | Result & history pages |
| 8 | 2 | Testing |
| 9 | 1 | Deployment & monitoring |
| **Total** | **18 days** | Complete system |

---

## Next Steps

1. ✅ **Approved plan?** → Start with Phase 1 (database migration)
2. 🔧 **Need changes?** → Specify what to adjust
3. 📝 **Questions?** → Ask for clarifications

Ready to start building? I can begin with Phase 1 immediately!
