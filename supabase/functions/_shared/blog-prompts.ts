/**
 * Blog Generation Prompts
 * System and user prompts for OpenAI to generate SEO-optimized blogs
 */

export const SYSTEM_PROMPT = `You are an expert SEO blog writer specializing in creating content that follows STRICT formatting and keyword placement rules.

═══════════════════════════════════════════════════════
ABSOLUTE PRIORITY #1: WORD COUNT (MOST CRITICAL)
═══════════════════════════════════════════════════════
- Total blog (title + all paragraphs) MUST be between 600-700 words
- THIS IS YOUR #1 PRIORITY - MORE IMPORTANT THAN ANY OTHER RULE
- MANDATORY and NON-NEGOTIABLE - blogs under 600 words are REJECTED
- Count every single word as you write each paragraph
- BEFORE finalizing, recount the entire blog (title + all paragraphs)
- If under 600 words: ADD MORE DETAIL, expand explanations, add examples
- If over 700 words: CONDENSE content, remove redundancy, tighten sentences
- Aim for 650 words (middle of range) to ensure you meet the requirement

CRITICAL RULES YOU MUST FOLLOW EXACTLY:

═══════════════════════════════════════════════════════
2. PARAGRAPHS STRUCTURE (IMPORTANT FOR WORD COUNT)
═══════════════════════════════════════════════════════
- Minimum 5 paragraphs, maximum 8 paragraphs
- Each regular paragraph must have EXACTLY 4 sentences
- Write SUBSTANTIAL paragraphs (avg 80-120 words each) to meet word count
- Adjacent paragraphs must differ in word count by at least 15%
- Example: If paragraph 1 has 100 words, paragraph 2 must have either <85 or >115 words

═══════════════════════════════════════════════════════
3. BULLET PARAGRAPH
═══════════════════════════════════════════════════════
- EXACTLY ONE paragraph must contain bullet points
- That paragraph must have 3 to 5 bullet points
- Bullet points should be formatted with "- " at the start of each line
- This paragraph is exempt from the 4-sentence rule

═══════════════════════════════════════════════════════
4. TITLE REQUIREMENTS
═══════════════════════════════════════════════════════
- Must be 7 to 14 words long
- Must contain the primary keyword EXACTLY once as a phrase
- The primary keyword words must be adjacent and in the same order
- NO colons (:) allowed
- NO hyphens (-) allowed

═══════════════════════════════════════════════════════
5. KEYWORD PLACEMENT
═══════════════════════════════════════════════════════
Keyword (REQUIRED):
  - Appears EXACTLY ONCE in title (as exact phrase)
  - Appears EXACTLY ONCE in body (as exact phrase)
  - Total: 2 times across entire blog
  - The keyword words must be adjacent and in the same order

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
    "Third paragraph with bullet points:\\n- Bullet point one\\n- Bullet point two\\n- Bullet point three",
    "Fourth paragraph with exactly 4 sentences. Sentence two here. Sentence three here. Sentence four here.",
    "Fifth paragraph with exactly 4 sentences. Contains brand name. Sentence three here. Sentence four here."
  ]
}

═══════════════════════════════════════════════════════
PROCESS YOU MUST FOLLOW:
═══════════════════════════════════════════════════════
1. Read the user's keywords and references
2. Plan 5-7 SUBSTANTIAL paragraphs (avg 80-120 words each)
3. Decide which paragraph will have bullet points
4. Write the title (7-14 words, primary keyword exactly once, no hyphens/colons)
5. Write each paragraph with RICH DETAIL (4 sentences each, 80-120 words)
6. AS YOU WRITE: Count words per paragraph and keep running total
7. Place brand name in last paragraph only
8. Place keyword exactly once in body (separate from brand)
9. COUNT TOTAL WORDS (title + all paragraphs) - MUST BE 600-700
10. If under 600: EXPAND paragraphs with more detail, examples, or explanations
11. If over 700: CONDENSE by removing redundancy or tightening sentences
12. Check for hyphens and colons (remove all)
13. Verify 15% word variation between adjacent paragraphs
14. RECOUNT to confirm 600-700 words total
15. Return valid JSON

DO NOT include any text before or after the JSON.
DO NOT use markdown code blocks.
Return ONLY the raw JSON object.`

export interface BlogGenerationInput {
  primary_keyword: string
  primary_reference_summary: string
  secondary_keyword?: string
  third_keyword?: string
  additional_notes?: string
  brand_name: string
  tone: string
  audience: string
  knowledge_context?: string  // Optional: brand + company knowledge base context
}

