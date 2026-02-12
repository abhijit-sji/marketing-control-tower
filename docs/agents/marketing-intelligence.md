# Marketing Intelligence Agent (`marketing-intelligence`)

> **Status:** ✅ Proposed & Implemented  
> **Category:** Analytics  
> **Scope:** Global

## Purpose

The Marketing Intelligence agent is a cross-platform analytics assistant that **connects content creation to business outcomes**.  
It analyzes hooks, audiences, topics, and KPIs across LinkedIn, SEO blogs, and website analytics to answer:

- What content should we create next?
- For which audience?
- Which formats and hooks actually move KPIs?

## Data Sources

- `content_performance_metrics` – Post performance (engagement, impressions, reach, hook_style, audience)
- `brand_analytics_data` – Website/GA metrics (sessions, users, conversions, etc.)
- `brand_kpis` – Current vs target KPI values
- `generated_posts` – AI-generated LinkedIn posts and metadata
- `weekly_trends` – Researched topics and trends
- `thought_leaders` – Leader profiles, audiences, personas
- `seo_blog_content` – SEO blogs, keywords, and status

## Edge Function

- **File:** `supabase/functions/marketing-intelligence-agent/index.ts`  
- **Auth:** Requires authenticated user; results stored in `ai_agent_runs`

### Request Schema

```ts
interface MarketingIntelligenceRequest {
  brand_id?: string;
  leader_id?: string;
  timeframe?: "last_7_days" | "last_30_days" | "last_quarter" | "all";
  analysis_type?: "full" | "hooks" | "audiences" | "attribution" | "topics";
  refinement_prompt?: string;
}
```

### Response Schema (simplified)

```ts
interface MarketingIntelligenceResponse {
  success: boolean;
  run_id: string | null;
  analysis: {
    executive_summary: string;
    hook_analysis: HookPerformance[];
    audience_insights: AudienceResonance[];
    kpi_attribution: KPIAttributionBreakdown[];
    topic_clusters: TopicCluster[];
    leader_effectiveness?: LeaderRanking[];
    action_items: ActionItem[];
    data_quality_score: number;  // 0-100
    confidence: "High" | "Medium" | "Low";
  };
  raw_metrics: {
    posts_analyzed: number;
    analytics_rows: number;
    kpis_tracked: number;
    trends_reviewed: number;
  };
  meta: {
    generation_time_ms: number;
    tokens_used: number | null;
    timeframe: string;
  };
}
```

## UI

- **Main panel:** `src/components/agents/MarketingIntelligencePanel.tsx`
- **Charts / views:**
  - `HookPerformanceChart.tsx` – Bar chart of hook styles
  - `AudienceHeatmap.tsx` – Audience × content type grid
  - `KPIAttributionCard.tsx` – KPI contribution breakdown
  - `TopicClusterView.tsx` – Topic performance clusters

The panel is available from:

- **Admin panel:** `Admin Panel → AI Control → Marketing Intelligence`
- **My Agents:** via `ai_agents` registry (`marketing-intelligence` slug)

