import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ContentStrategistRequest {
  brand_id?: string;
  brand_ids?: string[];
  content_ids?: string[];
  leader_id?: string;
  content_type?: string;
  limit?: number;
  refinement_prompt?: string;
}

interface HookIdea {
  text: string;
  performance_reason: string;
}

interface TopAsset {
  hook: string;
  angle: string;
  script_30sec: string;
  newsletter_subject: string;
  newsletter_preview: string;
  linkedin_post: string;
  hashtags: string[];
}

interface CalendarEntry {
  content_id: string;
  suggested_date: string;
  channel: string;
  cta: string;
}

interface ContentOutput {
  content_id: string;
  content_title: string;
  hooks: HookIdea[];
  top_3: TopAsset[];
  calendar: CalendarEntry;
}

interface BrandKnowledgeResult {
  context: string;
  snippetCount: number;
  fileCount: number;
  charCount: number;
}

interface DataSourcesUsed {
  knowledge_base: boolean;
  analytics: boolean;
  kpis: boolean;
  leader_uploads: boolean;
  performance_metrics: boolean;
  brand_info: boolean;
}

// ============== DATA COLLECTION FUNCTIONS ==============

/**
 * Collect brand-specific knowledge context from embeddings and file summaries
 * Note: Uses direct DB queries instead of pgvector to avoid bundle timeout
 */
async function collectBrandKnowledgeContext(client: any, brandId: string): Promise<BrandKnowledgeResult> {
  const emptyResult: BrandKnowledgeResult = {
    context: '',
    snippetCount: 0,
    fileCount: 0,
    charCount: 0,
  };

  if (!brandId) return emptyResult;

  try {
    console.log(`[content-strategist] Collecting brand knowledge for brand ${brandId}`);
    
    // Get chunks directly from embeddings table (skip semantic search to avoid timeout)
    const { data: knowledgeChunks } = await client
      .from('brand_knowledge_embeddings')
      .select('chunk_text')
      .eq('brand_id', brandId)
      .limit(15);

    if (knowledgeChunks && knowledgeChunks.length > 0) {
      console.log(`[content-strategist] Found ${knowledgeChunks.length} knowledge chunks`);
      const context = knowledgeChunks.map((f: any) => f.chunk_text).join('\n\n');
      return { context, snippetCount: knowledgeChunks.length, fileCount: 0, charCount: context.length };
    }
    
    // Fallback: Use file summaries from brand_knowledge_files
    const { data: knowledgeFiles } = await client
      .from('brand_knowledge_files')
      .select('file_name, file_summary, file_type')
      .eq('brand_id', brandId)
      .not('file_summary', 'is', null)
      .limit(20);

    if (knowledgeFiles && knowledgeFiles.length > 0) {
      console.log(`[content-strategist] Using ${knowledgeFiles.length} file summaries`);
      const summaries = knowledgeFiles.map((f: any) => 
        `**${f.file_name}** (${f.file_type})\n${f.file_summary}`
      );
      const context = `## KNOWLEDGE BASE FILE SUMMARIES\n\n${summaries.join('\n\n---\n\n')}`;
      return { context, snippetCount: 0, fileCount: knowledgeFiles.length, charCount: context.length };
    }

    return emptyResult;
  } catch (error) {
    console.error('[content-strategist] Failed to collect brand knowledge context', error);
    return emptyResult;
  }
}

/**
 * Fetch brand analytics data for context
 */
async function collectBrandAnalyticsContext(client: any, brandId: string): Promise<string> {
  if (!brandId) return '';

  try {
    const { data: analyticsData } = await client
      .from('brand_analytics_data')
      .select('data_type, metrics, date_range_start, date_range_end, dimensions')
      .eq('brand_id', brandId)
      .order('date_range_end', { ascending: false })
      .limit(30);

    if (!analyticsData || analyticsData.length === 0) {
      console.log(`[content-strategist] No analytics data found for brand ${brandId}`);
      return '';
    }

    // Group analytics by data type and summarize
    const grouped: Record<string, any[]> = {};
    analyticsData.forEach((d: any) => {
      const type = d.data_type || 'unknown';
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(d);
    });

    const sections: string[] = [];
    
    for (const [type, records] of Object.entries(grouped)) {
      const summary = records.map((d: any) => {
        const metrics = d.metrics || {};
        const metricStr = Object.entries(metrics)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ');
        return `  - ${d.date_range_start} to ${d.date_range_end}: ${metricStr}`;
      }).join('\n');
      
      sections.push(`### ${type.replace(/_/g, ' ').toUpperCase()}\n${summary}`);
    }

    console.log(`[content-strategist] Found ${analyticsData.length} analytics records for brand`);
    return sections.join('\n\n');
  } catch (error) {
    console.error('[content-strategist] Failed to collect brand analytics context', error);
    return '';
  }
}

