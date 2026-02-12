import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Extended CORS headers to allow x-api-key
const apiCorsHeaders = {
  ...corsHeaders,
  "Access-Control-Allow-Headers":
    corsHeaders["Access-Control-Allow-Headers"] + ", x-api-key",
};

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 100;
const MAX_DATE_RANGE_DAYS = 90;
const DEFAULT_DATE_RANGE_DAYS = 30;
const CACHE_TTL_MS = 60_000;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const QUERY_TIMEOUT_MS = 10_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_ACTIONS = [
  "ai-usage",
  "content-performance",
  "brand-analytics",
  "image-generation",
  "video-generation",
  "keywords",
  "integration-health",
] as const;

type Action = (typeof VALID_ACTIONS)[number];

// ─── Types ───────────────────────────────────────────────────────────────────

interface ApiKeyRecord {
  id: string;
  key_name: string;
  is_active: boolean;
  rate_limit_per_minute: number;
  allowed_actions: string[];
}

interface DateRange {
  date_start: string;
  date_end: string;
}

interface Pagination {
  limit: number;
  offset: number;
}

// ─── Supabase Client ─────────────────────────────────────────────────────────

function getServiceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase env vars not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function hashApiKey(raw: string): Promise<string> {
  const data = new TextEncoder().encode(raw);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function validateUUID(value: string | undefined, name: string): void {
  if (value !== undefined && !UUID_RE.test(value)) {
    throw { status: 400, message: `Invalid UUID for ${name}: ${value}` };
  }
}

function sanitizePagination(params: {
  limit?: number;
  offset?: number;
}): Pagination {
  let limit = Number(params.limit) || DEFAULT_LIMIT;
  if (limit < 1) limit = 1;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  let offset = Number(params.offset) || 0;
  if (offset < 0) offset = 0;

  return { limit, offset };
}

function sanitizeDateRange(params: {
  date_start?: string;
  date_end?: string;
}): DateRange {
  const now = new Date();
  const dateEnd = params.date_end ? new Date(params.date_end) : now;
  const dateStart = params.date_start
    ? new Date(params.date_start)
    : new Date(dateEnd.getTime() - DEFAULT_DATE_RANGE_DAYS * 86400000);

  // Cap max range
  const maxStart = new Date(
    dateEnd.getTime() - MAX_DATE_RANGE_DAYS * 86400000
  );
  const effectiveStart = dateStart < maxStart ? maxStart : dateStart;

  return {
    date_start: effectiveStart.toISOString(),
    date_end: dateEnd.toISOString(),
  };
}

// ─── Response Cache ──────────────────────────────────────────────────────────

const responseCache = new Map<string, { data: string; expires: number }>();

function getCacheKey(
  action: string,
  params: Record<string, unknown>,
  keyId: string
): string {
  const sortedParams = JSON.stringify(params, Object.keys(params).sort());
  return `${keyId}:${action}:${sortedParams}`;
}

function getCached(key: string): string | null {
  const entry = responseCache.get(key);
  if (!entry || entry.expires < Date.now()) {
    responseCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: string) {
  if (responseCache.size > 1000) {
    const firstKey = responseCache.keys().next().value;
    if (firstKey) responseCache.delete(firstKey);
  }
  responseCache.set(key, { data, expires: Date.now() + CACHE_TTL_MS });
}

// ─── Response Builder ────────────────────────────────────────────────────────

function buildResponse(
  body: Record<string, unknown>,
  status = 200
): Response {
  const json = JSON.stringify(body);
  if (json.length > MAX_RESPONSE_BYTES) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Response too large. Narrow your filters or reduce limit.",
        size_bytes: json.length,
        max_bytes: MAX_RESPONSE_BYTES,
      }),
      {
        status: 413,
        headers: { ...apiCorsHeaders, "Content-Type": "application/json" },
      }
    );
  }
  return new Response(json, {
    status,
    headers: { ...apiCorsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(
  status: number,
  message: string,
  extra?: Record<string, unknown>
): Response {
  return buildResponse({ ok: false, error: message, ...extra }, status);
}

// ─── Query with Timeout ──────────────────────────────────────────────────────

function createAbortController(): { controller: AbortController; clear: () => void } {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS);
  return {
    controller,
    clear: () => clearTimeout(timeout),
  };
}

// ─── Action Handlers ─────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

async function handleAiUsage(
  supabase: SupabaseClient,
  params: Record<string, unknown>,
  dateRange: DateRange,
  pagination: Pagination
) {
  if (params.agent_id) validateUUID(params.agent_id as string, "agent_id");

  const { controller, clear } = createAbortController();
  try {
    let query = supabase
      .from("ai_agent_runs")
      .select(
        "id, agent_id, total_tokens, prompt_tokens, completion_tokens, cost_usd, model_provider, model_version, execution_time_ms, status, created_at, ai_agents(name, category)",
        { count: "exact" }
      )
      .gte("created_at", dateRange.date_start)
      .lte("created_at", dateRange.date_end)
      .order("created_at", { ascending: false })
      .range(pagination.offset, pagination.offset + pagination.limit - 1)
      .abortSignal(controller.signal);

    if (params.agent_id) query = query.eq("agent_id", params.agent_id);

    const { data, error, count } = await query;
    if (error) throw error;

    // Compute aggregates
    let aggQuery = supabase
      .from("ai_agent_runs")
      .select(
        "cost_usd, total_tokens, execution_time_ms",
        { count: "exact", head: false }
      )
      .gte("created_at", dateRange.date_start)
      .lte("created_at", dateRange.date_end)
      .abortSignal(controller.signal);

    if (params.agent_id) aggQuery = aggQuery.eq("agent_id", params.agent_id);

    const { data: aggData, error: aggError, count: totalRuns } = await aggQuery;
    if (aggError) throw aggError;

    const aggregates = {
      total_runs: totalRuns ?? 0,
      total_cost_usd: 0,
      total_tokens: 0,
      avg_execution_time_ms: 0,
    };

    if (aggData && aggData.length > 0) {
      let totalCost = 0;
      let totalTokens = 0;
      let totalExecTime = 0;
      let execCount = 0;
      for (const row of aggData) {
        totalCost += Number(row.cost_usd) || 0;
        totalTokens += Number(row.total_tokens) || 0;
        if (row.execution_time_ms) {
          totalExecTime += Number(row.execution_time_ms);
          execCount++;
        }
      }
      aggregates.total_cost_usd = Math.round(totalCost * 10000) / 10000;
      aggregates.total_tokens = totalTokens;
      aggregates.avg_execution_time_ms = execCount > 0
        ? Math.round(totalExecTime / execCount)
        : 0;
    }

    // Flatten joined data
    const rows = (data ?? []).map((r: Record<string, unknown>) => {
      const agent = r.ai_agents as Record<string, unknown> | null;
      return {
        id: r.id,
        agent_id: r.agent_id,
        agent_name: agent?.name ?? null,
        agent_category: agent?.category ?? null,
        total_tokens: r.total_tokens,
        prompt_tokens: r.prompt_tokens,
        completion_tokens: r.completion_tokens,
        cost_usd: r.cost_usd,
        model_provider: r.model_provider,
        model_version: r.model_version,
        execution_time_ms: r.execution_time_ms,
        status: r.status,
        created_at: r.created_at,
      };
    });

    return {
      data: rows,
      aggregates,
      pagination: {
        limit: pagination.limit,
        offset: pagination.offset,
        has_more: (count ?? 0) > pagination.offset + pagination.limit,
        max_limit: MAX_LIMIT,
      },
    };
  } finally {
    clear();
  }
}

async function handleContentPerformance(
  supabase: SupabaseClient,
  params: Record<string, unknown>,
  dateRange: DateRange,
  pagination: Pagination
) {
  if (params.leader_id)
    validateUUID(params.leader_id as string, "leader_id");

  const { controller, clear } = createAbortController();
  try {
    let query = supabase
      .from("content_performance_metrics")
      .select(
        "id, leader_id, post_type, hook_style, impressions, engagement_score, reach_count, conversion_actions, audience, posted_date, thought_leaders(name)",
        { count: "exact" }
      )
      .gte("posted_date", dateRange.date_start)
      .lte("posted_date", dateRange.date_end)
      .order("posted_date", { ascending: false })
      .range(pagination.offset, pagination.offset + pagination.limit - 1)
      .abortSignal(controller.signal);

    if (params.leader_id)
      query = query.eq("leader_id", params.leader_id);
    if (params.post_type)
      query = query.eq("post_type", params.post_type as string);

    const { data, error, count } = await query;
    if (error) throw error;

    // Aggregates query
    let aggQuery = supabase
      .from("content_performance_metrics")
      .select(
        "impressions, engagement_score, reach_count, conversion_actions",
        { count: "exact", head: false }
      )
      .gte("posted_date", dateRange.date_start)
      .lte("posted_date", dateRange.date_end)
      .abortSignal(controller.signal);

    if (params.leader_id)
      aggQuery = aggQuery.eq("leader_id", params.leader_id);
    if (params.post_type)
      aggQuery = aggQuery.eq("post_type", params.post_type as string);

    const { data: aggData, error: aggError, count: totalPosts } = await aggQuery;
    if (aggError) throw aggError;

    const aggregates = {
      total_posts: totalPosts ?? 0,
      total_impressions: 0,
      total_reach: 0,
      avg_engagement_score: 0,
      total_conversions: 0,
    };

    if (aggData && aggData.length > 0) {
      let totalImpressions = 0;
      let totalReach = 0;
      let totalEngagement = 0;
      let totalConversions = 0;
      for (const row of aggData) {
        totalImpressions += Number(row.impressions) || 0;
        totalReach += Number(row.reach_count) || 0;
        totalEngagement += Number(row.engagement_score) || 0;
        totalConversions += Number(row.conversion_actions) || 0;
      }
      aggregates.total_impressions = totalImpressions;
      aggregates.total_reach = totalReach;
      aggregates.avg_engagement_score =
        aggData.length > 0
          ? Math.round((totalEngagement / aggData.length) * 100) / 100
          : 0;
      aggregates.total_conversions = totalConversions;
    }

    const rows = (data ?? []).map((r: Record<string, unknown>) => {
      const leader = r.thought_leaders as Record<string, unknown> | null;
      return {
        id: r.id,
        leader_id: r.leader_id,
        leader_name: leader?.name ?? null,
        post_type: r.post_type,
        hook_style: r.hook_style,
        impressions: r.impressions,
        engagement_score: r.engagement_score,
        reach_count: r.reach_count,
        conversion_actions: r.conversion_actions,
        audience: r.audience,
        posted_date: r.posted_date,
      };
    });

    return {
      data: rows,
      aggregates,
      pagination: {
        limit: pagination.limit,
        offset: pagination.offset,
        has_more: (count ?? 0) > pagination.offset + pagination.limit,
        max_limit: MAX_LIMIT,
      },
    };
  } finally {
    clear();
  }
}

async function handleBrandAnalytics(
  supabase: SupabaseClient,
  params: Record<string, unknown>,
  dateRange: DateRange,
  pagination: Pagination
) {
  if (params.brand_id) validateUUID(params.brand_id as string, "brand_id");

  const { controller, clear } = createAbortController();
  try {
    let query = supabase
      .from("brand_analytics_data")
      .select(
        "id, brand_id, data_type, metrics, dimensions, raw_data, date_range_start, date_range_end, brands(name)",
        { count: "exact" }
      )
      .gte("date_range_start", dateRange.date_start)
      .lte("date_range_start", dateRange.date_end)
      .order("date_range_start", { ascending: false })
      .range(pagination.offset, pagination.offset + pagination.limit - 1)
      .abortSignal(controller.signal);

    if (params.brand_id) query = query.eq("brand_id", params.brand_id);
    if (params.data_type)
      query = query.eq("data_type", params.data_type as string);

    const { data, error, count } = await query;
    if (error) throw error;

    const rows = (data ?? []).map((r: Record<string, unknown>) => {
      const brand = r.brands as Record<string, unknown> | null;
      return {
        id: r.id,
        brand_id: r.brand_id,
        brand_name: brand?.name ?? null,
        data_type: r.data_type,
        metrics: r.metrics,
        dimensions: r.dimensions,
        raw_data: r.raw_data,
        date_range_start: r.date_range_start,
        date_range_end: r.date_range_end,
      };
    });

    return {
      data: rows,
      pagination: {
        limit: pagination.limit,
        offset: pagination.offset,
        has_more: (count ?? 0) > pagination.offset + pagination.limit,
        max_limit: MAX_LIMIT,
      },
    };
  } finally {
    clear();
  }
}

async function handleImageGeneration(
  supabase: SupabaseClient,
  params: Record<string, unknown>,
  dateRange: DateRange,
  pagination: Pagination
) {
  if (params.user_id) validateUUID(params.user_id as string, "user_id");

  const { controller, clear } = createAbortController();
  try {
    let query = supabase
      .from("ai_generated_images")
      .select(
        "id, user_id, model_name, provider, cost_cents, aspect_ratio, status, generation_status, generation_time_ms, created_at",
        { count: "exact" }
      )
      .is("deleted_at", null)
      .gte("created_at", dateRange.date_start)
      .lte("created_at", dateRange.date_end)
      .order("created_at", { ascending: false })
      .range(pagination.offset, pagination.offset + pagination.limit - 1)
      .abortSignal(controller.signal);

    if (params.user_id) query = query.eq("user_id", params.user_id);
    if (params.provider) query = query.eq("provider", params.provider as string);
    if (params.model_name)
      query = query.eq("model_name", params.model_name as string);

    const { data, error, count } = await query;
    if (error) throw error;

    // Aggregates
    let aggQuery = supabase
      .from("ai_generated_images")
      .select("cost_cents, generation_time_ms", { count: "exact", head: false })
      .is("deleted_at", null)
      .gte("created_at", dateRange.date_start)
      .lte("created_at", dateRange.date_end)
      .abortSignal(controller.signal);

    if (params.user_id) aggQuery = aggQuery.eq("user_id", params.user_id);
    if (params.provider)
      aggQuery = aggQuery.eq("provider", params.provider as string);
    if (params.model_name)
      aggQuery = aggQuery.eq("model_name", params.model_name as string);

    const { data: aggData, error: aggError, count: totalImages } = await aggQuery;
    if (aggError) throw aggError;

    const aggregates = {
      total_images: totalImages ?? 0,
      total_cost_usd: 0,
      avg_generation_time_ms: 0,
    };

    if (aggData && aggData.length > 0) {
      let totalCostCents = 0;
      let totalGenTime = 0;
      let genCount = 0;
      for (const row of aggData) {
        totalCostCents += Number(row.cost_cents) || 0;
        if (row.generation_time_ms) {
          totalGenTime += Number(row.generation_time_ms);
          genCount++;
        }
      }
      aggregates.total_cost_usd = Math.round(totalCostCents) / 100;
      aggregates.avg_generation_time_ms =
        genCount > 0 ? Math.round(totalGenTime / genCount) : 0;
    }

    return {
      data: data ?? [],
      aggregates,
      pagination: {
        limit: pagination.limit,
        offset: pagination.offset,
        has_more: (count ?? 0) > pagination.offset + pagination.limit,
        max_limit: MAX_LIMIT,
      },
    };
  } finally {
    clear();
  }
}

async function handleVideoGeneration(
  supabase: SupabaseClient,
  params: Record<string, unknown>,
  dateRange: DateRange,
  pagination: Pagination
) {
  if (params.user_id) validateUUID(params.user_id as string, "user_id");
  if (params.brand_id) validateUUID(params.brand_id as string, "brand_id");

  const providerFilter = (params.provider as string) || "all";
  const { controller, clear } = createAbortController();

  try {
    const results: Record<string, unknown>[] = [];
    let soraCount = 0;
    let geminiCount = 0;

    // Sora videos
    if (providerFilter === "all" || providerFilter === "sora") {
      let soraQuery = supabase
        .from("sora_videos")
        .select(
          "id, user_id, model, status, duration, resolution, aspect_ratio, created_at, completed_at",
          { count: "exact" }
        )
        .gte("created_at", dateRange.date_start)
        .lte("created_at", dateRange.date_end)
        .order("created_at", { ascending: false })
        .abortSignal(controller.signal);

      if (params.user_id) soraQuery = soraQuery.eq("user_id", params.user_id);
      if (params.brand_id)
        soraQuery = soraQuery.eq("brand_id", params.brand_id);
      if (params.status)
        soraQuery = soraQuery.eq("status", params.status as string);

      const { data: soraData, error: soraError, count: sc } = await soraQuery;
      if (soraError) throw soraError;
      soraCount = sc ?? 0;

      for (const row of soraData ?? []) {
        results.push({ ...row, provider: "sora" });
      }
    }

    // Gemini videos
    if (providerFilter === "all" || providerFilter === "gemini") {
      let geminiQuery = supabase
        .from("gemini_videos")
        .select(
          "id, user_id, model, status, duration, resolution, aspect_ratio, created_at, completed_at",
          { count: "exact" }
        )
        .gte("created_at", dateRange.date_start)
        .lte("created_at", dateRange.date_end)
        .order("created_at", { ascending: false })
        .abortSignal(controller.signal);

      if (params.user_id)
        geminiQuery = geminiQuery.eq("user_id", params.user_id);
      if (params.status)
        geminiQuery = geminiQuery.eq("status", params.status as string);

      const { data: geminiData, error: geminiError, count: gc } =
        await geminiQuery;
      if (geminiError) throw geminiError;
      geminiCount = gc ?? 0;

      for (const row of geminiData ?? []) {
        results.push({ ...row, provider: "gemini" });
      }
    }

    // Sort merged results by created_at desc and paginate
    results.sort(
      (a, b) =>
        new Date(b.created_at as string).getTime() -
        new Date(a.created_at as string).getTime()
    );

    const totalCount = soraCount + geminiCount;
    const paged = results.slice(
      pagination.offset,
      pagination.offset + pagination.limit
    );

    return {
      data: paged,
      aggregates: {
        sora_count: soraCount,
        gemini_count: geminiCount,
        total: totalCount,
      },
      pagination: {
        limit: pagination.limit,
        offset: pagination.offset,
        has_more: totalCount > pagination.offset + pagination.limit,
        max_limit: MAX_LIMIT,
      },
    };
  } finally {
    clear();
  }
}

async function handleKeywords(
  supabase: SupabaseClient,
  params: Record<string, unknown>,
  dateRange: DateRange,
  pagination: Pagination
) {
  if (params.brand_id) validateUUID(params.brand_id as string, "brand_id");

  const { controller, clear } = createAbortController();
  try {
    let query = supabase
      .from("keyword_research")
      .select(
        "id, brand_id, keyword, search_volume, difficulty_score, competition, priority, status, current_rank, target_rank, created_at, brands(name)",
        { count: "exact" }
      )
      .gte("created_at", dateRange.date_start)
      .lte("created_at", dateRange.date_end)
      .order("created_at", { ascending: false })
      .range(pagination.offset, pagination.offset + pagination.limit - 1)
      .abortSignal(controller.signal);

    if (params.brand_id)
      query = query.eq("brand_id", params.brand_id);
    if (params.priority)
      query = query.eq("priority", params.priority as string);
    if (params.status)
      query = query.eq("status", params.status as string);

    const { data, error, count } = await query;
    if (error) throw error;

    // Aggregates
    let aggQuery = supabase
      .from("keyword_research")
      .select("search_volume, difficulty_score", { count: "exact", head: false })
      .gte("created_at", dateRange.date_start)
      .lte("created_at", dateRange.date_end)
      .abortSignal(controller.signal);

    if (params.brand_id)
      aggQuery = aggQuery.eq("brand_id", params.brand_id);
    if (params.priority)
      aggQuery = aggQuery.eq("priority", params.priority as string);
    if (params.status)
      aggQuery = aggQuery.eq("status", params.status as string);

    const { data: aggData, error: aggError, count: totalKeywords } = await aggQuery;
    if (aggError) throw aggError;

    const aggregates = {
      total_keywords: totalKeywords ?? 0,
      total_search_volume: 0,
      avg_difficulty: 0,
    };

    if (aggData && aggData.length > 0) {
      let totalSV = 0;
      let totalDiff = 0;
      let diffCount = 0;
      for (const row of aggData) {
        totalSV += Number(row.search_volume) || 0;
        if (row.difficulty_score != null) {
          totalDiff += Number(row.difficulty_score);
          diffCount++;
        }
      }
      aggregates.total_search_volume = totalSV;
      aggregates.avg_difficulty =
        diffCount > 0 ? Math.round((totalDiff / diffCount) * 100) / 100 : 0;
    }

    const rows = (data ?? []).map((r: Record<string, unknown>) => {
      const brand = r.brands as Record<string, unknown> | null;
      return {
        id: r.id,
        brand_id: r.brand_id,
        brand_name: brand?.name ?? null,
        keyword: r.keyword,
        search_volume: r.search_volume,
        difficulty_score: r.difficulty_score,
        competition: r.competition,
        priority: r.priority,
        status: r.status,
        current_rank: r.current_rank,
        target_rank: r.target_rank,
        created_at: r.created_at,
      };
    });

    return {
      data: rows,
      aggregates,
      pagination: {
        limit: pagination.limit,
        offset: pagination.offset,
        has_more: (count ?? 0) > pagination.offset + pagination.limit,
        max_limit: MAX_LIMIT,
      },
    };
  } finally {
    clear();
  }
}

async function handleIntegrationHealth(
  supabase: SupabaseClient,
  params: Record<string, unknown>,
  dateRange: DateRange,
  pagination: Pagination
) {
  const { controller, clear } = createAbortController();
  try {
    let query = supabase
      .from("integration_logs")
      .select(
        "id, integration_type, action, status, execution_time_ms, error_message, created_at",
        { count: "exact" }
      )
      .gte("created_at", dateRange.date_start)
      .lte("created_at", dateRange.date_end)
      .order("created_at", { ascending: false })
      .range(pagination.offset, pagination.offset + pagination.limit - 1)
      .abortSignal(controller.signal);

    if (params.integration_type)
      query = query.eq(
        "integration_type",
        params.integration_type as string
      );
    if (params.status)
      query = query.eq("status", params.status as string);

    const { data, error, count } = await query;
    if (error) throw error;

    // Aggregates
    let aggQuery = supabase
      .from("integration_logs")
      .select("status, execution_time_ms", { count: "exact", head: false })
      .gte("created_at", dateRange.date_start)
      .lte("created_at", dateRange.date_end)
      .abortSignal(controller.signal);

    if (params.integration_type)
      aggQuery = aggQuery.eq(
        "integration_type",
        params.integration_type as string
      );
    if (params.status)
      aggQuery = aggQuery.eq("status", params.status as string);

    const { data: aggData, error: aggError, count: totalLogs } = await aggQuery;
    if (aggError) throw aggError;

    const aggregates = {
      total_logs: totalLogs ?? 0,
      success_count: 0,
      failed_count: 0,
      success_rate: 0,
      avg_execution_time_ms: 0,
    };

    if (aggData && aggData.length > 0) {
      let successCount = 0;
      let failedCount = 0;
      let totalExecTime = 0;
      let execCount = 0;
      for (const row of aggData) {
        if (row.status === "success") successCount++;
        else failedCount++;
        if (row.execution_time_ms) {
          totalExecTime += Number(row.execution_time_ms);
          execCount++;
        }
      }
      aggregates.success_count = successCount;
      aggregates.failed_count = failedCount;
      aggregates.success_rate =
        aggData.length > 0
          ? Math.round((successCount / aggData.length) * 10000) / 100
          : 0;
      aggregates.avg_execution_time_ms =
        execCount > 0 ? Math.round(totalExecTime / execCount) : 0;
    }

    return {
      data: data ?? [],
      aggregates,
      pagination: {
        limit: pagination.limit,
        offset: pagination.offset,
        has_more: (count ?? 0) > pagination.offset + pagination.limit,
        max_limit: MAX_LIMIT,
      },
    };
  } finally {
    clear();
  }
}

// ─── Main Handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: apiCorsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse(405, "Method not allowed");
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "Invalid JSON body");
  }

  // ── Version check ──
  const version = (body.version as string) || "v1";
  if (version !== "v1") {
    return errorResponse(400, `Unknown API version: ${version}`);
  }

  // ── Action check ──
  const action = body.action as string | undefined;
  if (!action) {
    return errorResponse(400, "Missing required field: action");
  }
  if (!VALID_ACTIONS.includes(action as Action)) {
    return errorResponse(400, `Unknown action: ${action}. Valid actions: ${VALID_ACTIONS.join(", ")}`);
  }

  // ── Auth: API key ──
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return errorResponse(401, "Missing x-api-key header");
  }

  let supabase: SupabaseClient;
  try {
    supabase = getServiceClient();
  } catch (err) {
    console.error("[analytics-api] Config error:", err);
    return errorResponse(500, "Internal configuration error");
  }

  let keyRecord: ApiKeyRecord;
  let hashHex: string;
  try {
    hashHex = await hashApiKey(apiKey);
    const { data, error } = await supabase
      .from("analytics_api_keys")
      .select("id, key_name, is_active, rate_limit_per_minute, allowed_actions")
      .eq("key_hash", hashHex)
      .eq("is_active", true)
      .single();

    if (error || !data) {
      return errorResponse(401, "Invalid or inactive API key");
    }
    keyRecord = data as ApiKeyRecord;
  } catch {
    return errorResponse(401, "Invalid or inactive API key");
  }

  // ── Action scope ──
  if (
    keyRecord.allowed_actions &&
    keyRecord.allowed_actions.length > 0 &&
    !keyRecord.allowed_actions.includes(action)
  ) {
    return errorResponse(
      403,
      `API key "${keyRecord.key_name}" is not authorized for action: ${action}`
    );
  }

  // ── Rate limiting ──
  try {
    const { data: rlData, error: rlError } = await supabase.rpc(
      "check_analytics_api_rate_limit",
      {
        p_api_key_hash: hashHex,
        p_max_requests: keyRecord.rate_limit_per_minute,
      }
    );

    if (rlError) {
      console.error("[analytics-api] Rate limit RPC error:", rlError);
    } else if (rlData && rlData.length > 0) {
      const rl = rlData[0];
      if (!rl.allowed) {
        return errorResponse(429, "Rate limit exceeded", {
          resets_at: rl.window_resets_at,
          current_count: rl.current_count,
          limit_max: rl.limit_max,
        });
      }
    }
  } catch (err) {
    console.error("[analytics-api] Rate limit check failed:", err);
    // Fail open — don't block requests if rate limit table is unavailable
  }

  // ── Update last_used_at (fire-and-forget) ──
  supabase
    .from("analytics_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyRecord.id)
    .then(() => {})
    .catch(() => {});

  // ── Cache check ──
  const cacheKey = getCacheKey(action, body, keyRecord.id);
  const cached = getCached(cacheKey);
  if (cached) {
    const parsed = JSON.parse(cached);
    parsed.cached = true;
    return buildResponse(parsed);
  }

  // ── Sanitize inputs ──
  const dateRange = sanitizeDateRange({
    date_start: body.date_start as string | undefined,
    date_end: body.date_end as string | undefined,
  });
  const pagination = sanitizePagination({
    limit: body.limit as number | undefined,
    offset: body.offset as number | undefined,
  });

  // ── Execute action ──
  try {
    let result: Record<string, unknown>;

    switch (action as Action) {
      case "ai-usage":
        result = await handleAiUsage(supabase, body, dateRange, pagination);
        break;
      case "content-performance":
        result = await handleContentPerformance(
          supabase,
          body,
          dateRange,
          pagination
        );
        break;
      case "brand-analytics":
        result = await handleBrandAnalytics(
          supabase,
          body,
          dateRange,
          pagination
        );
        break;
      case "image-generation":
        result = await handleImageGeneration(
          supabase,
          body,
          dateRange,
          pagination
        );
        break;
      case "video-generation":
        result = await handleVideoGeneration(
          supabase,
          body,
          dateRange,
          pagination
        );
        break;
      case "keywords":
        result = await handleKeywords(supabase, body, dateRange, pagination);
        break;
      case "integration-health":
        result = await handleIntegrationHealth(
          supabase,
          body,
          dateRange,
          pagination
        );
        break;
      default:
        return errorResponse(400, `Unknown action: ${action}`);
    }

    const responseBody = {
      ok: true,
      version: "v1",
      ...result,
      applied_date_range: dateRange,
      cached: false,
    };

    // Store in cache
    setCache(cacheKey, JSON.stringify(responseBody));

    return buildResponse(responseBody);
  } catch (err) {
    // Handle AbortController timeout
    if (err instanceof DOMException && err.name === "AbortError") {
      return errorResponse(
        504,
        "Query timed out. Try narrowing your date range or adding filters."
      );
    }

    // Handle custom validation errors
    if (
      typeof err === "object" &&
      err !== null &&
      "status" in err &&
      "message" in err
    ) {
      const e = err as { status: number; message: string };
      return errorResponse(e.status, e.message);
    }

    console.error("[analytics-api] Handler error:", err);
    return errorResponse(500, "Internal server error");
  }
});
