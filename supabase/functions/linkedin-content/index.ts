// Force redeploy - 2025-01-19 YouTube carousel support
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { buildAgentPrompt, generateWithGPT5 } from "./_helpers/gpt5.ts";
import { researchWithGemini, ResearchBrief } from "./_helpers/gemini-research.ts";
import { writeWithClaude } from "./_helpers/claude-writer.ts";
import { extractYouTubeContent, isValidYouTubeUrl, YouTubeExtraction } from "./_helpers/youtube-extractor.ts";

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

type ThoughtLeader = {
  id: string;
  name: string;
  title: string;
  department: string | null;
  linkedin_url: string | null;
  target_audience: Record<string, unknown> | string | null;
  persona_tone: string;
  default_prompt: string;
  guide_text: string | null;
};

type TrendTopic = {
  title: string;
  summary: string;
  score?: number;
};

type GeneratePostPayload = {
  sourceType: "trend" | "influencer" | "custom" | "youtube";
  sourceId?: string;
  youtubeUrl?: string;
  customContent?: string;
  headlineIdea?: string;
  callToAction?: string;
  selectedAgents?: string[];
};

type UpdatePostPayload = {
  postTitle?: string;
  postBody?: string;
  extraPayload?: Record<string, unknown>;
};

const allowedRoles = new Set(["super_admin", "manager", "pm"]);

const jsonResponse = (status: number, body: Record<string, unknown> | unknown[]) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const getResourceSegments = (url: URL) => {
  const segments = url.pathname.split("/").filter(Boolean);
  const functionIndex = segments.findIndex((segment) => segment === "linkedin-content");
  return functionIndex >= 0 ? segments.slice(functionIndex + 1) : [];
};

const getUserRole = async (client: SupabaseClient, userId: string) => {
  const { data, error } = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching user role:", error);
    return null;
  }

  return (data as any)?.role ?? null;
};

const ensureAuthorized = (role: string | null) => role !== null && allowedRoles.has(role);

const normalizeAudienceInput = (value: unknown) => {
  if (!value) return {};
  if (typeof value === "object") return value as Record<string, unknown>;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return {};
    try {
      return JSON.parse(trimmed);
    } catch (_) {
      return { description: trimmed };
    }
  }
  return {};
};

const safeJsonParse = (value: string) => {
  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn("Failed to parse JSON directly, attempting fallback", error);
    const firstBrace = value.indexOf("{");
    const lastBrace = value.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const slice = value.slice(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(slice);
      } catch (nestedError) {
        console.error("Fallback JSON parse failed", nestedError);
      }
    }
    return null;
  }
};

const formatAudience = (audience: ThoughtLeader["target_audience"]) => {
  if (!audience) return "General LinkedIn audience";
  if (typeof audience === "string") return audience;
  try {
    return Object.entries(audience)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(", ");
  } catch (error) {
    console.error("Failed to format audience", error);
    return JSON.stringify(audience);
  }
};

const computeWeekStart = () => {
  const now = new Date();
  const utcDay = now.getUTCDay();
  const diff = (utcDay + 6) % 7; // Monday as start of week
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff));
  return monday.toISOString().slice(0, 10);
};

const fetchLeader = async (client: SupabaseClient, leaderId: string) => {
  const { data, error } = await client
    .from("thought_leaders")
    .select("*")
    .eq("id", leaderId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Leader not found");
  }

  return data as ThoughtLeader;
};

