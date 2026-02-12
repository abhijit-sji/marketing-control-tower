# SEO Blog Generator

> **Last Updated:** 2026-01-15  
> **Status:** ✅ Active  
> **Slug:** `seo-blog-generator`

## Overview

The SEO Blog Generator creates optimized blog content with strict validation rules. It uses a generate-validate-repair loop to ensure content meets SEO best practices, including keyword placement, word count, and structure requirements.

## Key Features

- **Validation Pipeline**: 3-attempt repair cycle for quality assurance
- **Reference Summarization**: AI-powered URL/content summarization
- **Knowledge Grounding**: Uses brand and company knowledge for context
- **Keyword Optimization**: Primary, secondary, and tertiary keyword support
- **Cost Tracking**: Monitors token usage and generation costs
- **Generation Logging**: Detailed attempt logs for debugging

## Scope

- **Type**: Global
- **Required Role**: Content Creator or higher
- **Access**: Admin Panel → AI Control → SEO Blog Generator

## Validation Rules

The `BlogValidator` enforces:

| Rule | Requirement |
|------|-------------|
| Word Count | 600-700 words |
| Title Length | 50-60 characters |
| Primary Keyword | Must appear in title and first paragraph |
| Paragraph Structure | 4-6 paragraphs |
| Heading Usage | H2 and H3 headings required |
| Meta Description | 150-160 characters |

## Data Sources

| Source | Table | Purpose |
|--------|-------|---------|
| Brand Knowledge | `brand_knowledge_embeddings` | Semantic search for context |
| Company Knowledge | `knowledge_embeddings` | Global knowledge context |
| Analytics | `brand_analytics_data` | Brand performance data |
| KPIs | `brand_kpis` | Brand goals and targets |
| Reference Cache | `reference_summaries` | Cached URL summaries |
| Blog Records | `seo_blog_content` | Generated content storage |
| Generation Logs | `seo_blog_generation_logs` | Attempt history |

## Edge Function

**File**: `supabase/functions/generate-seo-blog/index.ts`

### Request Schema

```typescript
interface RequestBody {
  primary_keyword: string;
  primary_reference: string;  // URL or content
  secondary_keyword?: string;
  third_keyword?: string;
  additional_notes?: string;
  brand_name: string;
  brand_id: string;
  tone?: string;  // Default: 'informative'
  audience?: string;  // Default: 'general business audience'
}
```

### Response Schema

```typescript
interface SEOBlogResponse {
  success: boolean;
  blog_id: string;
  title: string;
  paragraphs: string[];
  validation: {
    valid: boolean;
    errors: string[];
    warnings: string[];
    metrics: {
      word_count: number;
      title_length: number;
      keyword_density: number;
    };
  };
  meta: {
    attempts: number;
    total_tokens: number;
    cost_usd: number;
    generation_time_ms: number;
  };
}
```

## Workflow

### Generation Pipeline

```
┌─────────────────────────────────────────────────┐
│            1. CREATE BLOG RECORD                │
│  Status: 'generating'                           │
└─────────────────────┬───────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────┐
│            2. SUMMARIZE REFERENCES              │
│  Cache URL summaries for reuse                  │
└─────────────────────┬───────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────┐
│            3. COLLECT KNOWLEDGE                 │
│  Brand embeddings + Company knowledge           │
└─────────────────────┬───────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────┐
│            4. GENERATE + VALIDATE               │
│  Initial generation attempt                     │
└─────────────────────┬───────────────────────────┘
                      │
              ┌───────▼───────┐
              │    VALID?     │
              └───────┬───────┘
                      │
         NO ──────────┴────────── YES
         │                        │
         ▼                        ▼
┌─────────────────┐      ┌─────────────────┐
│   REPAIR LOOP   │      │   SAVE & RETURN │
│  (up to 3 tries)│      │  Status: 'validated'
└─────────────────┘      └─────────────────┘
```

### Repair System Prompt

When validation fails, the repair prompt includes:
- Original content
- List of validation errors
- Specific instructions to fix each error
- Word count emphasis if that's the issue

## Output Format

### Blog Content
```json
{
  "title": "10 AI Marketing Strategies for B2B SaaS Growth",
  "paragraphs": [
    "## Introduction\n\nAI marketing strategies are transforming how B2B SaaS companies...",
    "## Strategy 1: Predictive Lead Scoring\n\n...",
    "## Strategy 2: Content Personalization\n\n...",
    "..."
  ]
}
```

### Validation Result
```json
{
  "valid": true,
  "errors": [],
  "warnings": [
    "Secondary keyword could appear more frequently"
  ],
  "metrics": {
    "word_count": 650,
    "title_length": 52,
    "keyword_density": 2.3,
    "primary_keyword_in_title": true,
    "primary_keyword_in_first_para": true
  }
}
```

## UI Components

- **Generator Page**: `src/pages/content/SEOBlogGenerator.tsx`
- **Blog Editor**: `src/components/seo/BlogEditor.tsx`
- **Validation Display**: `src/components/seo/ValidationPanel.tsx`

## AI Provider

- **Model**: gpt-4o (configurable via agent config)
- **Temperature**: 0.3 (consistent, factual output)
- **Max Tokens**: 4000 (sufficient for 600-700 word content)

## Reference Summarizer

The `ReferenceSummarizer` class:

1. Checks cache for existing summary
2. If URL: Fetches and extracts main content
3. Generates AI summary focused on key points
4. Caches summary for future use

```typescript
interface ReferenceSummary {
  source: string;
  summary: string;
  key_points: string[];
  tokens_used: number;
}
```

## Knowledge Context Collection

```typescript
// Searches both brand-specific and global knowledge
const [brandKnowledge, globalKnowledge] = await Promise.all([
  searchBrandEmbeddings(supabase, keyword, [brandId], 3, 0.7),
  searchKnowledgeEmbeddings(supabase, keyword, categoryIds, 3, 0.7),
]);
```

## Best Practices

1. **Quality References**: Provide authoritative sources for accurate content
2. **Specific Keywords**: Use 3-4 word long-tail keywords
3. **Brand Knowledge**: Upload relevant brand materials for grounding
4. **Review Validation**: Check warnings even when content is valid
5. **Track Performance**: Monitor which blogs drive traffic

## Configuration

```sql
SELECT * FROM ai_agents WHERE slug = 'seo-blog-generator';
```

Key config fields:
- `data_sources.ai_model`: Model to use (default: gpt-4o)
- `system_prompt`: Base generation instructions

## Database Schema

### seo_blog_content
```sql
CREATE TABLE seo_blog_content (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  brand_id UUID REFERENCES brands,
  primary_keyword TEXT NOT NULL,
  primary_reference TEXT,
  secondary_keyword TEXT,
  third_keyword TEXT,
  title TEXT,
  paragraphs JSONB,
  status TEXT,  -- 'generating', 'validated', 'failed'
  is_valid BOOLEAN,
  validation_errors TEXT[],
  validation_warnings TEXT[],
  generation_attempts INTEGER,
  total_tokens_used INTEGER,
  cost_usd DECIMAL,
  created_at TIMESTAMPTZ
);
```

## Related Documentation

- [Blog Validator](../../supabase/functions/_shared/blog-validator.ts)
- [Blog Prompts](../../supabase/functions/_shared/blog-prompts.ts)
- [Reference Summarizer](../../supabase/functions/_shared/reference-summarizer.ts)
