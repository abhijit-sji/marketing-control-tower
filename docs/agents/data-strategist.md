# Data Strategist Agent

> **Last Updated:** 2026-01-15  
> **Status:** ✅ Active  
> **Slug:** `data-strategist`

## Overview

The Data Strategist agent analyzes ALL available brand data to provide comprehensive, actionable business insights. It calculates KPI gaps, identifies performance trends, and generates data-driven recommendations with visualizations.

## Key Features

- **KPI Gap Analysis**: Calculates (target - current) / target × 100 for each KPI
- **Chart Generation**: Creates bar and line charts from real data
- **Executive Summary**: 3 specific bullets with actual numbers
- **Action Items**: 3 actionable recommendations with effort/owner assignments
- **Data Quality Tracking**: Notes missing data that would improve analysis
- **Trend Analysis**: Compares with previous agent runs for historical context

## Scope

- **Type**: Global
- **Required Role**: Manager or Super Admin
- **Access**: Admin Panel → AI Control → Data Strategist

## Data Sources

| Source | Table | Purpose |
|--------|-------|---------|
| Brands | `brands` | Brand info, status, budget |
| KPIs | `brand_kpis` | Current vs target values |
| Analytics | `brand_analytics_data` | Website/marketing metrics |
| Knowledge Files | `brand_knowledge_files` | Knowledge base completeness |
| Generated Posts | `brand_generated_posts` | Content generation activity |
| Thought Leaders | `thought_leaders` | People associated with brands |
| Projects | `projects` | Active projects and budgets |
| Previous Runs | `ai_agent_runs` | Historical comparison |

## Edge Function

**File**: `supabase/functions/data-strategist-agent/index.ts`

### Request Schema

```typescript
interface DataStrategistRequest {
  timeframe?: 'last_7_days' | 'last_30_days' | 'last_quarter' | 'last_year';
  start_date?: string;
  end_date?: string;
  brand_ids?: string[];  // Filter to specific brands
  refinement_prompt?: string;
}
```

### Response Schema

```typescript
interface DataStrategistResponse {
  success: boolean;
  run_id: string;
  analysis: {
    charts: ChartConfig[];
    summary: string[];  // Exactly 3 bullets
    actions: ActionItem[];  // Exactly 3 items
    reproduce: string;  // SQL query to reproduce key finding
    data_warnings: string[];
    confidence: 'High' | 'Medium' | 'Low';
    performance_score?: number;  // 0-100
    kpi_analysis?: KPIAnalysis[];
  };
  meta: {
    generation_time_ms: number;
    tokens_used: number;
    brands_analyzed: number;
    kpis_analyzed: number;
  };
}
```

## Workflow

1. **Calculate Date Range**:
   - Parse timeframe or use start/end dates
   - Default: last 30 days

2. **Fetch All Data Sources** (parallel):
   - Brands (active only)
   - KPIs with gap analysis
   - Analytics data within range
   - Knowledge files count
   - Generated posts count
   - Thought leaders
   - Previous agent runs

3. **Calculate KPI Metrics**:
   ```javascript
   {
     name: "Website Traffic",
     current: 45000,
     target: 60000,
     gap_percent: 25,
     progress_percent: 75,
     status: "at_risk"  // <80% = at_risk, <50% = critical
   }
   ```

4. **Generate Report** via OpenAI function calling

5. **Store Results** in `ai_agent_runs`

## Output Format

### Chart Configuration
```json
{
  "type": "bar",
  "title": "KPI Progress vs Target",
  "data": [
    { "label": "Website Traffic", "value": 45000, "target": 60000 },
    { "label": "Lead Generation", "value": 120, "target": 150 }
  ],
  "caption": "3 of 5 KPIs are on track (>80% of target)"
}
```

### Action Item
```json
{
  "action": "Increase LinkedIn posting frequency from 2x to 4x weekly to close 25% traffic gap",
  "owner": "Content Manager",
  "effort": "low",
  "confidence": 0.85
}
```

### KPI Analysis
```json
{
  "name": "Website Traffic",
  "current": 45000,
  "target": 60000,
  "gap_percent": 25,
  "trend": "up"
}
```

## UI Components

- **Inline Panel**: `src/components/agents/DataStrategistInlinePanel.tsx`
- **Dialog**: `src/components/agents/DataStrategistDialog.tsx`

## AI Provider

- **Model**: gpt-4o
- **Temperature**: 0.3 (factual, consistent)
- **Function Calling**: `generate_data_strategist_report`

## Analysis Requirements

The agent is instructed to:

1. **Calculate KPI Gaps**: Always include gap percentages
2. **Status Classification**:
   - On Track: ≥80% of target
   - At Risk: 50-79% of target
   - Critical: <50% of target
3. **Content Activity**: Check if posts are being created
4. **Knowledge Completeness**: Does brand have enough context?
5. **Analytics Trends**: Review available metrics

## Best Practices

1. **Connect All Data**: Enable Google Analytics and set KPI targets
2. **Regular Analysis**: Run weekly for trend detection
3. **Act on Actions**: Assign action items to team members
4. **Track Progress**: Compare performance scores over time

## Configuration

```sql
SELECT * FROM ai_agents WHERE slug = 'data-strategist';
```

Key config fields:
- `category`: `business_analysis`
- `data_sources`: `["brands", "brand_kpis", "brand_analytics_data", "projects"]`

## Related Documentation

- [Brand KPIs Table](../../.agent/System/database_schema.md)
- [Analytics Integration](../../.agent/System/integration_points.md)
- [AI Agent System](../../.agent/System/ai_agent_system.md)