const buildPerplexityPrompt = async (
  client: SupabaseClient,
  leader: ThoughtLeader,
  userId: string
): Promise<{ prompt: string; model: string; temperature: number; max_tokens: number }> => {
  // Fetch user's custom settings
  const { data: settings } = await client
    .from('perplexity_settings')
    .select('default_prompt, model, temperature, max_tokens')
    .eq('user_id', userId)
    .maybeSingle();

  const promptTemplate = (settings as any)?.default_prompt || 
    `Find the top 5 trending LinkedIn topics this week for {audience}. Explain why each topic resonates with the audience and how {leader_name} could add insight. Respond with JSON using the structure {"topics": [{"title": string, "summary": string, "score": number}]}.`;

  const audience = formatAudience(leader.target_audience);
  
  // Replace placeholders
  const finalPrompt = promptTemplate
    .replace(/{audience}/g, audience)
    .replace(/{leader_name}/g, leader.name)
    .replace(/{leader_title}/g, leader.title);

  return {
    prompt: finalPrompt,
    model: (settings as any)?.model || 'sonar',
    temperature: (settings as any)?.temperature ?? 0.4,
    max_tokens: (settings as any)?.max_tokens || 1000
  };
};

const callPerplexity = async (
  client: SupabaseClient,
  leader: ThoughtLeader,
  userId: string
): Promise<TrendTopic[]> => {
  const apiKey = Deno.env.get("PERPLEXITY_API_KEY");
  if (!apiKey) {
    throw new Error("PERPLEXITY_API_KEY not configured");
  }

  const { prompt: userPrompt, model, temperature, max_tokens } = await buildPerplexityPrompt(
    client,
    leader,
    userId
  );

  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: "system",
          content:
            "You are a LinkedIn trend analyst. Respond with concise JSON summaries suitable for marketing teams.",
        },
        { role: "user", content: userPrompt },
      ],
      temperature: temperature,
      max_tokens: max_tokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Perplexity API error:", errorText);
    throw new Error(`Perplexity API request failed with status ${response.status}`);
  }

  const data = await response.json();
  const rawContent: string | undefined = data?.choices?.[0]?.message?.content;
  if (!rawContent) {
    throw new Error("Perplexity response did not contain content");
  }

  const parsed = safeJsonParse(rawContent);
  const topics = Array.isArray(parsed?.topics) ? parsed.topics : Array.isArray(parsed) ? parsed : [];

  return (topics as any[])
    .map((topic) => ({
      title: String(topic.title ?? topic.heading ?? ""),
      summary: String(topic.summary ?? topic.description ?? ""),
      score: topic.score !== undefined ? Number(topic.score) : topic.relevance_score ? Number(topic.relevance_score) : undefined,
    }))
    .filter((topic) => topic.title && topic.summary)
    .slice(0, 5);
};

// Pipeline configuration type
type AIPipelineConfig = {
  use_dual_model?: boolean;
  research_model?: 'gemini' | 'perplexity';
  writing_model?: 'claude' | 'gpt5';
  research_depth?: 'quick' | 'standard' | 'deep';
};

