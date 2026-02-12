import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MarketingIntelligenceRequest {
  brand_id?: string;
  leader_id?: string;
  timeframe?: "last_7_days" | "last_30_days" | "last_quarter" | "all";
  analysis_type?: "full" | "hooks" | "audiences" | "attribution" | "topics";
  refinement_prompt?: string;
}

interface HookPerformance {
  style: string;
  avg_engagement: number;
  sample_count: number;
  top_audience?: string | null;
}

interface AudienceResonance {
  audience_segment: string;
  content_type: string;
  avg_engagement: number;
  sample_count: number;
}

interface KPIAttributionBreakdown {
  kpi: string;
  current: number;
  target: number | null;
  content_correlation: {
    linkedin_posts: { impact_score: number; posts_this_period: number };
    seo_blogs: { impact_score: number; blogs_published: number };
    other_sources: number;
  };
  recommendation: string;
}

interface TopicCluster {
  cluster_name: string;
  topics: string[];
  performance_label: "high" | "medium" | "low" | "untested";
}

interface LeaderRanking {
  name: string;
  posts_tracked: number;
  avg_engagement: number;
  best_audience: string | null;
  improvement_tip: string;
}

interface ActionItem {
  text: string;
  owner?: string;
  effort?: "low" | "medium" | "high";
  impact?: string;
}

interface MarketingIntelligenceAnalysis {
  executive_summary: string;
  hook_analysis: HookPerformance[];
  audience_insights: AudienceResonance[];
  kpi_attribution: KPIAttributionBreakdown[];
  topic_clusters: TopicCluster[];
  leader_effectiveness?: LeaderRanking[];
  action_items: ActionItem[];
  data_quality_score: number; // 0-100
  confidence: "High" | "Medium" | "Low";
}