/**
 * Fetch brand KPIs for context
 */
async function collectBrandKPIsContext(client: any, brandId: string): Promise<string> {
  if (!brandId) return '';

  try {
    const { data: kpis } = await client
      .from('brand_kpis')
      .select('name, current_value, target_value, type, description, display_order')
      .eq('brand_id', brandId)
      .order('display_order', { ascending: true });

    if (!kpis || kpis.length === 0) {
      console.log(`[content-strategist] No KPIs found for brand ${brandId}`);
      return '';
    }

    const kpiLines = kpis.map((k: any) => {
      const progress = k.target_value ? Math.round((k.current_value / k.target_value) * 100) : null;
      const progressStr = progress !== null ? ` (${progress}% of target)` : '';
      const prefix = k.type === 'currency' ? '$' : '';
      const suffix = k.type === 'percentage' ? '%' : '';
      
      return `- **${k.name}**: ${prefix}${k.current_value}${suffix}${k.target_value ? ` → Target: ${prefix}${k.target_value}${suffix}` : ''}${progressStr}${k.description ? ` | ${k.description}` : ''}`;
    });

    console.log(`[content-strategist] Found ${kpis.length} KPIs for brand`);
    return `### BRAND KPIs\n${kpiLines.join('\n')}`;
  } catch (error) {
    console.error('[content-strategist] Failed to collect brand KPIs context', error);
    return '';
  }
}

/**
 * Fetch complete brand information
 */
async function collectBrandInfoContext(client: any, brandId: string): Promise<{ info: string; brandData: any }> {
  if (!brandId) return { info: '', brandData: null };

  try {
    const { data: brand } = await client
      .from('brands')
      .select('name, description, website_url, status, type, monthly_budget, active_integrations, team_members')
      .eq('id', brandId)
      .single();

    if (!brand) return { info: '', brandData: null };

    const lines = [
      `### BRAND INFORMATION`,
      `- **Name**: ${brand.name}`,
      `- **Description**: ${brand.description || 'No description'}`,
      `- **Website**: ${brand.website_url || 'Not set'}`,
      `- **Status**: ${brand.status}`,
      `- **Type**: ${brand.type || 'Not specified'}`,
      `- **Monthly Budget**: ${brand.monthly_budget ? `$${brand.monthly_budget}` : 'Not set'}`,
      `- **Active Integrations**: ${brand.active_integrations?.join(', ') || 'None'}`,
    ];

    console.log(`[content-strategist] Collected brand info for ${brand.name}`);
    return { info: lines.join('\n'), brandData: brand };
  } catch (error) {
    console.error('[content-strategist] Failed to collect brand info context', error);
    return { info: '', brandData: null };
  }
}

// ============== SYSTEM PROMPT ==============

