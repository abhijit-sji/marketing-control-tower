// Content Lifecycle Manager Agent
// Monitors content production pipeline from research to publication
// Identifies stuck content, failed generations, unused trends, and keyword gaps

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

// ========== STATUS NORMALIZATION ==========
// Maps various statuses from different tools to unified pipeline stages
const STATUS_MAP: Record<string, string> = {
  // Research stage
  'idea': 'research',
  'trend_found': 'research',
  'researching': 'research',
  'pending': 'research',
  
  // Draft stage
  'draft': 'draft',
  'Draft': 'draft',
  'generated': 'draft',
  'draft_saved': 'draft',
  'generating': 'draft',
  
  // Review stage
  'pending_review': 'review',
  'needs_edits': 'review',
  'ready': 'review',
  'Ready': 'review',
  'in_review': 'review',
  
  // Published stage
  'live': 'published',
  'indexed': 'published',
  'published': 'published',
  'completed': 'published',
  'used': 'published',
  'Used': 'published',
  
  // Failed stage
  'failed': 'failed',
  'error': 'failed',
};

// ========== SLA DEFINITIONS (in days) ==========
const SLA_THRESHOLDS = {
  research_to_draft: 2,
  draft_to_review: 3,
  review_to_publish: 2,
};

// ========== BOTTLENECK REASON TAGS ==========
type BottleneckReason = 
  | 'awaiting_review'
  | 'low_confidence_content'
  | 'missing_keywords'
  | 'failed_generation'
  | 'no_owner'
  | 'sla_breach'
  | 'timeout_error'
  | 'api_error'
  | 'validation_error';

interface BottleneckTag {
  reason: BottleneckReason;
  label: string;
  priority: 'high' | 'medium' | 'low';
}

function normalizeStatus(status: string | null): string {
  if (!status) return 'unknown';
  return STATUS_MAP[status] || 'unknown';
}

function calculateDaysInStage(date: string): number {
  const created = new Date(date);
  return Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
}

function detectBottleneckReasons(item: any, daysStuck: number): BottleneckTag[] {
  const reasons: BottleneckTag[] = [];
  
  // Draft > 7 days → awaiting_review
  if (daysStuck > 7) {
    reasons.push({ reason: 'awaiting_review', label: 'Awaiting Review', priority: 'high' });
  }
  
  // SLA breach
  if (daysStuck > SLA_THRESHOLDS.draft_to_review) {
    reasons.push({ reason: 'sla_breach', label: 'SLA Breached', priority: 'high' });
  }
  
  // No keyword assigned
  if (!item.primary_keyword && !item.keyword) {
    reasons.push({ reason: 'missing_keywords', label: 'Missing Keywords', priority: 'medium' });
  }
  
  // No owner/leader assigned
  if (!item.leader_id && !item.brand_id) {
    reasons.push({ reason: 'no_owner', label: 'No Owner', priority: 'medium' });
  }
  
  return reasons;
}

function detectFailureReason(item: any): { reason: BottleneckReason; retry_safe: boolean; action: string } {
  const errorMsg = (
    (item.error_message || item.error || '') + 
    ' ' + 
    (Array.isArray(item.validation_errors) ? item.validation_errors.join(' ') : '')
  ).toLowerCase();
  
  if (errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
    return { reason: 'timeout_error', retry_safe: true, action: 'Auto-retry recommended' };
  }
  if (errorMsg.includes('api') || errorMsg.includes('rate limit') || errorMsg.includes('429')) {
    return { reason: 'api_error', retry_safe: true, action: 'Wait and retry' };
  }
  if (errorMsg.includes('validation') || errorMsg.includes('invalid')) {
    return { reason: 'validation_error', retry_safe: false, action: 'Needs prompt/input fix' };
  }
  
  return { reason: 'failed_generation', retry_safe: false, action: 'Manual investigation needed' };
}

interface NormalizedPipeline {
  research: number;
  draft: number;
  review: number;
  published: number;
  failed: number;
  unknown: number;
}