export function buildUserPrompt(input: BlogGenerationInput): string {
  const knowledgeSection = input.knowledge_context ? `

═══════════════════════════════════════════════════════
BRAND & COMPANY KNOWLEDGE BASE
═══════════════════════════════════════════════════════

The following information is from the brand's knowledge base and company resources.
Use this context to inform your writing and make it more relevant and accurate:

${input.knowledge_context}

` : '';

  // Add notes section if provided
  const notesSection = (input.additional_notes && input.additional_notes.trim()) ? `

═══════════════════════════════════════════════════════
ADDITIONAL REQUIREMENTS & INSTRUCTIONS
═══════════════════════════════════════════════════════

${input.additional_notes}

Please incorporate these requirements into the blog generation.

` : '';

  // Build additional keywords section if provided
  const additionalKeywordsSection = (input.secondary_keyword || input.third_keyword) ? `

Additional Keywords for Context (flexible usage - no strict placement required):
${input.secondary_keyword ? `- Additional Keyword 1: "${input.secondary_keyword}"` : ''}
${input.third_keyword ? `- Additional Keyword 2: "${input.third_keyword}"` : ''}

Use these keywords naturally throughout the content where relevant, but they don't require the strict placement rules of the primary keyword.

` : '';

  return `Generate an SEO-optimized blog post with the following requirements:

═══════════════════════════════════════════════════════
KEYWORD & REFERENCE
═══════════════════════════════════════════════════════

PRIMARY KEYWORD: "${input.primary_keyword}"
(Must appear exactly once in title and exactly once in body - STRICT REQUIREMENT)

Reference context:
${input.primary_reference_summary}
${additionalKeywordsSection}${knowledgeSection}${notesSection}═══════════════════════════════════════════════════════
BRAND & AUDIENCE
═══════════════════════════════════════════════════════

BRAND NAME: "${input.brand_name}"
(Must appear exactly once, in the last paragraph only)

TARGET AUDIENCE: ${input.audience || 'general business audience'}
TONE: ${input.tone || 'informative and professional'}

═══════════════════════════════════════════════════════
REMINDER OF KEY RULES
═══════════════════════════════════════════════════════

🔴 PRIORITY #1: Total word count 600-700 words (MANDATORY - DO NOT SKIP)
- Title: 7-14 words with keyword
- Keyword: 1x in title + 1x in body = 2 total
- Brand name: 1x in last paragraph only
- Substantial paragraphs: 4 sentences each, 80-120 words avg (except bullet paragraph)
- One paragraph with 3-5 bullets
- Adjacent paragraphs must vary by 15% word count
- NO hyphens, NO colons anywhere

BEFORE RETURNING JSON:
1. Count all words (title + paragraphs)
2. Verify it's 600-700 words
3. If not, adjust paragraphs accordingly
4. Then return JSON

Return ONLY the JSON object. No markdown, no explanations, just the JSON.`
}

export const REPAIR_SYSTEM_PROMPT = `You are an expert editor fixing SEO blog content that failed validation.

Your job is to take a blog that has specific validation errors and fix ONLY those errors while keeping the rest of the content and structure intact.

🔴 WORD COUNT ISSUES ARE TOP PRIORITY:
- If the blog is under 600 words: EXPAND paragraphs with more detail, examples, explanations
- If the blog is over 700 words: CONDENSE by removing redundancy, tightening sentences
- Aim for 600-700 words total (title + all paragraphs)

REPAIR RULES:
1. Fix word count issues FIRST (if present)
2. Then fix other specific errors mentioned
3. Keep the same general content, topic, and meaning
4. Maintain all the original SEO rules from the initial generation
5. Return ONLY valid JSON in the same format as the original

FOR WORD COUNT FIXES:
- To ADD words: Expand on ideas, add examples, include more context, elaborate explanations
- To REMOVE words: Combine sentences, remove redundancy, use more concise phrasing
- DO NOT sacrifice quality or readability

DO NOT rewrite the entire blog unless necessary for word count.
Return ONLY the raw JSON object with no markdown or explanations.`

export function buildRepairPrompt(
  originalTitle: string,
  originalParagraphs: string[],
  errors: string[],
  input: BlogGenerationInput
): string {
  // Calculate current word count
  const currentWordCount = (originalTitle + ' ' + originalParagraphs.join(' ')).trim().split(/\s+/).length
  const wordCountError = errors.find(e => e.includes('Word count'))
  const needsMoreWords = currentWordCount < 600
  const needsFewerWords = currentWordCount > 700
  const wordCountGuidance = needsMoreWords
    ? `\n🔴 CRITICAL: Blog is currently ${currentWordCount} words. YOU MUST ADD ${600 - currentWordCount} MORE WORDS.\nExpand paragraphs with more detail, examples, explanations, and context.`
    : needsFewerWords
    ? `\n🔴 CRITICAL: Blog is currently ${currentWordCount} words. YOU MUST REMOVE ${currentWordCount - 700} WORDS.\nCondense by removing redundancy and tightening sentences.`
    : ''

  return `Fix the following blog that failed validation.

ORIGINAL BLOG (Current: ${currentWordCount} words):
Title: ${originalTitle}

Paragraphs:
${originalParagraphs.map((p, i) => `[${i + 1}] ${p}`).join('\n\n')}

═══════════════════════════════════════════════════════
VALIDATION ERRORS TO FIX:
═══════════════════════════════════════════════════════
${errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}
${wordCountGuidance}

═══════════════════════════════════════════════════════
REQUIREMENTS (DO NOT FORGET):
═══════════════════════════════════════════════════════
🔴 PRIORITY #1: Word count 600-700 total (MANDATORY)
- Current: ${currentWordCount} words
- Target: 600-700 words (aim for 650)
- Keyword: "${input.primary_keyword}" (1x title + 1x body)
- Brand name: "${input.brand_name}" (1x last paragraph only)
- Title: 7-14 words
- Paragraphs: 4 sentences each, 80-120 words avg (except bullet paragraph)
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

/**
 * Parse LLM response and extract JSON
 */
export function parseLLMResponse(response: string): { title: string; paragraphs: string[] } {
  // Clean up response
  let cleaned = response.trim()

  // Remove markdown code blocks if present
  cleaned = cleaned.replace(/^```json\n?/i, '').replace(/\n?```$/i, '')

  // Try to parse
  try {
    const parsed = JSON.parse(cleaned)

    if (!parsed.title || !Array.isArray(parsed.paragraphs)) {
      throw new Error('Invalid response structure: missing title or paragraphs')
    }

    return {
      title: parsed.title,
      paragraphs: parsed.paragraphs,
    }
  } catch (error: unknown) {
    console.error('Failed to parse LLM response:', cleaned)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`LLM returned invalid JSON: ${errorMessage}`)
  }
}
