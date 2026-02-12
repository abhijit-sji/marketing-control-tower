import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DataStrategistRequest {
  timeframe?: string;
  start_date?: string;
  end_date?: string;
  brand_ids?: string[];
  refinement_prompt?: string;
}

interface ChartConfig {
  type: 'line' | 'bar' | 'pie';
  title: string;
  data: Array<{ label: string; value: number; [key: string]: any }>;
  caption: string;
}

interface ActionItem {
  action: string;
  owner: string;
  effort: 'low' | 'medium' | 'high';
  confidence: number;
}

interface DataStrategistOutput {
  charts: ChartConfig[];
  summary: string[];
  actions: ActionItem[];
  reproduce: string;
  data_warnings: string[];
  confidence: 'High' | 'Medium' | 'Low';
  performance_score?: number;
  kpi_analysis?: Array<{
    name: string;
    current: number;
    target: number;
    gap_percent: number;
    trend: 'up' | 'down' | 'stable';
  }>;
}

const SYSTEM_PROMPT = `SYSTEM: You are the Data Strategist for SJ Innovation marketing team inside Control Tower.
Your job is to analyze ALL available brand data and provide comprehensive, actionable insights.

DATA SOURCES YOU HAVE ACCESS TO:
- brands: Brand info including name, status, website, budget
- brand_kpis: KPIs with current values vs targets - ANALYZE GAPS
- brand_analytics_data: Website/marketing analytics with metrics and dimensions
- brand_knowledge_files: Count of knowledge base documents per brand
- brand_generated_posts: LinkedIn/content posts generated for the brand
- thought_leaders: People associated with the brand for content
- projects: Active projects and budgets
- previous_agent_runs: Historical analysis for trend comparison

ANALYSIS REQUIREMENTS:
1. Calculate KPI GAP PERCENTAGES: (target - current) / target * 100
2. Identify which KPIs are on track (>80% of target) vs at risk (<50% of target)
3. Look at content generation activity - are posts being created?
4. Check knowledge base completeness - does brand have enough context?
5. Review analytics trends if available

OUTPUT REQUIREMENTS:
1. Charts: Create 2 meaningful charts:
   - Chart 1: KPI Progress (bar chart showing current vs target for each KPI)
   - Chart 2: Relevant trend or breakdown (analytics, content performance, etc.)

2. Executive Summary: EXACTLY 3 bullets, each SPECIFIC with numbers:
   - Bullet 1: Top performing metric with actual numbers
   - Bullet 2: Biggest gap/risk with specific percentage
   - Bullet 3: Key opportunity with projected impact

3. Actions: EXACTLY 3 specific, actionable recommendations:
   - Each must have: what to do, who should do it, effort level
   - Include expected impact when possible
   - Be specific, not generic advice

4. Data Quality: Note any missing data that would improve analysis

IMPORTANT: If KPIs exist, ALWAYS include the gap analysis. Show real numbers.
If no data exists for a category, explicitly say "No [category] data available" in warnings.

Format: Return structured JSON using the provided tool.`;

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

    const body: DataStrategistRequest = await req.json();
    const { timeframe = 'last_30_days', brand_ids, refinement_prompt } = body;

    console.log('[data-strategist] Starting comprehensive analysis for timeframe:', timeframe);

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    switch (timeframe) {
      case 'last_7_days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'last_quarter':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'last_year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Fetch brands
    let brandsQuery = supabase.from('brands').select('id, name, slug, status, website_url, monthly_budget, is_active, description').eq('is_active', true);
    if (brand_ids && brand_ids.length > 0) {
      brandsQuery = brandsQuery.in('id', brand_ids);
    }
    const { data: brands, error: brandsError } = await brandsQuery;
    if (brandsError) throw brandsError;

    const brandIdList = brands?.map(b => b.id) || [];
    console.log('[data-strategist] Analyzing', brandIdList.length, 'brands');

    // Fetch ALL data sources in parallel
    const [
      kpisResult,
      analyticsResult,
      projectsResult,
      knowledgeFilesResult,
      generatedPostsResult,
      thoughtLeadersResult,
      previousRunsResult
    ] = await Promise.all([
      // KPIs - most important
      supabase
        .from('brand_kpis')
        .select('id, brand_id, name, type, source, current_value, target_value, description, updated_at')
        .in('brand_id', brandIdList),
      
      // Analytics data
      supabase
        .from('brand_analytics_data')
        .select('id, brand_id, data_type, metrics, dimensions, date_range_start, date_range_end')
        .in('brand_id', brandIdList)
        .gte('date_range_start', startDate.toISOString().split('T')[0])
        .order('date_range_start', { ascending: false })
        .limit(200),
      
      // Projects
      supabase
        .from('projects')
        .select('id, name, client_id, status, start_date, end_date, monthly_budget, total_budget')
        .limit(100),
      
      // Knowledge files count per brand
      supabase
        .from('brand_knowledge_files')
        .select('id, brand_id, file_name, file_type, created_at')
        .in('brand_id', brandIdList),
      
      // Generated posts
      supabase
        .from('brand_generated_posts')
        .select('id, brand_id, post_title, source_type, generated_at')
        .in('brand_id', brandIdList)
        .gte('generated_at', startDate.toISOString())
        .order('generated_at', { ascending: false })
        .limit(50),
      
      // Thought leaders
      supabase
        .from('thought_leaders')
        .select('id, brand_id, name, title, linkedin_url')
        .in('brand_id', brandIdList),
      
      // Previous agent runs for this analysis type
      supabase
        .from('ai_agent_runs')
        .select('id, created_at, ai_summary, category')
        .eq('category', 'business_analysis')
        .order('created_at', { ascending: false })
        .limit(5)
    ]);

    const kpis = kpisResult.data || [];
    const analyticsData = analyticsResult.data || [];
    const projects = projectsResult.data || [];
    const knowledgeFiles = knowledgeFilesResult.data || [];
    const generatedPosts = generatedPostsResult.data || [];
    const thoughtLeaders = thoughtLeadersResult.data || [];
    const previousRuns = previousRunsResult.data || [];

    // Calculate KPI metrics with gap analysis
    const kpiAnalysis = kpis.map(kpi => {
      const current = kpi.current_value || 0;
      const target = kpi.target_value || 0;
      const gapPercent = target > 0 ? Math.round(((target - current) / target) * 100) : 0;
      const progressPercent = target > 0 ? Math.round((current / target) * 100) : 0;
      
      return {
        name: kpi.name,
        brand_id: kpi.brand_id,
        current,
        target,
        gap_percent: gapPercent,
        progress_percent: progressPercent,
        status: progressPercent >= 80 ? 'on_track' : progressPercent >= 50 ? 'at_risk' : 'critical',
        source: kpi.source,
        description: kpi.description
      };
    });

    // Aggregate content metrics
    const contentMetrics = {
      total_posts_generated: generatedPosts.length,
      posts_by_type: generatedPosts.reduce((acc, post) => {
        acc[post.source_type] = (acc[post.source_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      thought_leaders_count: thoughtLeaders.length,
      knowledge_files_count: knowledgeFiles.length
    };

    // Build comprehensive context for AI
    const dataContext = {
      timeframe,
      date_range: {
        start: startDate.toISOString().split('T')[0],
        end: now.toISOString().split('T')[0],
      },
      brands: brands?.map(b => ({
        id: b.id,
        name: b.name,
        slug: b.slug,
        website: b.website_url,
        monthly_budget: b.monthly_budget,
        description: b.description
      })) || [],
      
      kpi_analysis: kpiAnalysis,
      kpi_summary: {
        total_kpis: kpis.length,
        on_track: kpiAnalysis.filter(k => k.status === 'on_track').length,
        at_risk: kpiAnalysis.filter(k => k.status === 'at_risk').length,
        critical: kpiAnalysis.filter(k => k.status === 'critical').length,
        avg_progress: kpiAnalysis.length > 0 
          ? Math.round(kpiAnalysis.reduce((sum, k) => sum + k.progress_percent, 0) / kpiAnalysis.length)
          : 0
      },
      
      analytics_data: analyticsData.slice(0, 50), // Limit for token efficiency
      analytics_summary: {
        total_entries: analyticsData.length,
        data_types: [...new Set(analyticsData.map(a => a.data_type))]
      },
      
      content_metrics: contentMetrics,
      
      projects_summary: {
        total: projects.length,
        active: projects.filter(p => p.status === 'active').length,
        total_budget: projects.reduce((sum, p) => sum + (p.total_budget || 0), 0)
      },
      
      knowledge_base: {
        total_files: knowledgeFiles.length,
        by_brand: brands?.map(b => ({
          brand: b.name,
          files: knowledgeFiles.filter(f => f.brand_id === b.id).length
        }))
      },
      
      thought_leaders: thoughtLeaders.map(tl => ({
        name: tl.name,
        title: tl.title,
        brand_id: tl.brand_id
      })),
      
      previous_analysis_count: previousRuns.length
    };

    console.log('[data-strategist] Data context built:', {
      brands: brands?.length,
      kpis: kpis.length,
      analytics: analyticsData.length,
      posts: generatedPosts.length,
      files: knowledgeFiles.length
    });

    // Get OpenAI key
    const OPENAI_KEY = Deno.env.get('OPENAI_KEY');
    if (!OPENAI_KEY) {
      throw new Error('OPENAI_KEY not configured');
    }

    // Define structured output tool with enhanced schema
    const dataStrategistTool = {
      type: "function",
      function: {
        name: "generate_data_strategist_report",
        description: "Generate a comprehensive data strategist report with charts, KPI analysis, and actions",
        parameters: {
          type: "object",
          properties: {
            charts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["line", "bar", "pie"] },
                  title: { type: "string" },
                  data: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        label: { type: "string" },
                        value: { type: "number" },
                        target: { type: "number" }
                      },
                      required: ["label", "value"]
                    }
                  },
                  caption: { type: "string" }
                },
                required: ["type", "title", "data", "caption"]
              },
              description: "Two meaningful charts with real data"
            },
            summary: {
              type: "array",
              items: { type: "string" },
              description: "Exactly three specific bullets with real numbers"
            },
            actions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  action: { type: "string", description: "Specific action with expected impact" },
                  owner: { type: "string", description: "Role responsible" },
                  effort: { type: "string", enum: ["low", "medium", "high"] },
                  confidence: { type: "number", description: "0-1 confidence score" }
                },
                required: ["action", "owner", "effort", "confidence"]
              },
              description: "Three specific action items"
            },
            reproduce: { type: "string", description: "SQL query to reproduce key finding" },
            data_warnings: {
              type: "array",
              items: { type: "string" },
              description: "Data quality notes and missing data"
            },
            confidence: { type: "string", enum: ["High", "Medium", "Low"] },
            performance_score: { 
              type: "number", 
              description: "Overall performance score 0-100 based on KPI progress" 
            }
          },
          required: ["charts", "summary", "actions", "reproduce", "data_warnings", "confidence"]
        }
      }
    };

    const userPrompt = `Analyze this Control Tower data for ${brands?.map(b => b.name).join(', ') || 'all brands'} and generate a comprehensive strategic report.

IMPORTANT: Use the ACTUAL numbers from the data. Do not make up values.

DATA:
${JSON.stringify(dataContext, null, 2)}

Requirements:
1. Create two charts using REAL data from above:
   - Chart 1: Show KPI progress (current vs target) using actual kpi_analysis values
   - Chart 2: Show content/analytics trend or breakdown

2. Write three SPECIFIC summary bullets:
   - Include actual percentages and numbers from the data
   - Highlight gaps and opportunities

3. Recommend three ACTIONABLE items based on the gaps identified

4. Note any data gaps that limit the analysis quality${refinement_prompt ? `