interface SLAMetrics {
  breaching_count: number;
  avg_delay_days: number;
  brand_health: Record<string, { breaches: number; total: number; health_pct: number }>;
}

interface ContentMetrics {
  seo: {
    total: number;
    failed: number;
    generating: number;
    completed: number;
    failed_items: Array<{
      id: string;
      title: string;
      brand_id: string;
      brand_name: string;
      created_at: string;
      failure_reason: { reason: BottleneckReason; retry_safe: boolean; action: string };
    }>;
  };
  trends: {
    total: number;
    draft: number;
    ready: number;
    used: number;
    utilization_score: number;
    draft_items: Array<{
      id: string;
      topic_title: string;
      leader_id: string;
      leader_name: string;
      created_at: string;
      days_stuck: number;
      bottleneck_tags: BottleneckTag[];
    }>;
    unused_high_impact: Array<{ id: string; topic_title: string; leader_name: string; days_old: number }>;
  };
  keywords: {
    tracked: number;
    with_content: number;
    without_content: number;
    coverage: {
      covered: number;
      weak: number;
      not_covered: number;
    };
    high_volume_gaps: Array<{ id: string; keyword: string; search_volume: number; brand_name: string; coverage_state: string }>;
  };
  velocity: {
    this_week: number;
    last_week: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    change_pct: number;
    avg_days_to_publish: number | null;
  };
  pipeline: NormalizedPipeline;
  sla: SLAMetrics;
}

