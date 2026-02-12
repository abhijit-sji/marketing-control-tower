# Brand Performance Optimization

> **Last Updated:** 2026-01-15  
> **Status:** ✅ Active  
> **Slug:** `brand-performance-optimization`

## Overview

The Brand Performance Optimization agent provides comprehensive analysis of brand performance using knowledge base, analytics, and KPIs. It generates detailed reports with key findings, recommendations, action items, and identifies opportunities and risks.

## Key Features

- **Comprehensive Analysis**: 4-5 paragraph summary with detailed sections
- **Key Findings**: 6-8 specific findings from brand data
- **Actionable Recommendations**: 5-7 recommendations with implementation steps
- **Action Items**: Each with 3-5 specific steps, priority, and owner suggestions
- **Opportunities & Risks**: Dedicated sections for growth and risk analysis
- **Data Source Tracking**: Shows exactly which data informed the analysis

## Scope

- **Type**: Brand
- **Required Role**: Manager or Super Admin
- **Access**: Brand Page → AI Solutions → Brand Performance Optimization

## Data Sources

| Source | Table | Purpose |
|--------|-------|---------|
| Brand Info | `brands` | Name, description, website, budget, integrations |
| Knowledge Base | `brand_knowledge_embeddings` | Semantic search for relevant context |
| Analytics | `brand_analytics_data` | Google Analytics metrics by type |
| KPIs | `brand_kpis` | Current values, targets, progress % |
| Previous Runs | `ai_agent_runs` | Historical comparison |

## Edge Function

**File**: `supabase/functions/run-ai-agent/index.ts` (routed via main agent runner)

### Request Schema

```typescript
interface BrandPerformanceRequest {
  agent_id: string;
  execution_context: {
    brandId: string;
    brandName: string;
    prompt?: string;         // Custom analysis focus
    user_id: string;
    metadata?: any;
  };
}
```

### Response Schema

```typescript
interface BrandPerformanceResponse {
  success: boolean;
  run_id: string;
  result: {
    summary: string;          // 4-5 paragraphs
    key_findings: KeyFinding[];
    recommendations: Recommendation[];
    action_items: ActionItem[];
    opportunities: Opportunity[];
    risks: Risk[];
    metrics: MetricsSummary;
  };
  meta: {
    provider: string;
    model: string;
    response_time_ms: number;
    tokens_used: number;
    confidence_score: number;
  };
  data_sources_used: {
    knowledge_base: boolean;
    analytics: boolean;
    kpis: boolean;
    brand_info: boolean;
    knowledge_snippets?: number;
    knowledge_files?: number;
    knowledge_chars?: number;
  };
}
```

## Data Collection

### Brand Knowledge Context

```typescript
async function collectBrandKnowledgeContext(
  client: any, 
  brandId: string, 
  queryText: string
): Promise<BrandKnowledgeResult> {
  // 1. Try semantic search via pgvector
  const snippets = await searchBrandEmbeddings(client, queryText, [brandId], 10, 0.5);
  
  // 2. Fallback: Direct chunks from embeddings table
  if (snippets.length === 0) {
    const { data: chunks } = await client
      .from('brand_knowledge_embeddings')
      .select('chunk_text')
      .eq('brand_id', brandId)
      .limit(15);
  }
  
  // 3. Fallback: File summaries
  if (no chunks) {
    const { data: files } = await client
      .from('brand_knowledge_files')
      .select('file_name, file_summary')
      .eq('brand_id', brandId);
  }
}
```

### Analytics Context

```typescript
// Groups analytics by data_type with metric summaries
const sections = grouped.entries().map(([type, records]) => ({
  type: type.toUpperCase(),
  data: records.map(d => `${d.date_range_start} to ${d.date_range_end}: ${metricStr}`)
}));
```

### KPIs Context

```typescript
// Includes progress percentage and target comparison
const kpiLines = kpis.map(k => {
  const progress = k.target_value ? (k.current_value / k.target_value * 100) : null;
  return `${k.name}: $${k.current_value} → Target: $${k.target_value} (${progress}%)`;
});
```