ADDITIONAL USER GUIDANCE:
${refinement_prompt}` : ''}`;

    console.log('[data-strategist] Calling OpenAI with comprehensive data...');
    const startTime = Date.now();
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        tools: [dataStrategistTool],
        tool_choice: { type: "function", function: { name: "generate_data_strategist_report" } },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[data-strategist] OpenAI error:', error);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const aiData = await response.json();
    const generationTime = Date.now() - startTime;

    // Extract tool call result
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('No tool call in AI response');
    }

    const report: DataStrategistOutput = JSON.parse(toolCall.function.arguments);

    // Add KPI analysis to report
    report.kpi_analysis = kpiAnalysis.map(k => ({
      name: k.name,
      current: k.current,
      target: k.target,
      gap_percent: k.gap_percent,
      trend: 'stable' as const
    }));

    // Fetch the agent record
    const { data: agent } = await supabase
      .from('ai_agents')
      .select('id')
      .eq('slug', 'data-strategist')
      .single();

    // Store in ai_agent_runs
    const { data: runRecord, error: runError } = await supabase
      .from('ai_agent_runs')
      .insert({
        agent_id: agent?.id || null,
        executed_by: user.id,
        execution_context: { 
          timeframe, 
          brand_ids, 
          date_range: dataContext.date_range,
          data_summary: {
            brands_analyzed: brands?.length,
            kpis_analyzed: kpis.length,
            analytics_entries: analyticsData.length,
            content_posts: generatedPosts.length
          }
        },
        ai_summary: report,
        generated_tasks: report.actions.map((a, i) => ({
          type: 'task',
          description: a.action,
          priority: a.effort === 'high' ? 'high' : a.effort === 'medium' ? 'medium' : 'low',
          assignee: a.owner,
          confidence: a.confidence,
        })),
        status: 'completed',
        approval_status: 'pending',
        category: 'business_analysis',
        title: `Data Strategist Report - ${brands?.map(b => b.name).join(', ') || 'All Brands'} - ${now.toISOString().split('T')[0]}`,
      })
      .select()
      .single();

    if (runError) {
      console.error('[data-strategist] Error saving run:', runError);
    }

    console.log('[data-strategist] Analysis complete in', generationTime, 'ms');

    return new Response(JSON.stringify({
      success: true,
      run_id: runRecord?.id,
      report,
      meta: {
        generation_time_ms: generationTime,
        tokens_used: aiData.usage?.total_tokens || 0,
        brands_analyzed: brands?.length || 0,
        kpis_analyzed: kpis.length,
        analytics_entries: analyticsData.length,
        content_posts: generatedPosts.length,
        knowledge_files: knowledgeFiles.length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[data-strategist] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