const BASE_SYSTEM_PROMPT = `SYSTEM: You are the Content Strategist for SJ Innovation marketing inside Control Tower.
You analyze content from thought leaders, brand knowledge files, performance metrics, analytics, and KPIs to create compelling, data-driven content strategies.

CRITICAL INSTRUCTIONS:
1. Base ALL content strategies on the actual BRAND DATA provided below
2. Align hook angles with BRAND KPIs - if engagement is low, prioritize engagement-focused hooks
3. Use KNOWLEDGE BASE insights to inform content angles and messaging
4. Reference specific metrics from ANALYTICS in your recommendations when available
5. If analytics show certain content types perform better, weight those in your calendar

Goal: For each content source, produce 10 hook ideas, three full repurpose assets, and a suggested one-week calendar entry.

Rules:
1) For each content item produce:
   - hooks: 10 short lines, 1-2 lines each.
   - top_3: for the best three hooks include angle (one sentence), 30-second script, newsletter subject plus two preview lines, LinkedIn post and three hashtags.
   - calendar: one suggested publish date (within next 7 days), channel, and CTA.
2) Ensure at least three distinct content angles: story, data, how-to.
3) For each hook give a one-line reason why it may perform (reference brand data when possible).
4) Create engaging, authentic content that matches the leader's voice and brand identity.
5) Return JSON using the provided tool.`;

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

    const body: ContentStrategistRequest = await req.json().catch(() => ({}));
    const { brand_id, brand_ids, content_ids, leader_id, content_type, limit = 5, refinement_prompt } = body;
    
    // Support both single brand_id and brand_ids array
    const effectiveBrandIds = brand_id ? [brand_id] : brand_ids;

    console.log('[content-strategist] Starting content analysis for brand:', brand_id);

    // Track which data sources were used
    const dataSources: DataSourcesUsed = {
      knowledge_base: false,
      analytics: false,
      kpis: false,
      leader_uploads: false,
      performance_metrics: false,
      brand_info: false,
    };

    // ============== COLLECT ALL BRAND CONTEXT IN PARALLEL ==============
    let brandKnowledgeResult: BrandKnowledgeResult = { context: '', snippetCount: 0, fileCount: 0, charCount: 0 };
    let brandAnalytics = '';
    let brandKPIs = '';
    let brandInfo = { info: '', brandData: null as any };

    if (brand_id) {
      console.log('[content-strategist] Collecting comprehensive brand data...');
      
      const [knowledgeResult, analyticsResult, kpisResult, infoResult] = await Promise.all([
        collectBrandKnowledgeContext(supabase, brand_id),
        collectBrandAnalyticsContext(supabase, brand_id),
        collectBrandKPIsContext(supabase, brand_id),
        collectBrandInfoContext(supabase, brand_id),
      ]);

      brandKnowledgeResult = knowledgeResult;
      brandAnalytics = analyticsResult;
      brandKPIs = kpisResult;
      brandInfo = infoResult;

      // Track data sources
      dataSources.knowledge_base = brandKnowledgeResult.snippetCount > 0 || brandKnowledgeResult.fileCount > 0;
      dataSources.analytics = Boolean(brandAnalytics);
      dataSources.kpis = Boolean(brandKPIs);
      dataSources.brand_info = Boolean(brandInfo.info);

      console.log('[content-strategist] Brand data collected:', {
        knowledge: brandKnowledgeResult.charCount,
        analytics: brandAnalytics.length,
        kpis: brandKPIs.length,
        info: brandInfo.info.length,
      });
    }

    // ============== BUILD ENHANCED SYSTEM PROMPT ==============
    let enhancedSystemPrompt = BASE_SYSTEM_PROMPT;

    if (brandInfo.info) {
      enhancedSystemPrompt += `\n\n## BRAND CONTEXT (USE THIS DATA)\n${brandInfo.info}`;
    }

    if (brandKPIs) {
      enhancedSystemPrompt += `\n\n## BRAND KPIs (ALIGN CONTENT TO THESE GOALS)\n${brandKPIs}`;
    }

    if (brandAnalytics) {
      enhancedSystemPrompt += `\n\n## ANALYTICS INSIGHTS (BASE STRATEGIES ON REAL DATA)\n${brandAnalytics}`;
    }

    if (brandKnowledgeResult.context) {
      enhancedSystemPrompt += `\n\n## KNOWLEDGE BASE INSIGHTS\n${brandKnowledgeResult.context}`;
    }

    // Collect content sources
    const contentSources: any[] = [];

    // 1. Fetch leader uploads
    let uploadsQuery = supabase
      .from('leader_uploads')
      .select(`
        id, leader_id, file_name, file_url, file_type, file_summary,
        thought_leaders!inner(id, brand_id, name, title, department, linkedin_url, persona_tone, personal_context)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (content_ids && content_ids.length > 0) {
      uploadsQuery = uploadsQuery.in('id', content_ids);
    }

    if (leader_id) {
      uploadsQuery = uploadsQuery.eq('leader_id', leader_id);
    }

    if (content_type) {
      uploadsQuery = uploadsQuery.eq('file_type', content_type);
    }

    const { data: uploads, error: uploadsError } = await uploadsQuery;
    if (uploadsError) {
      console.error('[content-strategist] Uploads error:', uploadsError);
    }

    // Filter by brand if specified
    let filteredUploads = uploads || [];
    if (effectiveBrandIds && effectiveBrandIds.length > 0 && uploads) {
      filteredUploads = uploads.filter(u => {
        const leader = u.thought_leaders as any;
        return effectiveBrandIds.includes(leader?.brand_id);
      });
    }

    console.log('[content-strategist] Found', filteredUploads.length, 'leader uploads');
    dataSources.leader_uploads = filteredUploads.length > 0;

    // Add leader uploads to content sources
    for (const upload of filteredUploads) {
      const leader = upload.thought_leaders as any;
      contentSources.push({
        id: upload.id,
        type: 'leader_upload',
        title: upload.file_name,
        summary: upload.file_summary || 'No summary available',
        file_type: upload.file_type,
        leader: {
          name: leader?.name,
          title: leader?.title,
          department: leader?.department,
          tone: leader?.persona_tone,
          personal_context: leader?.personal_context,
        },
        leader_id: upload.leader_id,
      });
    }

    // 2. Fetch brand knowledge files if brand_id is provided (for content sources, not context)
    if (brand_id) {
      const { data: knowledgeFiles, error: knowledgeError } = await supabase
        .from('brand_knowledge_files')
        .select('id, file_name, file_summary, file_type')
        .eq('brand_id', brand_id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (knowledgeError) {
        console.error('[content-strategist] Knowledge files error:', knowledgeError);
      } else if (knowledgeFiles && knowledgeFiles.length > 0) {
        console.log('[content-strategist] Found', knowledgeFiles.length, 'brand knowledge files');
        for (const file of knowledgeFiles) {
          if (file.file_summary) {
            contentSources.push({
              id: file.id,
              type: 'brand_knowledge',
              title: file.file_name,
              summary: file.file_summary,
              file_type: file.file_type,
            });
          }
        }
      }
    }

    // If no content sources AND no brand data, return early
    const hasBrandData = Boolean(brandKnowledgeResult.context || brandAnalytics || brandKPIs || brandInfo.info);
    if (contentSources.length === 0 && !hasBrandData) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No content found to analyze. Upload content for thought leaders, add brand knowledge files, or connect analytics/KPIs.',
        content_outputs: []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Build brand data section for prompts
    const brandDataSection = `
${brandInfo.info ? `### BRAND INFORMATION:\n${brandInfo.info}\n` : ''}
${brandAnalytics ? `### BRAND ANALYTICS (Google Analytics):\n${brandAnalytics}\n` : ''}
${brandKPIs ? `### BRAND KPIs:\n${brandKPIs}\n` : ''}
${brandKnowledgeResult.context ? `### BRAND KNOWLEDGE BASE:\n${brandKnowledgeResult.context}\n` : ''}
`.trim();

    // If we have brand data but no content sources, generate brand-level strategy
    if (contentSources.length === 0 && hasBrandData) {
      console.log('[content-strategist] No content sources but have brand data, generating brand-level strategy');
      
      // Get Lovable API key for AI
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      const OPENAI_KEY = Deno.env.get('OPENAI_KEY');
      const apiKey = LOVABLE_API_KEY || OPENAI_KEY;
      const apiUrl = LOVABLE_API_KEY 
        ? 'https://ai.gateway.lovable.dev/v1/chat/completions'
        : 'https://api.openai.com/v1/chat/completions';

      if (!apiKey) {
        throw new Error('No AI API key configured (LOVABLE_API_KEY or OPENAI_KEY)');
      }

      // Define structured output tool for brand-level strategy
      const brandStrategyTool = {
        type: "function",
        function: {
          name: "generate_content_strategy",
          description: "Generate hooks, repurpose assets, and calendar for brand content",
          parameters: {
            type: "object",
            properties: {
              content_id: { type: "string" },
              content_title: { type: "string" },
              hooks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    text: { type: "string" },
                    performance_reason: { type: "string" }
                  },
                  required: ["text", "performance_reason"]
                },
                description: "10 hook ideas based on brand data"
              },
              top_3: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    hook: { type: "string" },
                    angle: { type: "string" },
                    script_30sec: { type: "string" },
                    newsletter_subject: { type: "string" },
                    newsletter_preview: { type: "string" },
                    linkedin_post: { type: "string" },
                    hashtags: { type: "array", items: { type: "string" } }
                  },
                  required: ["hook", "angle", "script_30sec", "newsletter_subject", "newsletter_preview", "linkedin_post", "hashtags"]
                },
                description: "Top 3 hooks with full repurpose assets"
              },
              calendar: {
                type: "object",
                properties: {
                  content_id: { type: "string" },
                  suggested_date: { type: "string" },
                  channel: { type: "string" },
                  cta: { type: "string" }
                },
                required: ["content_id", "suggested_date", "channel", "cta"]
              }
            },
            required: ["content_id", "content_title", "hooks", "top_3", "calendar"]
          }
        }
      };

      const brandStrategyPrompt = `You are a Content Strategist creating a comprehensive content strategy based on brand data.

${brandDataSection}

Based on this brand data, create a content strategy that includes:
1. 10 compelling content hooks based on the brand's analytics performance, KPIs, and knowledge base
2. Top 3 content angles with full repurpose assets (30-sec script, newsletter, LinkedIn post)
3. A suggested 7-day content calendar

Focus on:
- Topics that align with the brand's KPI goals and target metrics
- Content types that analytics show perform well (high engagement, impressions)
- Messaging consistent with the brand's knowledge base and values
- Actionable hooks that drive conversions

Generate hooks across different angles: story-driven, data-backed, how-to guides, and thought leadership.`;

      const now = new Date();
      const userPrompt = `Generate a brand-level content strategy for the next 7 days starting ${now.toISOString().split('T')[0]}.${refinement_prompt ? `

ADDITIONAL USER GUIDANCE:
${refinement_prompt}` : ''}`;

      console.log('[content-strategist] Calling AI for brand-level strategy...');

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: LOVABLE_API_KEY ? 'google/gemini-2.5-flash' : 'gpt-4o-mini',
          messages: [
            { role: 'system', content: brandStrategyPrompt },
            { role: 'user', content: userPrompt }
          ],
          tools: [brandStrategyTool],
          tool_choice: { type: "function", function: { name: "generate_content_strategy" } },
          max_tokens: 4096,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('[content-strategist] AI error for brand strategy:', error);
        throw new Error(`AI API error: ${error}`);
      }

      const aiData = await response.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      
      const contentOutputs: ContentOutput[] = [];
      
      if (toolCall) {
        try {
          const output = JSON.parse(toolCall.function.arguments);
          output.content_id = 'brand-strategy';
          output.content_title = `${brandInfo.brandData?.name || 'Brand'} Content Strategy`;
          contentOutputs.push(output);
          console.log('[content-strategist] Generated', output.hooks?.length || 0, 'hooks for brand-level strategy');
        } catch (parseError) {
          console.error('[content-strategist] Failed to parse AI output:', parseError);
        }
      }

      // Fetch the agent record
      const { data: agent } = await supabase
        .from('ai_agents')
        .select('id')
        .eq('slug', 'content-strategist')
        .single();

      // Store in ai_agent_runs
      const { data: runRecord, error: runError } = await supabase
        .from('ai_agent_runs')
        .insert({
          agent_id: agent?.id || null,
          executed_by: user.id,
          execution_context: { 
            brand_id: brand_id || null,
            brand_ids: effectiveBrandIds,
            leader_id: leader_id || null,
            content_type: content_type || null,
            content_count: contentOutputs.length,
            sources_analyzed: 0,
            strategy_type: 'brand-level',
            date: now.toISOString().split('T')[0],
          },
          ai_summary: {
            total_hooks_generated: contentOutputs.reduce((sum, o) => sum + (o.hooks?.length || 0), 0),
            total_assets_generated: contentOutputs.reduce((sum, o) => sum + (o.top_3?.length || 0), 0),
            content_items_processed: contentOutputs.length,
            strategy_type: 'brand-level',
          },
          generated_tasks: contentOutputs.flatMap(o => 
            o.top_3?.map((asset, i) => ({
              type: 'content',
              description: `Publish: ${asset.hook}`,
              priority: i === 0 ? 'high' : 'medium',
              channel: o.calendar?.channel || 'LinkedIn',
              scheduled_date: o.calendar?.suggested_date,
            })) || []
          ),
          status: 'completed',
          approval_status: 'pending',
          category: 'content_generation',
          title: `Brand Content Strategy - ${now.toISOString().split('T')[0]}`,
        })
        .select()
        .single();

      if (runError) {
        console.error('[content-strategist] Error saving run:', runError);
      }

      console.log('[content-strategist] Complete. Generated brand-level strategy with', contentOutputs.length, 'outputs');

      return new Response(JSON.stringify({
        success: true,
        run_id: runRecord?.id,
        content_outputs: contentOutputs,
        data_sources_used: dataSources,
        meta: {
          content_items_processed: contentOutputs.length,
          sources_analyzed: 0,
          strategy_type: 'brand-level',
          total_hooks: contentOutputs.reduce((sum, o) => sum + (o.hooks?.length || 0), 0),
          total_assets: contentOutputs.reduce((sum, o) => sum + (o.top_3?.length || 0), 0),
          brand_context: {
            knowledge_chars: brandKnowledgeResult.charCount,
            knowledge_snippets: brandKnowledgeResult.snippetCount,
            knowledge_files: brandKnowledgeResult.fileCount,
            analytics_chars: brandAnalytics.length,
            kpis_chars: brandKPIs.length,
          },
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch performance metrics for insights
    const leaderIds = [...new Set(filteredUploads.map(u => u.leader_id).filter(Boolean))];
    let metrics: any[] = [];
    if (leaderIds.length > 0) {
      const { data: metricsData } = await supabase
        .from('content_performance_metrics')
        .select('id, leader_id, post_id, post_type, hook_style, impressions, engagement_score, reach_count, audience, comment_quality_score, posted_date')
        .in('leader_id', leaderIds)
        .order('engagement_score', { ascending: false })
        .limit(50);
      metrics = metricsData || [];
      dataSources.performance_metrics = metrics.length > 0;
    }

    // Fetch recent generated posts for reference
    let recentPosts: any[] = [];
    if (leaderIds.length > 0) {
      const { data: postsData } = await supabase
        .from('generated_posts')
        .select('id, leader_id, post_title, post_body, source_type, generated_at')
        .in('leader_id', leaderIds)
        .order('generated_at', { ascending: false })
        .limit(20);
      recentPosts = postsData || [];
    }

    // Get Lovable API key for AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const OPENAI_KEY = Deno.env.get('OPENAI_KEY');
    const apiKey = LOVABLE_API_KEY || OPENAI_KEY;
    const apiUrl = LOVABLE_API_KEY 
      ? 'https://ai.gateway.lovable.dev/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';

    if (!apiKey) {
      throw new Error('No AI API key configured (LOVABLE_API_KEY or OPENAI_KEY)');
    }

    // Define structured output tool
    const contentStrategistTool = {
      type: "function",
      function: {
        name: "generate_content_strategy",
        description: "Generate hooks, repurpose assets, and calendar for content",
        parameters: {
          type: "object",
          properties: {
            content_id: { type: "string" },
            content_title: { type: "string" },
            hooks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  text: { type: "string" },
                  performance_reason: { type: "string" }
                },
                required: ["text", "performance_reason"]
              },
              description: "10 hook ideas"
            },
            top_3: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  hook: { type: "string" },
                  angle: { type: "string" },
                  script_30sec: { type: "string" },
                  newsletter_subject: { type: "string" },
                  newsletter_preview: { type: "string" },
                  linkedin_post: { type: "string" },
                  hashtags: { type: "array", items: { type: "string" } }
                },
                required: ["hook", "angle", "script_30sec", "newsletter_subject", "newsletter_preview", "linkedin_post", "hashtags"]
              },
              description: "Top 3 hooks with full repurpose assets"
            },
            calendar: {
              type: "object",
              properties: {
                content_id: { type: "string" },
                suggested_date: { type: "string" },
                channel: { type: "string" },
                cta: { type: "string" }
              },
              required: ["content_id", "suggested_date", "channel", "cta"]
            }
          },
          required: ["content_id", "content_title", "hooks", "top_3", "calendar"]
        }
      }
    };

    const contentOutputs: ContentOutput[] = [];
    const now = new Date();

    // Process content sources (limit to avoid timeout)
    const sourcesToProcess = contentSources.slice(0, 3);

    for (const source of sourcesToProcess) {
      // Build context for this content item
      const performanceInsights = source.leader_id 
        ? metrics.filter(m => m.leader_id === source.leader_id).slice(0, 5).map(m => ({
            hook_style: m.hook_style,
            engagement_score: m.engagement_score,
            impressions: m.impressions,
            audience: m.audience,
          }))
        : [];

      const relatedPosts = source.leader_id
        ? recentPosts.filter(p => p.leader_id === source.leader_id).slice(0, 3).map(p => ({
            title: p.post_title,
            body_preview: p.post_body?.substring(0, 200),
          }))
        : [];

      const contentContext = {
        content: {
          id: source.id,
          title: source.title,
          type: source.type,
          file_type: source.file_type,
          summary: source.summary,
        },
        leader: source.leader || null,
        performance_insights: performanceInsights,
        recent_posts: relatedPosts,
        suggested_publish_window: {
          start: now.toISOString().split('T')[0],
          end: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        }
      };

      const userPrompt = `Generate content strategy for this piece:

${JSON.stringify(contentContext, null, 2)}

Create 10 hooks (at least 3 distinct angles: story, data, how-to), expand the top 3 into full assets, and suggest a publish schedule.${refinement_prompt ? `

ADDITIONAL USER GUIDANCE:
${refinement_prompt}` : ''}`;

      console.log('[content-strategist] Processing content:', source.id, source.title);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: LOVABLE_API_KEY ? 'google/gemini-2.5-flash' : 'gpt-4o-mini',
          messages: [
            { role: 'system', content: enhancedSystemPrompt },
            { role: 'user', content: userPrompt }
          ],
          tools: [contentStrategistTool],
          tool_choice: { type: "function", function: { name: "generate_content_strategy" } },
          max_tokens: 4096,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('[content-strategist] AI error for content', source.id, ':', error);
        continue;
      }

      const aiData = await response.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      
      if (toolCall) {
        try {
          const output = JSON.parse(toolCall.function.arguments);
          contentOutputs.push(output);
          console.log('[content-strategist] Generated', output.hooks?.length || 0, 'hooks for', source.id);
        } catch (parseError) {
          console.error('[content-strategist] Failed to parse AI output:', parseError);
        }
      }
    }

    // Fetch the agent record
    const { data: agent } = await supabase
      .from('ai_agents')
      .select('id')
      .eq('slug', 'content-strategist')
      .single();

    // Store in ai_agent_runs
    const { data: runRecord, error: runError } = await supabase
      .from('ai_agent_runs')
      .insert({
        agent_id: agent?.id || null,
        executed_by: user.id,
        execution_context: { 
          brand_id: brand_id || null,
          brand_ids: effectiveBrandIds,
          leader_id: leader_id || null,
          content_type: content_type || null,
          content_count: contentOutputs.length,
          sources_analyzed: contentSources.length,
          date: now.toISOString().split('T')[0],
        },
        ai_summary: {
          total_hooks_generated: contentOutputs.reduce((sum, o) => sum + (o.hooks?.length || 0), 0),
          total_assets_generated: contentOutputs.reduce((sum, o) => sum + (o.top_3?.length || 0), 0),
          content_items_processed: contentOutputs.length,
        },
        generated_tasks: contentOutputs.flatMap(o => 
          o.top_3?.map((asset, i) => ({
            type: 'content',
            description: `Publish: ${asset.hook}`,
            priority: i === 0 ? 'high' : 'medium',
            channel: o.calendar?.channel || 'LinkedIn',
            scheduled_date: o.calendar?.suggested_date,
          })) || []
        ),
        status: 'completed',
        approval_status: 'pending',
        category: 'content_generation',
        title: `Content Strategy - ${now.toISOString().split('T')[0]}`,
      })
      .select()
      .single();

    if (runError) {
      console.error('[content-strategist] Error saving run:', runError);
    }

    console.log('[content-strategist] Complete. Generated strategies for', contentOutputs.length, 'content items');

    return new Response(JSON.stringify({
      success: true,
      run_id: runRecord?.id,
      content_outputs: contentOutputs,
      data_sources_used: dataSources,
      meta: {
        content_items_processed: contentOutputs.length,
        sources_analyzed: contentSources.length,
        total_hooks: contentOutputs.reduce((sum, o) => sum + (o.hooks?.length || 0), 0),
        total_assets: contentOutputs.reduce((sum, o) => sum + (o.top_3?.length || 0), 0),
        brand_context: {
          knowledge_chars: brandKnowledgeResult.charCount,
          knowledge_snippets: brandKnowledgeResult.snippetCount,
          knowledge_files: brandKnowledgeResult.fileCount,
          analytics_chars: brandAnalytics.length,
          kpis_chars: brandKPIs.length,
        },
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[content-strategist] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