const callOpenAIForPost = async (
  client: any,
  leader: ThoughtLeader & { ai_pipeline_config?: AIPipelineConfig },
  payload: GeneratePostPayload,
  sourceDetails: { title: string; body: string },
  externalClient?: any,
  selectedAgents?: string[]
) => {
  // Get pipeline configuration
  const pipelineConfig: AIPipelineConfig = (leader as any).ai_pipeline_config || {
    use_dual_model: true,
    research_model: 'gemini',
    writing_model: 'claude',
    research_depth: 'standard'
  };

  let researchBrief: ResearchBrief | null = null;
  let researchModel = 'none';
  let writingModel = 'gpt-4o-mini';

  const sourceDetail = `Source: ${sourceDetails.title}\n${sourceDetails.body}\n${payload.headlineIdea ? `Headline: ${payload.headlineIdea}` : ''}\n${payload.callToAction ? `CTA: ${payload.callToAction}` : ''}`;

  // Stage 1: Research (if dual-model is enabled)
  if (pipelineConfig.use_dual_model !== false) {
    console.log("📚 Stage 1: Researching with Gemini...");
    try {
      researchBrief = await researchWithGemini(
        (leader as any).niche_keyword || "AI",
        (leader as any).niche_domain || "business",
        `${sourceDetails.title}\n${sourceDetails.body}`,
        pipelineConfig.research_depth || 'standard'
      );
      researchModel = researchBrief.sources_summary.includes('unavailable') 
        ? 'none' 
        : `google/gemini-2.5-${pipelineConfig.research_depth === 'deep' ? 'pro' : 'flash'}`;
    } catch (error) {
      console.warn("⚠️ Research stage failed, continuing without research:", error);
    }
  }
  
  // Build prompts with research brief
  const { systemPrompt, userPrompt } = await buildAgentPrompt(
    client,
    leader,
    sourceDetail,
    externalClient,
    selectedAgents,
    researchBrief || undefined
  );

  // Stage 2: Writing
  console.log("✍️ Stage 2: Writing post...");
  let result;

  if (pipelineConfig.writing_model === 'claude') {
    // Use Claude with automatic GPT-5 fallback
    result = await writeWithClaude(researchBrief, systemPrompt, userPrompt);
    writingModel = result.model_used;
  } else {
    // Direct GPT-5 path
    const gpt5Result = await generateWithGPT5(systemPrompt, userPrompt);
    result = {
      post_title: gpt5Result.post_title,
      post_body: gpt5Result.post_body,
      post_type: gpt5Result.post_type,
      carousel_outline: gpt5Result.carousel_outline,
      caption_ideas: gpt5Result.caption_ideas,
      model_used: 'gpt-4o-mini'
    };
    writingModel = 'gpt-4o-mini';
  }

  return {
    post_title: result.post_title,
    post_body: result.post_body,
    extra_payload: {
      carousel_outline: result.carousel_outline,
      caption_ideas: result.caption_ideas,
      post_type: result.post_type,
      generated_with_template: !!(leader as any).agent_template_id,
      selected_agents: selectedAgents || [],
      // New dual-model metadata
      research_brief: researchBrief,
      models_used: {
        research: researchModel,
        writing: writingModel
      },
      pipeline_config: pipelineConfig,
    },
  };
};

const getSourceContext = async (
  client: SupabaseClient,
  leaderId: string,
  payload: GeneratePostPayload,
): Promise<{ title: string; body: string; youtubeExtraction?: YouTubeExtraction }> => {
  if (payload.sourceType === "trend") {
    if (!payload.sourceId) throw new Error("sourceId is required for trend-based generation");
    const { data, error } = await client
      .from("weekly_trends")
      .select("id, topic_title, topic_summary")
      .eq("id", payload.sourceId)
      .eq("leader_id", leaderId)
      .maybeSingle();

    if (error || !data) {
      throw new Error("Trend context not found for leader");
    }

    return { title: (data as any).topic_title, body: (data as any).topic_summary };
  }

  if (payload.sourceType === "influencer") {
    if (!payload.sourceId) throw new Error("sourceId is required for influencer-based generation");
    const { data, error } = await client
      .from("leader_uploads")
      .select("id, file_name, file_summary, file_url")
      .eq("id", payload.sourceId)
      .eq("leader_id", leaderId)
      .maybeSingle();

    if (error || !data) {
      throw new Error("Influencer reference not found for leader");
    }

    const summary = (data as any).file_summary
      ? (data as any).file_summary
      : `Reference document available at ${(data as any).file_url}`;

    return { title: (data as any).file_name, body: summary };
  }

  // YouTube source type - extract content from video
  if (payload.sourceType === "youtube") {
    const url = payload.youtubeUrl?.trim();
    if (!url) {
      throw new Error("youtubeUrl is required for YouTube-based generation");
    }
    
    if (!isValidYouTubeUrl(url)) {
      throw new Error("Invalid YouTube URL format");
    }

    console.log("🎬 Extracting content from YouTube video...");
    const extraction = await extractYouTubeContent(url, {
      depth: 'standard',
      additionalContext: payload.headlineIdea || payload.callToAction 
        ? `Additional guidance: ${payload.headlineIdea || ''} ${payload.callToAction || ''}`.trim()
        : undefined
    });

    // Return both the extraction and a summary for the post generation
    const body = `
## Video: ${extraction.video_metadata.title}
**Channel:** ${extraction.video_metadata.channel}

## Core Message
${extraction.extraction.core_thesis}

## Key Data Points
${extraction.extraction.key_data.map(d => `- ${d}`).join('\n')}

## Golden Quotes
${extraction.extraction.golden_quotes.map(q => `> "${q}"`).join('\n\n')}

## Framework
${extraction.extraction.framework}
    `.trim();

    return { 
      title: `Carousel: ${extraction.video_metadata.title}`, 
      body,
      youtubeExtraction: extraction
    };
  }

  const custom = payload.customContent?.trim();
  if (!custom) {
    throw new Error("customContent is required when sourceType is custom");
  }

  return { title: payload.headlineIdea ?? "Custom insight", body: custom };
};