const SYSTEM_PROMPT = `You are the Content Lifecycle Manager for a B2B marketing agency.

You are a VISIBILITY + PRIORITIZATION agent, NOT a creator. Your job is to:
- OBSERVE the content pipeline
- NORMALIZE status data
- FLAG bottlenecks and stuck content
- RECOMMEND specific actions
- SUMMARIZE health metrics

CRITICAL: Use the normalized pipeline stages (research → draft → review → published) for all analysis.

Analyze the content production pipeline and provide:

1. WEEKLY CONTENT HEALTH SUMMARY
Write a clear 2-3 sentence executive summary like:
"This Week's Content Health: 42 items in Draft (18 breaching SLA), 11 unused high-impact trends, SEO gaps detected for 9 priority keywords. Content velocity ↓ 12% vs last week."

2. PIPELINE STATUS (using normalized stages)
- Show content at each stage: Research → Draft → Review → Published
- Calculate conversion rates between stages
- Identify the biggest bottleneck stage

3. STUCK CONTENT WITH BOTTLENECK TAGS
For each stuck item, include the detected bottleneck reasons:
- awaiting_review: Draft > 7 days
- sla_breach: Exceeded stage SLA
- missing_keywords: No keyword assigned
- no_owner: No leader/brand assigned
- failed_generation: Multiple failures

4. RETRY INTELLIGENCE FOR FAILED CONTENT
For each failed item, specify:
- Failure reason (timeout, api_error, validation_error)
- Whether auto-retry is safe
- Recommended action

5. TREND UTILIZATION SCORE
- Calculate: (trends_used / total_trends) × 100
- List unused high-impact trends
- Recommend which trends to prioritize

6. KEYWORD COVERAGE HEATMAP
Use states:
- 🟢 Covered: Has published content
- 🟡 Weak: Mentioned but no dedicated content
- 🔴 Not covered: No content at all
Priority = search_volume × relevance

7. SLA TRACKING
Report on:
- Research → Draft: 2 day SLA
- Draft → Review: 3 day SLA
- Review → Publish: 2 day SLA
Flag breaches and average delays per stage.

8. PRIORITY ACTIONS
Provide 5-7 specific, actionable next steps with priority levels.

Output structured JSON with:
- weekly_summary (executive summary paragraph)
- pipeline_summary (object with normalized stage counts and conversion rates)
- stuck_content (array with bottleneck_tags and retry_info)
- trend_utilization (object with score and unused_high_impact list)
- keyword_coverage (object with coverage states and priority gaps)
- sla_status (object with breaches and delays)
- velocity (object with metrics and change_pct)
- priority_actions (array of specific next steps)`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const body: ContentLifecycleRequest = await req.json().catch(() => ({}));
    const brandId = body.brand_id;

    console.log(`[content-lifecycle] Starting enhanced analysis...`, { brandId, scope: body.scope });

    const startTime = Date.now();
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // ========== COLLECT DATA ==========

    // 1. SEO Blog Status
    let seoQuery = supabase
      .from('seo_blog_content')
      .select('id, title, status, primary_keyword, brand_id, created_at, updated_at, paragraphs, validation_errors')
      .order('created_at', { ascending: false })
      .limit(100);

    if (brandId) {
      seoQuery = seoQuery.eq('brand_id', brandId);
    }

    const { data: seoBlogs } = await seoQuery;

    // 2. Weekly Trends Pipeline
    let trendsQuery = supabase
      .from('weekly_trends')
      .select('id, topic_title, status, leader_id, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(100);

    const { data: trends } = await trendsQuery;

    // 3. Keyword Research
    let keywordsQuery = supabase
      .from('keyword_research')
      .select('id, keyword, status, brand_id, search_volume, competition')
      .order('search_volume', { ascending: false })
      .limit(100);

    if (brandId) {
      keywordsQuery = keywordsQuery.eq('brand_id', brandId);
    }

    const { data: keywords } = await keywordsQuery;

    // 4. Keyword Blog Usage
    const { data: keywordUsage } = await supabase
      .from('keyword_blog_usage')
      .select('keyword_id, blog_id');

    // 5. Brands for context
    const { data: brands } = await supabase
      .from('brands')
      .select('id, name, slug')
      .eq('is_active', true);

    // 6. Thought Leaders for context
    const { data: leaders } = await supabase
      .from('thought_leaders')
      .select('id, name, url_slug');

    // ========== NORMALIZE PIPELINE ==========
    
    const pipeline: NormalizedPipeline = {
      research: 0,
      draft: 0,
      review: 0,
      published: 0,
      failed: 0,
      unknown: 0,
    };

    // Normalize SEO blogs
    seoBlogs?.forEach(blog => {
      const stage = normalizeStatus(blog.status);
      if (stage in pipeline) {
        pipeline[stage as keyof NormalizedPipeline]++;
      }
    });

    // Normalize trends
    trends?.forEach(trend => {
      const stage = normalizeStatus(trend.status);
      if (stage in pipeline) {
        pipeline[stage as keyof NormalizedPipeline]++;
      }
    });

    // ========== CALCULATE SLA METRICS ==========
    
    const slaMetrics: SLAMetrics = {
      breaching_count: 0,
      avg_delay_days: 0,
      brand_health: {},
    };

    interface ContentItem {
      type: string;
      brand_id?: string;
      status?: string;
      created_at?: string;
    }

    const allItems: ContentItem[] = [
      ...(seoBlogs || []).map((b: any) => ({ ...b, type: 'seo' })),
      ...(trends || []).map((t: any) => ({ ...t, type: 'trend' })),
    ];

    let totalDelays = 0;
    let delayCount = 0;

    allItems.forEach(item => {
      const normalizedStage = normalizeStatus(item.status ?? null);
      const daysInStage = calculateDaysInStage(item.created_at ?? new Date().toISOString());
      
      let slaThreshold = 0;
      if (normalizedStage === 'draft') slaThreshold = SLA_THRESHOLDS.draft_to_review;
      else if (normalizedStage === 'review') slaThreshold = SLA_THRESHOLDS.review_to_publish;
      else if (normalizedStage === 'research') slaThreshold = SLA_THRESHOLDS.research_to_draft;

      if (slaThreshold > 0 && daysInStage > slaThreshold) {
        slaMetrics.breaching_count++;
        totalDelays += (daysInStage - slaThreshold);
        delayCount++;
      }

      // Track brand health
      const brandIdKey = item.brand_id || 'unassigned';
      if (!slaMetrics.brand_health[brandIdKey]) {
        slaMetrics.brand_health[brandIdKey] = { breaches: 0, total: 0, health_pct: 100 };
      }
      slaMetrics.brand_health[brandIdKey].total++;
      if (slaThreshold > 0 && daysInStage > slaThreshold) {
        slaMetrics.brand_health[brandIdKey].breaches++;
      }
    });

    // Calculate health percentages
    Object.keys(slaMetrics.brand_health).forEach(key => {
      const bh = slaMetrics.brand_health[key];
      bh.health_pct = bh.total > 0 ? Math.round(((bh.total - bh.breaches) / bh.total) * 100) : 100;
    });

    slaMetrics.avg_delay_days = delayCount > 0 ? Math.round(totalDelays / delayCount) : 0;

    // ========== CALCULATE METRICS WITH ENHANCEMENTS ==========

    const seoMetrics = {
      total: seoBlogs?.length || 0,
      failed: seoBlogs?.filter(b => b.status === 'failed').length || 0,
      generating: seoBlogs?.filter(b => b.status === 'generating').length || 0,
      completed: seoBlogs?.filter(b => b.status === 'completed').length || 0,
      failed_items: seoBlogs?.filter(b => b.status === 'failed').map(b => ({
        id: b.id,
        title: b.title || 'Untitled',
        brand_id: b.brand_id,
        brand_name: brands?.find(br => br.id === b.brand_id)?.name || 'Unknown',
        created_at: b.created_at,
        paragraphs: b.paragraphs || [],
        validation_errors: b.validation_errors || [],
        failure_reason: detectFailureReason(b),
      })) || [],
    };

    // Trend metrics with utilization score
    const totalTrends = trends?.length || 0;
    const usedTrends = trends?.filter(t => normalizeStatus(t.status) === 'published').length || 0;
    const utilizationScore = totalTrends > 0 ? Math.round((usedTrends / totalTrends) * 100) : 0;

    const trendMetrics = {
      total: totalTrends,
      draft: trends?.filter(t => normalizeStatus(t.status) === 'draft').length || 0,
      ready: trends?.filter(t => normalizeStatus(t.status) === 'review').length || 0,
      used: usedTrends,
      utilization_score: utilizationScore,
      draft_items: trends?.filter(t => {
        const isDraft = normalizeStatus(t.status) === 'draft';
        const daysStuck = calculateDaysInStage(t.created_at);
        return isDraft && daysStuck >= 7;
      }).map(t => {
        const daysStuck = calculateDaysInStage(t.created_at);
        return {
          id: t.id,
          topic_title: t.topic_title,
          leader_id: t.leader_id,
          leader_name: leaders?.find(l => l.id === t.leader_id)?.name || 'Unknown',
          created_at: t.created_at,
          days_stuck: daysStuck,
          bottleneck_tags: detectBottleneckReasons(t, daysStuck),
        };
      }) || [],
      unused_high_impact: trends?.filter(t => 
        normalizeStatus(t.status) !== 'published' && calculateDaysInStage(t.created_at) < 30
      ).slice(0, 5).map(t => ({
        id: t.id,
        topic_title: t.topic_title,
        leader_name: leaders?.find(l => l.id === t.leader_id)?.name || 'Unknown',
        days_old: calculateDaysInStage(t.created_at),
      })) || [],
    };

    // Keyword metrics with coverage states
    const keywordIds = keywords?.map(k => k.id) || [];
    const usedKeywordIds = new Set(keywordUsage?.map(u => u.keyword_id) || []);

    const covered = keywordIds.filter(id => usedKeywordIds.has(id)).length;
    const notCovered = keywordIds.filter(id => !usedKeywordIds.has(id)).length;

    const keywordMetrics = {
      tracked: keywords?.length || 0,
      with_content: covered,
      without_content: notCovered,
      coverage: {
        covered,
        weak: 0, // Would need content analysis to determine
        not_covered: notCovered,
      },
      high_volume_gaps: keywords?.filter(k => 
        !usedKeywordIds.has(k.id) && (k.search_volume || 0) > 100
      ).slice(0, 10).map(k => ({
        id: k.id,
        keyword: k.keyword,
        search_volume: k.search_volume || 0,
        brand_name: brands?.find(b => b.id === k.brand_id)?.name || 'Unknown',
        coverage_state: '🔴 Not covered',
      })) || [],
    };

    // Velocity calculation with change percentage
    const thisWeekContent = seoBlogs?.filter(b => {
      const created = new Date(b.created_at);
      return created >= sevenDaysAgo && b.status === 'completed';
    }).length || 0;

    const lastWeekContent = seoBlogs?.filter(b => {
      const created = new Date(b.created_at);
      return created >= fourteenDaysAgo && created < sevenDaysAgo && b.status === 'completed';
    }).length || 0;

    const changePct = lastWeekContent > 0 
      ? Math.round(((thisWeekContent - lastWeekContent) / lastWeekContent) * 100)
      : thisWeekContent > 0 ? 100 : 0;

    const velocityMetrics = {
      this_week: thisWeekContent,
      last_week: lastWeekContent,
      trend: thisWeekContent > lastWeekContent ? 'increasing' as const : 
             thisWeekContent < lastWeekContent ? 'decreasing' as const : 'stable' as const,
      change_pct: changePct,
      avg_days_to_publish: null as number | null,
    };

    const metrics: ContentMetrics = {
      seo: seoMetrics,
      trends: trendMetrics,
      keywords: keywordMetrics,
      velocity: velocityMetrics,
      pipeline,
      sla: slaMetrics,
    };

    // ========== AI ANALYSIS ==========

    const OPENAI_KEY = Deno.env.get('OPENAI_KEY');
    if (!OPENAI_KEY) {
      throw new Error('OPENAI_KEY not configured');
    }

    const dataContext = {
      current_date: now.toISOString().split('T')[0],
      metrics,
      brands: brands?.map(b => ({ id: b.id, name: b.name })) || [],
      leaders: leaders?.map(l => ({ id: l.id, name: l.name })) || [],
      sla_thresholds: SLA_THRESHOLDS,
    };

    const userPrompt = `Analyze this content pipeline data and provide a comprehensive Content Lifecycle report.

IMPORTANT: Focus on the NORMALIZED pipeline stages and use the bottleneck tags provided.

DATA:
${JSON.stringify(dataContext, null, 2)}

${body.refinement_prompt ? `\nADDITIONAL INSTRUCTIONS:\n${body.refinement_prompt}` : ''}

Provide specific, actionable recommendations with the weekly summary format specified.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const aiData = await response.json();
    const generationTime = Date.now() - startTime;

    let analysis;
    try {
      analysis = JSON.parse(aiData.choices?.[0]?.message?.content || '{}');
    } catch {
      analysis = { weekly_summary: aiData.choices?.[0]?.message?.content || 'Failed to parse response' };
    }

    // ========== STORE RUN RECORD ==========

    const { data: agent } = await supabase
      .from('ai_agents')
      .select('id')
      .eq('slug', 'content-lifecycle')
      .single();

    if (agent) {
      await supabase
        .from('ai_agent_runs')
        .insert({
          agent_id: agent.id,
          executed_by: user.id,
          status: 'completed',
          execution_context: { brand_id: brandId, scope: body.scope },
          ai_summary: {
            ...analysis,
            _meta: {
              generation_time_ms: generationTime,
              provider: 'openai',
              model: 'gpt-4o-mini',
              total_tokens: aiData.usage?.total_tokens,
            },
            raw_metrics: metrics,
          },
        });
    }

    console.log(`[content-lifecycle] Enhanced analysis complete in ${generationTime}ms`);

    return new Response(JSON.stringify({
      success: true,
      analysis,
      metrics,
      provider_meta: {
        provider: 'openai',
        version: 'v1',
        api_model: 'gpt-4o-mini',
        response_time_ms: generationTime,
        total_tokens: aiData.usage?.total_tokens,
        prompt_tokens: aiData.usage?.prompt_tokens,
        completion_tokens: aiData.usage?.completion_tokens,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[content-lifecycle] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
