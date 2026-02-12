# LinkedIn Content Generator

> **Last Updated:** 2026-01-15  
> **Status:** ✅ Active  
> **Slug:** `linkedin-content-gen`

## Overview

The LinkedIn Content Generator is a dual-model AI pipeline that creates thought leadership content for LinkedIn. It uses a two-stage process: research with Gemini and writing with Claude, producing high-quality, grounded posts.

## Key Features

- **Dual-Model Pipeline**: Stage 1 (Research) + Stage 2 (Writing)
- **Web Grounding**: Uses Gemini with web search for current research
- **Style Consistency**: Claude writes in the leader's authentic voice
- **Multiple Source Types**: Trends, influencer content, or custom topics
- **Carousel Support**: Generates carousel outlines for visual content
- **Caption Ideas**: Multiple hook variations for A/B testing

## Scope

- **Type**: Brand
- **Required Role**: Content Creator, PM, Manager, or Super Admin
- **Access**: Content → LinkedIn or Brand Page → AI Solutions

## Architecture

### Dual-Model Pipeline

```
┌─────────────────────────────────────────────────┐
│              STAGE 1: RESEARCH                  │
│  Model: Gemini 2.5 Pro/Flash with web grounding │
│  Output: Research brief with sources            │
└─────────────────────┬───────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│              STAGE 2: WRITING                   │
│  Model: Claude 4.5 (with GPT-5 fallback)        │
│  Output: LinkedIn post + carousel + captions    │
└─────────────────────────────────────────────────┘
```

### Fallback Chain

1. **Research**: Gemini 2.5 → Skip research if unavailable
2. **Writing**: Claude → GPT-5 (OpenAI) if Claude unavailable

## Data Sources

| Source | Table | Purpose |
|--------|-------|---------|
| Thought Leaders | `thought_leaders` | Leader profiles, tone, audience |
| Weekly Trends | `weekly_trends` | Perplexity-sourced topic ideas |
| Leader Uploads | `leader_uploads` | Reference documents and articles |
| Generated Posts | `generated_posts` | Post storage and history |
| Perplexity Settings | `perplexity_settings` | User's research preferences |

## Edge Function

**File**: `supabase/functions/linkedin-content/index.ts`

### Endpoints

| Method | Path | Action |
|--------|------|--------|
| GET | `/leaders` | List all thought leaders |
| POST | `/leaders` | Create new leader |
| GET | `/leaders/:id` | Get leader details |
| PUT | `/leaders/:id` | Update leader |
| DELETE | `/leaders/:id` | Delete leader |
| GET | `/leaders/:id/trends` | Get leader's weekly trends |
| POST | `/leaders/:id/trends` | Refresh trends from Perplexity |
| POST | `/leaders/:id/posts` | Generate new post |
| GET | `/leaders/:id/posts` | Get leader's posts |

### Generate Post Request

```typescript
interface GeneratePostPayload {
  sourceType: 'trend' | 'influencer' | 'custom';
  sourceId?: string;  // For trend or influencer
  customContent?: string;  // For custom
  headlineIdea?: string;
  callToAction?: string;
  selectedAgents?: string[];  // Additional AI agents to consult
}
```

### Response Schema

```typescript
interface GeneratedPost {
  id: string;
  post_title: string;
  post_body: string;
  extra_payload: {
    carousel_outline?: string[];
    caption_ideas?: string[];
    post_type?: string;
    research_brief?: ResearchBrief;
    models_used: {
      research: string;
      writing: string;
    };
    pipeline_config: AIPipelineConfig;
  };
}
```

## Research Brief Structure

```typescript
interface ResearchBrief {
  topic_context: string;
  key_insights: string[];
  recent_developments: string[];
  expert_perspectives: string[];
  data_points: string[];
  sources_summary: string;
}
```

## Leader Profile

```typescript
interface ThoughtLeader {
  id: string;
  name: string;
  title: string;
  department: string | null;
  linkedin_url: string | null;
  target_audience: Record<string, unknown>;
  persona_tone: string;  // e.g., "Professional yet approachable"
  default_prompt: string;
  guide_text: string | null;
  niche_keyword: string;  // e.g., "AI in Marketing"
  niche_domain: string;   // e.g., "B2B SaaS"
  content_phase: string;  // "phase_1" | "phase_2" | "phase_3"
}
```

## Content Engine Guidelines

The LinkedIn content strategy follows a 3-phase growth sequence:

### Phase 1: Teach (Months 1-2)
- Pure value, no product mentions
- Build trust through expertise

### Phase 2: Own One Problem (Months 3-4)
- Establish authority on specific pain point
- Subtle positioning

### Phase 3: Contextual Mentions (Months 5+)
- Product references in context
- Case studies and results

### Weekly Rhythm
- 2 Teaching posts
- 1 Opinion/contrarian post
- 1 How-to/tactical post

### Writing Rules
- Simple English (8th grade level)
- No emojis in body
- No hashtags in body (only at end)
- No hype words ("game-changing", "revolutionary")
- Hook in first line

## UI Components

- **Leader Page**: `src/pages/content/LinkedInLeaderDetailPage.tsx`
- **Generator Sheet**: `src/components/linkedin/GeneratePostSheet.tsx`
- **Trends List**: `src/components/linkedin/EnhancedTrendsList.tsx`
- **Post Editor**: `src/components/linkedin/LinkedInPostEditor.tsx`

## Perplexity Integration

Weekly trends are fetched from Perplexity AI:

```typescript
// Trend search prompt
`Find the top 5 trending LinkedIn topics this week for {audience}. 
Explain why each topic resonates with the audience and how {leader_name} could add insight.`
```

Trends are stored in `weekly_trends` with:
- `topic_title`: Trend headline
- `topic_summary`: JSON research brief or plain text
- `status`: 'draft' | 'ready' | 'used'
- `idea_source`: 'perplexity' | 'personal' | 'marketing'

## Best Practices

1. **Complete Leader Profile**: Fill in niche_keyword, niche_domain, and content_phase
2. **Quality Sources**: Use relevant trends or upload quality reference materials
3. **Review Research**: Check research brief before finalizing post
4. **Edit Voice**: Refine AI output to match authentic leader voice
5. **Track Performance**: Monitor which post types resonate with audience

## Configuration

```sql
SELECT * FROM ai_agents WHERE slug = 'linkedin-content-gen';
```

Leader-level configuration in `thought_leaders`:
- `ai_pipeline_config`: Custom pipeline settings per leader
- `niche_keyword`: Primary expertise area
- `content_phase`: Current growth phase

## Related Documentation

- [Dual Model Pipeline](../../supabase/functions/linkedin-content/_helpers/)
- [Content Engine Guidelines](../../.agent/System/features/linkedin-content-engine.md)
- [Perplexity Integration](../../.agent/System/integration_points.md)