const toLeaderResponse = (record: any) => ({
  id: record.id,
  name: record.name,
  title: record.title,
  department: record.department,
  linkedin_url: record.linkedin_url,
  target_audience: record.target_audience,
  persona_tone: record.persona_tone,
  default_prompt: record.default_prompt,
  guide_text: record.guide_text,
  agent_template_id: record.agent_template_id,
  personal_context: record.personal_context,
  style_overrides: record.style_overrides,
  target_client_segments: record.target_client_segments,
  url_slug: record.url_slug,
  created_at: record.created_at,
  updated_at: record.updated_at,
  upload_count: Array.isArray(record.leader_uploads) && record.leader_uploads.length > 0 ? record.leader_uploads[0]?.count ?? 0 : 0,
  trend_count: Array.isArray(record.weekly_trends) && record.weekly_trends.length > 0 ? record.weekly_trends[0]?.count ?? 0 : 0,
  generated_post_count: Array.isArray(record.generated_posts) && record.generated_posts.length > 0 ? record.generated_posts[0]?.count ?? 0 : 0,
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(401, { error: "Missing authorization header" });
    }

    const token = authHeader.replace("Bearer", "").trim();
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return jsonResponse(401, { error: "Invalid authentication" });
    }

    const role = await getUserRole(supabaseClient, user.id);
    if (!ensureAuthorized(role)) {
      return jsonResponse(403, { error: "Insufficient privileges" });
    }

    const url = new URL(req.url);
    const resourceSegments = getResourceSegments(url);
    const method = req.method;

    if (resourceSegments.length === 0) {
      return jsonResponse(404, { error: "Endpoint not found" });
    }

    if (resourceSegments[0] !== "leaders") {
      return jsonResponse(404, { error: "Unsupported resource" });
    }

    // /leaders
    if (resourceSegments.length === 1) {
      if (method === "GET") {
        const { data, error } = await supabaseClient
          .from("thought_leaders")
          .select(
            "*, leader_uploads(count), weekly_trends(count), generated_posts(count)",
          )
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Failed to load leaders", error);
          return jsonResponse(400, { error: error.message });
        }

        const leaders = (data ?? []).map(toLeaderResponse);
        return jsonResponse(200, { leaders });
      }

      if (method === "POST") {
        const body = await req.json().catch(() => null) as Record<string, unknown> | null;
        if (!body) {
          return jsonResponse(400, { error: "Invalid JSON payload" });
        }

        const name = String(body.name ?? "").trim();
        const title = String(body.title ?? "").trim();
        const personaTone = String(body.personaTone ?? body.persona_tone ?? "").trim();
        const defaultPrompt = String(body.defaultPrompt ?? body.default_prompt ?? "").trim();

        if (!name || !title || !personaTone || !defaultPrompt) {
          return jsonResponse(400, { error: "name, title, personaTone, and defaultPrompt are required" });
        }

        const insertPayload = {
          name,
          title,
          department: body.department ? String(body.department) : null,
          linkedin_url: body.linkedinUrl ? String(body.linkedinUrl) : body.linkedin_url ? String(body.linkedin_url) : null,
          target_audience: normalizeAudienceInput(body.targetAudience ?? body.target_audience),
          persona_tone: personaTone,
          default_prompt: defaultPrompt,
          guide_text: body.guideText ? String(body.guideText) : body.guide_text ? String(body.guide_text) : null,
        };

        const { data, error } = await supabaseClient
          .from("thought_leaders")
          .insert(insertPayload)
          .select()
          .single();

        if (error) {
          console.error("Failed to create leader", error);
          return jsonResponse(400, { error: error.message });
        }

        return jsonResponse(201, { leader: toLeaderResponse(data) });
      }

      return jsonResponse(405, { error: "Method not allowed" });
    }

    const leaderId = resourceSegments[1];
    if (!leaderId) {
      return jsonResponse(400, { error: "Leader ID is required" });
    }

    // /leaders/:leaderId
    if (resourceSegments.length === 2) {
      if (method === "PUT") {
        const body = await req.json().catch(() => null) as Record<string, unknown> | null;
        if (!body) {
          return jsonResponse(400, { error: "Invalid JSON payload" });
        }

        const updatePayload: Record<string, unknown> = {};

        if (body.name !== undefined) updatePayload.name = String(body.name);
        if (body.title !== undefined) updatePayload.title = String(body.title);
        if (body.department !== undefined) updatePayload.department = body.department ? String(body.department) : null;
        if (body.linkedinUrl !== undefined || body.linkedin_url !== undefined) {
          const urlValue = body.linkedinUrl ?? body.linkedin_url;
          updatePayload.linkedin_url = urlValue ? String(urlValue) : null;
        }
        if (body.targetAudience !== undefined || body.target_audience !== undefined) {
          const audienceValue = body.targetAudience ?? body.target_audience;
          updatePayload.target_audience = normalizeAudienceInput(audienceValue);
        }
        if (body.personaTone !== undefined || body.persona_tone !== undefined) {
          updatePayload.persona_tone = String(body.personaTone ?? body.persona_tone);
        }
        if (body.defaultPrompt !== undefined || body.default_prompt !== undefined) {
          updatePayload.default_prompt = String(body.defaultPrompt ?? body.default_prompt);
        }
        if (body.guideText !== undefined || body.guide_text !== undefined) {
          const guide = body.guideText ?? body.guide_text;
          updatePayload.guide_text = guide ? String(guide) : null;
        }

        const { data, error } = await supabaseClient
          .from("thought_leaders")
          .update(updatePayload)
          .eq("id", leaderId)
          .select()
          .single();

        if (error) {
          console.error("Failed to update leader", error);
          return jsonResponse(400, { error: error.message });
        }

        return jsonResponse(200, { leader: toLeaderResponse(data) });
      }

      if (method === "DELETE") {
        const { error } = await supabaseClient
          .from("thought_leaders")
          .delete()
          .eq("id", leaderId);

        if (error) {
          console.error("Failed to delete leader", error);
          return jsonResponse(400, { error: error.message });
        }

        return jsonResponse(200, { success: true });
      }

      if (method === "GET") {
        const { data, error } = await supabaseClient
          .from("thought_leaders")
          .select(
            "*, leader_uploads(count), weekly_trends(count), generated_posts(count)",
          )
          .eq("id", leaderId)
          .maybeSingle();

        if (error || !data) {
          return jsonResponse(404, { error: "Leader not found" });
        }

        return jsonResponse(200, { leader: toLeaderResponse(data) });
      }

      return jsonResponse(405, { error: "Method not allowed" });
    }

    const subResource = resourceSegments[2];

    if (subResource === "uploads") {
      if (resourceSegments.length === 3) {
        if (method === "GET") {
          const { data, error } = await supabaseClient
            .from("leader_uploads")
            .select("*")
            .eq("leader_id", leaderId)
            .order("created_at", { ascending: false });

          if (error) {
            console.error("Failed to load uploads", error);
            return jsonResponse(400, { error: error.message });
          }

          return jsonResponse(200, { uploads: data ?? [] });
        }

        if (method === "POST") {
          const body = await req.json().catch(() => null) as Record<string, unknown> | null;
          if (!body) {
            return jsonResponse(400, { error: "Invalid JSON payload" });
          }

          const fileName = String(body.fileName ?? body.file_name ?? "").trim();
          const fileUrl = String(body.fileUrl ?? body.file_url ?? "").trim();
          const fileSummary = body.fileSummary ?? body.file_summary;

          if (!fileName || !fileUrl) {
            return jsonResponse(400, { error: "fileName and fileUrl are required" });
          }

          const insertPayload = {
            leader_id: leaderId,
            file_name: fileName,
            file_url: fileUrl,
            file_summary: fileSummary ? String(fileSummary) : null,
          };

          const { data, error } = await supabaseClient
            .from("leader_uploads")
            .insert(insertPayload)
            .select()
            .single();

          if (error) {
            console.error("Failed to save upload", error);
            return jsonResponse(400, { error: error.message });
          }

          return jsonResponse(201, { upload: data });
        }

        return jsonResponse(405, { error: "Method not allowed" });
      }

      if (resourceSegments.length === 4 && method === "DELETE") {
        const uploadId = resourceSegments[3];
        const { error } = await supabaseClient
          .from("leader_uploads")
          .delete()
          .eq("id", uploadId)
          .eq("leader_id", leaderId);

        if (error) {
          console.error("Failed to delete upload", error);
          return jsonResponse(400, { error: error.message });
        }

        return jsonResponse(200, { success: true });
      }

      return jsonResponse(405, { error: "Method not allowed" });
    }

    if (subResource === "trends") {
      if (resourceSegments.length === 3) {
        if (method === "GET") {
          const weekStart = url.searchParams.get("weekStart");
          let query = supabaseClient
            .from("weekly_trends")
            .select("*")
            .eq("leader_id", leaderId)
            .order("created_at", { ascending: false });

          if (weekStart) {
            query = query.eq("week_start", weekStart);
          }

          const { data, error } = await query;

          if (error) {
            console.error("Failed to load trends", error);
            return jsonResponse(400, { error: error.message });
          }

          return jsonResponse(200, { trends: data ?? [] });
        }

        if (method === "POST") {
          const leader = await fetchLeader(supabaseClient, leaderId);
          const topics = await callPerplexity(supabaseClient, leader, user.id);
          const weekStart = computeWeekStart();

          if (topics.length === 0) {
            return jsonResponse(500, { error: "No topics returned from Perplexity" });
          }

          await supabaseClient
            .from("weekly_trends")
            .delete()
            .eq("leader_id", leaderId)
            .eq("week_start", weekStart);

          const insertPayload = topics.map((topic) => ({
            leader_id: leaderId,
            week_start: weekStart,
            topic_title: topic.title,
            topic_summary: topic.summary,
            relevance_score: topic.score ?? null,
          }));

          const { data, error } = await supabaseClient
            .from("weekly_trends")
            .insert(insertPayload)
            .select()
            .order("created_at", { ascending: true });

          if (error) {
            console.error("Failed to store weekly trends", error);
            return jsonResponse(400, { error: error.message });
          }

          return jsonResponse(201, { trends: data ?? [] });
        }

        return jsonResponse(405, { error: "Method not allowed" });
      }

      return jsonResponse(405, { error: "Method not allowed" });
    }

    if (subResource === "posts") {
      if (resourceSegments.length === 3) {
        if (method === "GET") {
          const { data, error } = await supabaseClient
            .from("generated_posts")
            .select("*")
            .eq("leader_id", leaderId)
            .order("generated_at", { ascending: false });

          if (error) {
            console.error("Failed to load generated posts", error);
            return jsonResponse(400, { error: error.message });
          }

          return jsonResponse(200, { posts: data ?? [] });
        }

        if (method === "POST") {
          const body = await req.json().catch(() => null) as GeneratePostPayload | null;
          if (!body) {
            return jsonResponse(400, { error: "Invalid JSON payload" });
          }

          const payload: GeneratePostPayload = {
            sourceType: body.sourceType,
            sourceId: body.sourceId,
            customContent: body.customContent,
            headlineIdea: body.headlineIdea,
            callToAction: body.callToAction,
            selectedAgents: body.selectedAgents,
          };

          if (!payload.sourceType || !["trend", "influencer", "custom"].includes(payload.sourceType)) {
            return jsonResponse(400, { error: "Invalid sourceType" });
          }

          const leader = await fetchLeader(supabaseClient, leaderId);
          const sourceDetails = await getSourceContext(supabaseClient, leaderId, payload);
          
          // Initialize external Supabase client if agents are selected
          let externalClient = null;
          if (payload.selectedAgents && payload.selectedAgents.length > 0) {
            const externalUrl = Deno.env.get("EXTERNAL_SOLUTIONS_DB_URL");
            const externalKey = Deno.env.get("EXTERNAL_SOLUTIONS_DB_ANON_KEY");
            
            if (externalUrl && externalKey) {
              externalClient = createClient(externalUrl, externalKey);
            } else {
              console.warn('External Supabase credentials not configured for agents');
            }
          }
          
          const generated = await callOpenAIForPost(
            supabaseClient,
            leader,
            payload,
            sourceDetails,
            externalClient,
            payload.selectedAgents
          );

          const insertPayload = {
            leader_id: leaderId,
            source_type: payload.sourceType,
            source_reference: payload.sourceId ?? null,
            post_title: generated.post_title,
            post_body: generated.post_body,
            extra_payload: generated.extra_payload,
          };

          const { data, error } = await supabaseClient
            .from("generated_posts")
            .insert(insertPayload)
            .select()
            .single();

          if (error) {
            console.error("Failed to store generated post", error);
            return jsonResponse(400, { error: error.message });
          }

          // Store agent references
          if (payload.selectedAgents && payload.selectedAgents.length > 0 && externalClient) {
            const { data: agentDetails } = await externalClient
              .from('agents')
              .select('id, name, summary')
              .in('id', payload.selectedAgents);
            
            if (agentDetails && agentDetails.length > 0) {
              const references = agentDetails.map(agent => ({
                post_id: data.id,
                external_agent_id: agent.id,
                agent_name: agent.name,
                agent_summary: agent.summary,
              }));
              
              await supabaseClient.from('post_agent_references').insert(references);
            }
          }

          return jsonResponse(201, { post: data });
        }

        return jsonResponse(405, { error: "Method not allowed" });
      }

      if (resourceSegments.length === 4 && method === "PUT") {
        const postId = resourceSegments[3];
        const body = await req.json().catch(() => null) as UpdatePostPayload | null;
        if (!body) {
          return jsonResponse(400, { error: "Invalid JSON payload" });
        }

        const updatePayload: Record<string, unknown> = {};
        if (body.postTitle !== undefined) updatePayload.post_title = body.postTitle;
        if (body.postBody !== undefined) updatePayload.post_body = body.postBody;
        if (body.extraPayload !== undefined) updatePayload.extra_payload = body.extraPayload;

        if (Object.keys(updatePayload).length === 0) {
          return jsonResponse(400, { error: "No fields provided for update" });
        }

        const { data, error } = await supabaseClient
          .from("generated_posts")
          .update(updatePayload)
          .eq("id", postId)
          .eq("leader_id", leaderId)
          .select()
          .single();

        if (error) {
          console.error("Failed to update generated post", error);
          return jsonResponse(400, { error: error.message });
        }

        return jsonResponse(200, { post: data });
      }

      if (resourceSegments.length === 4 && method === "DELETE") {
        const postId = resourceSegments[3];
        
        const { error } = await supabaseClient
          .from("generated_posts")
          .delete()
          .eq("id", postId)
          .eq("leader_id", leaderId);

        if (error) {
          console.error("Failed to delete generated post", error);
          return jsonResponse(400, { error: error.message });
        }

        return jsonResponse(200, { success: true });
      }

      return jsonResponse(405, { error: "Method not allowed" });
    }

    return jsonResponse(404, { error: "Unsupported endpoint" });
  } catch (error) {
    console.error("Unhandled error in linkedin-content function", error);
    return jsonResponse(500, { error: error instanceof Error ? error.message : "Internal server error" });
  }
});