## Output Format

### Key Finding
```json
{
  "type": "opportunity",
  "priority": "high",
  "confidence": 0.85,
  "description": "Website traffic from organic search grew 23% while paid traffic declined 8%"
}
```

### Recommendation
```json
{
  "title": "Shift Budget to SEO",
  "description": "Reallocate 15% of paid ad budget to content marketing based on organic growth trend",
  "priority": "high",
  "expected_impact": "Estimated 20% reduction in CAC over 6 months",
  "implementation_steps": [
    "Audit current keyword rankings",
    "Identify 10 high-intent keywords to target",
    "Create content calendar for next quarter",
    "Set up rank tracking dashboard"
  ]
}
```

### Action Item
```json
{
  "type": "task",
  "description": "Audit current SEO keyword rankings and identify gaps",
  "priority": "high",
  "assignee": "Content Manager",
  "due_date": "2026-01-22",
  "confidence": 0.9,
  "steps": [
    "Export current rankings from SEMrush",
    "Map keywords to content pillars",
    "Identify top 20 opportunity keywords",
    "Create content briefs for top 5",
    "Schedule with content team"
  ]
}
```

## UI Components

- **Full Page**: `src/pages/brands/[slug]/brand-performance-optimization.tsx`
- **Metadata Cards**: Provider, model, response time, confidence
- **Data Coverage**: Shows which sources were used with counts
- **Save to Insights**: Persists analysis to brand knowledge base

### Full-Page Layout

Unlike other agents that use modals, Brand Performance Optimization uses a full-page layout because:
- Reports are comprehensive (4-5 paragraphs + multiple sections)
- Need space for metadata and data source visualization
- Save to Insights workflow benefits from more screen real estate

## AI Provider

- **Model**: gpt-4o (or configured model)
- **Max Tokens**: 8192 (for detailed output)
- **Response Format**: JSON object via response_format
- **Temperature**: 0.3 (consistent, factual)

## System Prompt

```
CRITICAL INSTRUCTION: Base ALL analysis on the actual BRAND DATA provided below.
Do NOT use hypothetical values. Reference specific metrics and knowledge.

BRAND DATA FOR ANALYSIS:
[Brand Info]
[Analytics Data]
[KPIs]
[Knowledge Context]

Generate a comprehensive JSON report with:
- summary: 4-5 paragraph executive summary
- key_findings: 6-8 specific findings with data references
- recommendations: 5-7 actionable recommendations
- action_items: Each with 3-5 implementation steps
- opportunities: Growth opportunities identified
- risks: Risks and concerns identified
- metrics: Summary of key metrics analyzed
```

## Predefined Prompts

The UI offers one-click prompt options:

| Prompt | Focus |
|--------|-------|
| Full Performance Analysis | Comprehensive review of all brand data |
| Identify Anomalies | Focus on unusual patterns or deviations |
| Content Strategy Review | Analyze content performance and gaps |
| KPI Gap Analysis | Deep dive on KPI progress vs targets |
| Competitive Positioning | Analyze market position and opportunities |

## Best Practices

1. **Ensure Data Exists**: Connect analytics and set KPI targets before running
2. **Upload Knowledge**: Rich knowledge base improves analysis quality
3. **Custom Prompts**: Use specific prompts for focused analysis
4. **Save Important Runs**: Use "Save to Brand Insights" for valuable analyses
5. **Track Confidence**: Lower confidence may indicate data gaps

## Configuration

```sql
SELECT * FROM ai_agents WHERE slug = 'brand-performance-optimization';
```

Key config fields:
- `scope`: `brand`
- `config.max_tokens`: 8192
- `data_sources`: `["brand_knowledge", "brand_analytics", "brand_kpis"]`

## Related Documentation

- [Run AI Agent Function](../../supabase/functions/run-ai-agent/index.ts)
- [Brand Knowledge System](../../.agent/System/features/knowledge-base-system.md)
- [Analytics Integration](../../.agent/System/integration_points.md)
