/**
 * SEO Blog Validator
 * Enforces all hard rules for blog content generation
 *
 * Rules enforced:
 * 1. Word count: 600-700 total
 * 2. Title: 7-14 words with primary keyword exactly once
 * 3. Keywords: Primary (2x: 1 title + 1 body) required, Secondary (1x optional), Third (1x optional)
 * 4. Keyword separation: No two keywords in same paragraph
 * 5. Brand name: Exactly once, in last paragraph only
 * 6. Bullet paragraph: Exactly one, with 3-5 bullets
 * 7. Paragraph structure: 4 sentences each (except bullet paragraph)
 * 8. Paragraph variation: 15% minimum word count difference between adjacent
 * 9. Forbidden characters: No hyphens, no colons
 */

export interface ValidationConfig {
  primary_keyword: string
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

    // Primary: 1 in title + 1 in body = 2 total (always required)
    if (stats.keyword_counts.primary_total !== 2) {
      errors.push(
        `Keyword "${this.config.primary_keyword}" must appear exactly 2 times total (1 in title, 1 in body). Found: ${stats.keyword_counts.primary_total} (${stats.keyword_counts.primary_in_title} in title, ${stats.keyword_counts.primary_in_body} in body)`
      )
    }

    // Brand: exactly 1 (always required)
    if (stats.keyword_counts.brand !== 1) {
      errors.push(
        `Brand name "${this.config.brand_name}" must appear exactly once. Found: ${stats.keyword_counts.brand}`
      )
    }

    return errors
  }

  /**
   * Validate that keyword and brand name are in separate paragraphs
   */
  private validateKeywordSeparation(stats: ValidationStats): string[] {
    const errors: string[] = []

    stats.paragraph_stats.forEach((para) => {
      if (para.keywords_found.length > 1) {
        errors.push(
          `Paragraph ${para.index + 1} contains both keyword and brand name. They must be in separate paragraphs.`
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
   * Validate paragraph structure (4 sentences each, except bullet paragraph)
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
    return /^[\s]*[\-\*•]/m.test(text)
  }

  private countBullets(text: string): number {
    const lines = text.split('\n')
    return lines.filter(line => /^[\s]*[\-\*•]/.test(line)).length
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