interface MarketingIntelligenceResponse {
  success: boolean;
  run_id: string | null;
  analysis: MarketingIntelligenceAnalysis;
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

function getTimeframeStart(timeframe?: string): Date | null {
  const now = new Date();
  switch (timeframe) {
    case "last_7_days":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "last_quarter":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case "all":
      return null;
    case "last_30_days":
    default:
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      data: { user },
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: MarketingIntelligenceRequest = await req.json().catch(() => ({}));
    const timeframe = body.timeframe || "last_30_days";
    const analysisType = body.analysis_type || "full";
    const brandId = body.brand_id || null;
    const leaderId = body.leader_id || null;

    const timeframeStart = getTimeframeStart(timeframe);
    const startDateStr = timeframeStart ? timeframeStart.toISOString().split("T")[0] : null;

    const startTime = Date.now();

    console.log("[marketing-intelligence] Starting analysis", {
      brandId,
      leaderId,
      timeframe,
      analysisType,
    });

    // Fetch the marketing intelligence agent record
    const { data: agent } = await supabase
      .from("ai_agents")
      .select("id")
      .eq("slug", "marketing-intelligence")
      .single();

    if (!agent) {
      throw new Error("Marketing Intelligence agent not found in database");
    }

    // ==========================
    // Fetch core data in parallel
    // ==========================

    // If brand filter is provided, get leader_ids for that brand for better scoping
    let leaderIdsForBrand: string[] = [];
    if (brandId) {
      const { data: leadersForBrand } = await supabase
        .from("thought_leaders")
        .select("id")
        .eq("brand_id", brandId);
      leaderIdsForBrand = (leadersForBrand || []).map((l: any) => l.id);
    }

    const effectiveLeaderFilterIds = leaderId ? [leaderId] : leaderIdsForBrand.length ? leaderIdsForBrand : null;

    // Build queries with proper conditional filters
    const buildPerformanceQuery = () => {
      let query = supabase
        .from("content_performance_metrics")
        .select("id, leader_id, engagement_score, impressions, reach_count, hook_style, post_type, posted_date, audience");
      if (effectiveLeaderFilterIds) {
        query = query.in("leader_id", effectiveLeaderFilterIds);
      }
      if (startDateStr) {
        query = query.gte("posted_date", startDateStr);
      }
      return query.order("posted_date", { ascending: false }).limit(200);
    };

    const buildAnalyticsQuery = () => {
      let query = supabase
        .from("brand_analytics_data")
        .select("id, brand_id, data_type, metrics, date_range_start, date_range_end");
      if (brandId) {
        query = query.eq("brand_id", brandId);
      }
      if (startDateStr) {
        query = query.gte("date_range_start", startDateStr);
      }
      return query.order("date_range_start", { ascending: false }).limit(233);
    };

    const buildKpisQuery = () => {
      let query = supabase
        .from("brand_kpis")
        .select("id, brand_id, name, type, current_value, target_value, source");
      if (brandId) query = query.eq("brand_id", brandId);
      return query;
    };

    const buildPostsQuery = () => {
      let query = supabase
        .from("generated_posts")
        .select("id, leader_id, post_title, post_type, generated_at, status, published_at");
      if (effectiveLeaderFilterIds) {
        query = query.in("leader_id", effectiveLeaderFilterIds);
      }
      if (timeframeStart) {
        query = query.gte("generated_at", timeframeStart.toISOString());
      }
      return query.order("generated_at", { ascending: false }).limit(50);
    };

    const buildTrendsQuery = () => {
      let query = supabase
        .from("weekly_trends")
        .select("id, leader_id, week_start, topic_title, topic_summary, relevance_score, status");
      if (effectiveLeaderFilterIds) {
        query = query.in("leader_id", effectiveLeaderFilterIds);
      }
      if (timeframeStart) {
        query = query.gte("week_start", timeframeStart.toISOString().split("T")[0]);
      }
      return query.order("week_start", { ascending: false }).limit(50);
    };

    const buildLeadersQuery = () => {
      let query = supabase
        .from("thought_leaders")
        .select("id, name, title, department, brand_id, target_audience, persona_tone");
      if (effectiveLeaderFilterIds) {
        query = query.in("id", effectiveLeaderFilterIds);
      } else if (brandId) {
        query = query.eq("brand_id", brandId);
      }
      return query;
    };

    const buildBlogsQuery = () => {
      let query = supabase
        .from("seo_blog_content")
        .select("id, brand_id, leader_id, primary_keyword, title, status, created_at, published_at");
      if (brandId) query = query.eq("brand_id", brandId);
      if (effectiveLeaderFilterIds) query = query.in("leader_id", effectiveLeaderFilterIds);
      if (timeframeStart) query = query.gte("created_at", timeframeStart.toISOString());
      return query.order("created_at", { ascending: false }).limit(20);
    };

    const [
      performanceResult,
      analyticsResult,
      kpisResult,
      postsResult,
      trendsResult,
      leadersResult,
      blogsResult,
    ] = await Promise.all([
      buildPerformanceQuery(),
      buildAnalyticsQuery(),
      buildKpisQuery(),
      buildPostsQuery(),
      buildTrendsQuery(),
      buildLeadersQuery(),
      buildBlogsQuery(),
    ]);

    const performance = performanceResult.data || [];
    const analytics = analyticsResult.data || [];
    const kpis = kpisResult.data || [];
    const posts = postsResult.data || [];
    const trends = trendsResult.data || [];
    const leaders = leadersResult.data || [];
    const blogs = blogsResult.data || [];

    const rawMetrics = {
      posts_analyzed: performance.length,
      analytics_rows: analytics.length,
      kpis_tracked: kpis.length,
      trends_reviewed: trends.length,
    };

    // ==========================
    // Prepare lightweight aggregates for the model
    // ==========================

    // Hook style aggregate
    const hookAggregates: Record<
      string,
      { totalEngagement: number; count: number; audiences: Record<string, number> }
    > = {};
    for (const row of performance as any[]) {
      const style = (row.hook_style || "unknown").trim() || "unknown";
      const engagement = Number(row.engagement_score || 0);
      const audience = (row.audience || "unknown").trim() || "unknown";
      if (!hookAggregates[style]) {
        hookAggregates[style] = { totalEngagement: 0, count: 0, audiences: {} };
      }
      hookAggregates[style].totalEngagement += engagement;
      hookAggregates[style].count += 1;
      hookAggregates[style].audiences[audience] = (hookAggregates[style].audiences[audience] || 0) + 1;
    }

    const hookPerformance: HookPerformance[] = Object.entries(hookAggregates).map(([style, agg]) => {
      const topAudience =
        Object.entries(agg.audiences).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
      return {
        style,
        avg_engagement: agg.count ? Math.round(agg.totalEngagement / agg.count) : 0,
        sample_count: agg.count,
        top_audience: topAudience,
      };
    });

    // Audience resonance aggregate (very simple heuristic using performance.audience + post_type)
    const audienceAgg: Record<
      string,
      { totalEngagement: number; count: number; contentTypes: Record<string, number> }
    > = {};
    for (const row of performance as any[]) {
      const audiences = (row.audience || "Unknown").split(",").map((a: string) => a.trim()).filter(Boolean);
      const engagement = Number(row.engagement_score || 0);
      const contentType = (row.post_type || "unknown").trim() || "unknown";
      for (const aud of audiences) {
        if (!audienceAgg[aud]) {
          audienceAgg[aud] = { totalEngagement: 0, count: 0, contentTypes: {} };
        }
        audienceAgg[aud].totalEngagement += engagement;
        audienceAgg[aud].count += 1;
        audienceAgg[aud].contentTypes[contentType] =
          (audienceAgg[aud].contentTypes[contentType] || 0) + 1;
      }
    }

    const audienceInsights: AudienceResonance[] = Object.entries(audienceAgg).map(([aud, agg]) => {
      const topContentType =
        Object.entries(agg.contentTypes).sort((a, b) => b[1] - a[1])[0]?.[0] || "unknown";
      return {
        audience_segment: aud,
        content_type: topContentType,
        avg_engagement: agg.count ? Math.round(agg.totalEngagement / agg.count) : 0,
        sample_count: agg.count,
      };
    });

    // Basic content activity counters for attribution hints
    const postsThisPeriod = posts.filter((p: any) => p.status === "published").length;
    const blogsThisPeriod = blogs.filter((b: any) => b.status === "published").length;

    // ==========================
    // Call OpenAI with structured output
    // ==========================

    const OPENAI_KEY = Deno.env.get("OPENAI_KEY");
    if (!OPENAI_KEY) {
      throw new Error("OPENAI_KEY not configured");
    }

    const systemPrompt = `SYSTEM: You are the Marketing Intelligence agent for SJ Innovation.
You connect content performance with business outcomes across platforms.

Use the provided data to:
- Analyze hook styles performance
- Map which audiences resonate with which content types
- Attribute KPI progress to content activities (at a qualitative level)
- Cluster topics into high performers, underperformers, and untested
- Rank leaders by effectiveness

Be concrete and reference real numbers from the data where possible.`;

    const dataContext = {
      timeframe,
      brand_id: brandId,
      leader_id: leaderId,
      analysis_type: analysisType,
      aggregates: {
        hook_performance: hookPerformance,
        audience_insights: audienceInsights,
      },
      raw: {
        performance,
        analytics,
        kpis,
        posts,
        trends,
        leaders,
        blogs,
      },
      hints: {
        posts_this_period: postsThisPeriod,
        blogs_published: blogsThisPeriod,
      },
    };

    const toolDefinition = {
      type: "function",
      function: {
        name: "generate_marketing_intelligence",
        description:
          "Generate a cross-channel marketing intelligence report linking content performance to KPIs.",
        parameters: {
          type: "object",
          properties: {
            executive_summary: { type: "string" },
            hook_analysis: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  style: { type: "string" },
                  avg_engagement: { type: "number" },
                  sample_count: { type: "number" },
                  top_audience: { type: "string", nullable: true },
                  recommendation: { type: "string" },
                },
                required: ["style", "avg_engagement", "sample_count", "recommendation"],
              },
            },
            audience_insights: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  audience_segment: { type: "string" },
                  content_type: { type: "string" },
                  avg_engagement: { type: "number" },
                  sample_count: { type: "number" },
                  insight: { type: "string" },
                },
                required: ["audience_segment", "content_type", "avg_engagement", "sample_count", "insight"],
              },
            },
            kpi_attribution: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  kpi: { type: "string" },
                  current: { type: "number" },
                  target: { type: "number", nullable: true },
                  content_correlation: {
                    type: "object",
                    properties: {
                      linkedin_posts: {
                        type: "object",
                        properties: {
                          impact_score: { type: "number" },
                          posts_this_period: { type: "number" },
                        },
                        required: ["impact_score", "posts_this_period"],
                      },
                      seo_blogs: {
                        type: "object",
                        properties: {
                          impact_score: { type: "number" },
                          blogs_published: { type: "number" },
                        },
                        required: ["impact_score", "blogs_published"],
                      },
                      other_sources: { type: "number" },
                    },
                    required: ["linkedin_posts", "seo_blogs", "other_sources"],
                  },
                  recommendation: { type: "string" },
                },
                required: ["kpi", "current", "content_correlation", "recommendation"],
              },
            },
            topic_clusters: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  cluster_name: { type: "string" },
                  topics: { type: "array", items: { type: "string" } },
                  performance_label: {
                    type: "string",
                    enum: ["high", "medium", "low", "untested"],
                  },
                },
                required: ["cluster_name", "topics", "performance_label"],
              },
            },
            leader_effectiveness: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  posts_tracked: { type: "number" },
                  avg_engagement: { type: "number" },
                  best_audience: { type: "string", nullable: true },
                  improvement_tip: { type: "string" },
                },
                required: ["name", "posts_tracked", "avg_engagement", "improvement_tip"],
              },
            },
            action_items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  text: { type: "string" },
                  owner: { type: "string" },
                  effort: { type: "string", enum: ["low", "medium", "high"] },
                  impact: { type: "string" },
                },
                required: ["text"],
              },
            },
            data_quality_score: { type: "number" },
            confidence: { type: "string", enum: ["High", "Medium", "Low"] },
          },
          required: [
            "executive_summary",
            "hook_analysis",
            "audience_insights",
            "kpi_attribution",
            "topic_clusters",
            "action_items",
            "data_quality_score",
            "confidence",
          ],
        },
      },
    };

    const userPrompt = `You are given aggregated and raw marketing data.
Use it to generate a cross-channel marketing intelligence report.

Focus on:
- Hook style effectiveness
- Audience x content type resonance
- Attribution of content activities to KPI progress
- Topic performance clusters
- Leader effectiveness ranking

ONLY use patterns that are actually supported by the data. Avoid hallucinating metrics.`;

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: userPrompt,
              },
              {
                type: "text",
                text: JSON.stringify(dataContext, null, 2),
              },
              body.refinement_prompt
                ? {
                    type: "text",
                    text: `Additional user instructions: ${body.refinement_prompt}`,
                  }
                : null,
            ].filter(Boolean),
          },
        ],
        tools: [toolDefinition],
        tool_choice: { type: "function", function: { name: "generate_marketing_intelligence" } },
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error("[marketing-intelligence] OpenAI error:", errorText);
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const aiData = await openaiResponse.json();
    const generationTime = Date.now() - startTime;

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("No tool call in AI response");
    }

    const analysis: MarketingIntelligenceAnalysis = JSON.parse(toolCall.function.arguments);

    // Store run record
    const { data: runRecord } = await supabase
      .from("ai_agent_runs")
      .insert({
        agent_id: agent.id,
        executed_by: user.id,
        execution_context: {
          brand_id: brandId,
          leader_id: leaderId,
          timeframe,
          analysis_type: analysisType,
        },
        ai_summary: analysis,
        status: "completed",
        category: "analytics",
        title: `Marketing Intelligence - ${new Date().toISOString().split("T")[0]}`,
      })
      .select()
      .single();

    const responsePayload: MarketingIntelligenceResponse = {
      success: true,
      run_id: runRecord?.id || null,
      analysis,
      raw_metrics: rawMetrics,
      meta: {
        generation_time_ms: generationTime,
        tokens_used: aiData.usage?.total_tokens ?? null,
        timeframe,
      },
    };

    return new Response(JSON.stringify(responsePayload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[marketing-intelligence] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

