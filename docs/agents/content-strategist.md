# Content Strategist Agent

> **Last Updated:** 2026-01-15  
> **Status:** ✅ Active  
> **Slug:** `content-strategist`

## Overview

The Content Strategist agent analyzes content from thought leaders, brand knowledge files, performance metrics, analytics, and KPIs to create compelling, data-driven content strategies. It generates hooks, repurposing assets, and content calendar recommendations.

## Key Features

- **Hook Generation**: Creates 10 hook ideas per content source
- **Asset Repurposing**: Generates 3 full repurpose packages (30-sec scripts, newsletter subjects, LinkedIn posts)
- **Calendar Planning**: Suggests publish dates, channels, and CTAs for a 7-day window
- **Brand-Level Strategy**: Generates strategies from analytics/KPIs when no content sources exist
- **Multi-Source Analysis**: Processes leader uploads, brand knowledge files, and trends

## Scope

- **Type**: Brand
- **Required Role**: Content Creator, Manager, or Super Admin
- **Access**: Brand Page → AI Solutions → Content Strategist

## Data Sources

| Source | Table | Purpose |
|--------|-------|---------|
| Leader Uploads | `leader_uploads` | Thought leader content files |
| Brand Knowledge | `brand_knowledge_files` | Brand documentation and context |
| Analytics | `brand_analytics_data` | Google Analytics metrics |
| KPIs | `brand_kpis` | Brand performance targets |
| Brand Info | `brands` | Brand description, website, budget |
| Embeddings | `brand_knowledge_embeddings` | Semantic search for relevant context |

## Edge Function

**File**: `supabase/functions/content-strategist-agent/index.ts`

### Request Schema

```typescript
interface ContentStrategistRequest {
  brand_id?: string;
  brand_ids?: string[];
  content_ids?: string[];
  leader_id?: string;
  content_type?: string;
  limit?: number;  // Default: 5
  refinement_prompt?: string;
}
```

### Response Schema

```typescript
interface ContentStrategistResponse {
  success: boolean;
  message?: string;
  content_outputs: ContentOutput[];
  brand_level_strategy?: BrandStrategy;
  meta: {
    generation_time_ms: number;
    tokens_used: number;
    model_used: string;
  };
  data_sources_used: {
    knowledge_base: boolean;
    analytics: boolean;
    kpis: boolean;
    leader_uploads: boolean;
    performance_metrics: boolean;
    brand_info: boolean;
  };
}
```

## Workflow

### Content Source Analysis

1. **Collect Brand Context**:
   - Fetch brand knowledge embeddings (semantic search)
   - Fetch analytics data (last 30 days)
   - Fetch brand KPIs with progress percentages
   - Fetch brand info (name, description, budget)

2. **Gather Content Sources**:
   - Leader uploads (file summaries)
   - Brand knowledge files (indexed content)

3. **Generate Strategy**:
   - For each content source: 10 hooks, 3 top assets, calendar entry
   - If no content sources: Brand-level strategy from analytics

### Output Per Content Source

```json
{
  "content_id": "uuid",
  "content_title": "Q1 Marketing Report",
  "hooks": [
    {
      "text": "Here's what nobody tells you about Q1 results...",
      "performance_reason": "Curiosity gap + contrarian angle resonates with CMOs"
    }
  ],
  "top_3": [
    {
      "hook": "Hook text",
      "angle": "Data-driven insight angle",
      "script_30sec": "Full 30-second video script",
      "newsletter_subject": "Subject line",
      "newsletter_preview": "Preview text (2 lines)",
      "linkedin_post": "Full LinkedIn post",
      "hashtags": ["#MarketingStrategy", "#B2B", "#CMO"]
    }
  ],
  "calendar": {
    "content_id": "uuid",
    "suggested_date": "2026-01-20",
    "channel": "LinkedIn",
    "cta": "Download our full Q1 report"
  }
}
```

### Brand-Level Strategy (No Content Sources)

When analytics/KPIs exist but no content sources:

```json
{
  "strategy_overview": "High-level content strategy summary",
  "content_ideas": [
    {
      "title": "Idea title",
      "angle": "Unique angle",
      "channel": "Recommended channel",
      "priority": "high|medium|low"
    }
  ],
  "repurposing_angles": [
    "Turn analytics insights into carousel posts",
    "Create video series from KPI progress"
  ],
  "seven_day_calendar": [
    { "day": "Monday", "content_type": "Teaching post", "topic": "..." }
  ]
}
```

## UI Components

- **Inline Panel**: `src/components/agents/ContentStrategistInlinePanel.tsx`
- **Dialog**: `src/components/agents/ContentStrategistDialog.tsx`

## AI Provider

- **Primary**: Lovable AI Gateway (gpt-4o)
- **Fallback**: OpenAI direct (gpt-4o)
- **Temperature**: 0.7 (creative output)
- **Max Tokens**: 4096

## Content Angles

The agent ensures diversity across three content angles:

1. **Story**: Personal narratives, case studies, journey posts
2. **Data**: Statistics, research findings, benchmark insights
3. **How-to**: Actionable guides, step-by-step tutorials

## Best Practices

1. **Provide Rich Content**: Upload quality source materials for better hooks
2. **Connect Analytics**: Ensure Google Analytics is connected for data-driven strategies
3. **Set KPI Targets**: Configure brand KPIs for goal-aligned recommendations
4. **Filter by Leader**: Use `leader_id` param to focus on specific thought leader content

## Configuration

```sql
SELECT * FROM ai_agents WHERE slug = 'content-strategist';
```

Key config fields:
- `data_sources`: `["brand_knowledge", "brand_analytics", "brand_kpis", "leader_uploads"]`
- `config.temperature`: 0.7
- `config.max_tokens`: 4096

## Related Documentation

- [Brand Knowledge System](../../.agent/System/features/knowledge-base-system.md)
- [LinkedIn Content Generator](./linkedin-content-generator.md)
- [AI Agent System](../../.agent/System/ai_agent_system.md)
