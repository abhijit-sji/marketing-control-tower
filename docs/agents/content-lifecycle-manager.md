# Content Lifecycle Manager

> **Last Updated:** 2026-01-15  
> **Status:** ✅ Active  
> **Slug:** `content-lifecycle`

## Overview

The Content Lifecycle Manager is a visibility and prioritization agent that monitors the content production pipeline from research to publication. It identifies stuck content, failed generations, unused trends, and keyword coverage gaps.

## Key Features

- **Status Normalization**: Maps various statuses to unified pipeline stages
- **SLA Tracking**: Monitors Research→Draft (2d), Draft→Review (3d), Review→Publish (2d)
- **Bottleneck Detection**: Tags content with specific blocker reasons
- **Retry Intelligence**: Identifies safe-to-retry vs. needs-manual-fix failures
- **Trend Utilization**: Calculates (trends_used / total_trends) × 100
- **Keyword Coverage**: Heatmap of covered, weak, and uncovered keywords

## Scope

- **Type**: Global
- **Required Role**: Manager or Super Admin
- **Access**: Admin Panel → AI Control → Content Lifecycle Manager

## Pipeline Stages

The agent normalizes statuses from different tools into 5 stages:

| Stage | Mapped Statuses |
|-------|-----------------|
| **Research** | idea, trend_found, researching, pending |
| **Draft** | draft, Draft, generated, draft_saved, generating |
| **Review** | pending_review, needs_edits, ready, Ready, in_review |
| **Published** | live, indexed, published, completed, used, Used |
| **Failed** | failed, error |

## Data Sources

| Source | Table | Purpose |
|--------|-------|---------|
| SEO Blogs | `seo_blog_content` | Blog generation status |
| Trends | `weekly_trends` | Topic research pipeline |
| Keywords | `keyword_research` | Keyword tracking |
| Keyword Usage | `keyword_blog_usage` | Content-keyword associations |
| Brands | `brands` | Brand context |
| Leaders | `thought_leaders` | Content owner info |

## Edge Function

**File**: `supabase/functions/content-lifecycle-agent/index.ts`

### Request Schema

```typescript
interface ContentLifecycleRequest {
  brand_id?: string;
  scope?: 'all' | 'brand';
  include?: {
    seo_blogs?: boolean;
    trends?: boolean;
    keywords?: boolean;
    velocity?: boolean;
  };
  refinement_prompt?: string;
}
```

### Response Schema

```typescript
interface ContentLifecycleResponse {
  success: boolean;
  run_id: string;
  analysis: {
    weekly_summary: string;
    pipeline_summary: PipelineSummary;
    stuck_content: StuckItem[];
    trend_utilization: TrendMetrics;
    keyword_coverage: KeywordCoverage;
    sla_status: SLAMetrics;
    velocity: VelocityMetrics;
    priority_actions: string[];
  };
  raw_metrics: ContentMetrics;
  meta: {
    generation_time_ms: number;
    tokens_used: number;
  };
}
```

## Bottleneck Reasons

| Reason | Trigger | Priority |
|--------|---------|----------|
| `awaiting_review` | Draft > 7 days | High |
| `sla_breach` | Exceeded stage SLA | High |
| `missing_keywords` | No keyword assigned | Medium |
| `no_owner` | No leader/brand assigned | Medium |
| `failed_generation` | Multiple failures | High |
| `timeout_error` | Generation timeout | Medium (retry-safe) |
| `api_error` | API rate limit/error | Medium (retry-safe) |
| `validation_error` | Content validation failed | Low (needs fix) |

## SLA Thresholds

```typescript
const SLA_THRESHOLDS = {
  research_to_draft: 2,   // days
  draft_to_review: 3,     // days
  review_to_publish: 2,   // days
};
```

## Output Format

### Weekly Summary
```
"This Week's Content Health: 42 items in Draft (18 breaching SLA), 
11 unused high-impact trends, SEO gaps detected for 9 priority keywords. 
Content velocity ↓ 12% vs last week."
```

### Pipeline Summary
```json
{
  "research": 15,
  "draft": 42,
  "review": 8,
  "published": 156,
  "failed": 3,
  "conversion_rates": {
    "research_to_draft": 0.78,
    "draft_to_review": 0.45,
    "review_to_publish": 0.92
  },
  "biggest_bottleneck": "draft"
}
```

### Stuck Content Item
```json
{
  "id": "uuid",
  "title": "10 AI Marketing Strategies",
  "brand_name": "PlatePresence",
  "stage": "draft",
  "days_stuck": 12,
  "bottleneck_tags": [
    { "reason": "awaiting_review", "label": "Awaiting Review", "priority": "high" },
    { "reason": "sla_breach", "label": "SLA Breached", "priority": "high" }
  ],
  "retry_info": {
    "reason": "timeout_error",
    "retry_safe": true,
    "action": "Auto-retry recommended"
  }
}
```

### Trend Utilization
```json
{
  "total": 45,
  "used": 28,
  "utilization_score": 62,
  "unused_high_impact": [
    { "id": "uuid", "topic_title": "AI in B2B Sales", "days_old": 5 }
  ]
}
```

### Keyword Coverage
```json
{
  "tracked": 50,
  "coverage": {
    "covered": 32,    // 🟢 Has published content
    "weak": 10,       // 🟡 Mentioned but no dedicated content
    "not_covered": 8  // 🔴 No content at all
  },
  "high_volume_gaps": [
    { "keyword": "ai marketing automation", "search_volume": 5400, "coverage_state": "not_covered" }
  ]
}
```

### Velocity Metrics
```json
{
  "this_week": 12,
  "last_week": 14,
  "trend": "decreasing",
  "change_pct": -14.3,
  "avg_days_to_publish": 8.5
}
```

## UI Components

- **Panel**: `src/components/agents/ContentLifecyclePanel.tsx`
- **Failed Content View**: Scrollable list with retry buttons
- **Stuck Content View**: Bottleneck tags and SLA indicators

## AI Provider

- **Model**: gpt-4o
- **Temperature**: 0.3 (factual, consistent)
- **Function Calling**: Structured output for all metrics

## Best Practices

1. **Run Weekly**: Schedule for Monday morning visibility
2. **Prioritize SLA Breaches**: Address high-priority bottlenecks first
3. **Retry Timeouts**: Auto-retry timeout errors, investigate validation errors
4. **Trend Utilization**: Aim for 70%+ utilization score
5. **Keyword Gaps**: Create content for high-volume uncovered keywords

## Configuration

```sql
SELECT * FROM ai_agents WHERE slug = 'content-lifecycle';
```

Key config fields:
- `data_sources`: `["seo_blog_content", "weekly_trends", "keyword_research"]`
- `category`: `content_management`

## Related Documentation

- [SEO Blog Generator](./seo-blog-generator.md)
- [LinkedIn Content Generator](./linkedin-content-generator.md)
- [Keyword Research System](../../.agent/Tasks/pending/keyword-research-plan.md)
