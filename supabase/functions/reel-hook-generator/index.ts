import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";
import { validateInput } from "../_shared/reel-hook-generator/validation.ts";
import { buildPrompt } from "../_shared/reel-hook-generator/prompts.ts";
import { generateHooks } from "../_shared/reel-hook-generator/generation.ts";
import { scoreHooks } from "../_shared/reel-hook-generator/scoring.ts";
import { saveGeneration, createLog } from "../_shared/reel-hook-generator/storage.ts";

interface ReelHookRequest {
  brand_id: string;
  topic: string;
  target_audience: string;
  platform: 'instagram' | 'youtube_shorts' | 'tiktok' | 'facebook';
  primary_goal: 'views' | 'saves' | 'follows' | 'clicks';
  tone: string;
  hook_length?: 'short' | 'medium' | 'long';
  competitor_hooks?: string[];
  past_performing_hooks?: string[];
  content_format?: 'talking_head' | 'broll' | 'text_overlay' | 'mixed';
  urgency_level?: 'low' | 'medium' | 'high';
  creator_persona?: 'expert' | 'peer' | 'entertainer' | 'educator';
  additional_context?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    // Create Supabase client with user's auth
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Parse request body
    const body: ReelHookRequest = await req.json();

    console.log("[reel-hook-generator] Starting generation for user:", user.id);
    console.log("[reel-hook-generator] Platform:", body.platform, "Goal:", body.primary_goal);

    // Step 1: Validate Input
    const startTime = Date.now();
    const validationResult = validateInput(body);
    if (!validationResult.valid) {
      return new Response(
        JSON.stringify({
          success: false,
          error: validationResult.error,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Load agent configuration
    const { data: agent, error: agentError } = await supabase
      .from("ai_agents")
      .select("*")
      .eq("slug", "reel-hook-generator")
      .single();

    if (agentError || !agent) {
      throw new Error("Reel Hook Generator agent not configured");
    }

    const config = agent.config as Record<string, any>;

    // Create generation record
    const { data: generation, error: genError } = await supabase
      .from("reel_hook_generations")
      .insert({
        brand_id: body.brand_id,
        user_id: user.id,
        topic: body.topic,
        target_audience: body.target_audience,
        platform: body.platform,
        primary_goal: body.primary_goal,
        tone: body.tone,
        hook_length: body.hook_length,
        competitor_hooks: body.competitor_hooks,
        past_performing_hooks: body.past_performing_hooks,
        content_format: body.content_format,
        urgency_level: body.urgency_level,
        creator_persona: body.creator_persona,
        additional_context: body.additional_context,
        status: "generating",
      })
      .select()
      .single();

    if (genError || !generation) {
      throw new Error("Failed to create generation record");
    }

    console.log("[reel-hook-generator] Generation record created:", generation.id);

    let attempt = 1;
    let bestHooks: any[] = [];
    let avgScore = 0;
    let totalTokens = 0;
    let totalCost = 0;
    let regenerationReason = null;

    // Generation loop (max 3 attempts)
    while (attempt <= 3) {
      console.log(`[reel-hook-generator] Attempt ${attempt}/3`);

      // Step 2: Build Prompt
      const prompt = buildPrompt(body, config, agent.system_prompt);

      // Step 3: Generate Hooks
      const genResult = await generateHooks(
        prompt,
        config,
        supabase,
        generation.id,
        attempt
      );

      totalTokens += genResult.tokens_used;
      totalCost += genResult.cost_usd;

      if (!genResult.success || !genResult.hooks) {
        console.error("[reel-hook-generator] Generation failed:", genResult.error);

        // Log failure
        await createLog(supabase, generation.id, "generate_hooks", attempt, {
          error: genResult.error,
          status: "failed",
        });

        if (attempt === 3) {
          // Final attempt failed
          await supabase
            .from("reel_hook_generations")
            .update({
              status: "failed",
              error_message: genResult.error || "Generation failed after 3 attempts",
              generation_attempts: attempt,
              total_tokens_used: totalTokens,
              cost_usd: totalCost,
            })
            .eq("id", generation.id);

          return new Response(
            JSON.stringify({
              success: false,
              error: genResult.error || "Generation failed after 3 attempts",
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        attempt++;
        regenerationReason = genResult.error;
        continue;
      }

      // Step 4: Score Hooks
      const scoreResult = await scoreHooks(
        genResult.hooks,
        body,
        config,
        supabase,
        generation.id,
        attempt
      );

      totalTokens += scoreResult.tokens_used;
      totalCost += scoreResult.cost_usd;

      if (!scoreResult.success) {
        console.error("[reel-hook-generator] Scoring failed:", scoreResult.error);

        if (attempt === 3) {
          // Use hooks without scoring
          bestHooks = genResult.hooks.slice(0, 5);
          avgScore = 7.0; // Default score
          break;
        }

        attempt++;
        regenerationReason = "Scoring failed";
        continue;
      }

      // Check if quality threshold met
      const minScore = config.min_quality_score || 7.5;
      avgScore = scoreResult.avg_score;

      console.log(`[reel-hook-generator] Average score: ${avgScore.toFixed(2)}, Threshold: ${minScore}`);

      if (avgScore >= minScore || attempt === 3) {
        // Quality threshold met or final attempt
        bestHooks = scoreResult.scored_hooks;
        break;
      }

      // Score too low, regenerate
      console.log(`[reel-hook-generator] Score ${avgScore.toFixed(2)} below threshold ${minScore}, regenerating...`);
      regenerationReason = `Quality score ${avgScore.toFixed(2)} below threshold ${minScore}`;
      attempt++;
    }

    // Calculate final metrics
    const generationTime = Date.now() - startTime;

    // Extract top 5 hooks
    const topHooks = bestHooks.slice(0, 5);

    // Calculate average scores
    const scrollStopAvg = topHooks.reduce((sum, h) => sum + (h.scroll_stop_score || 0), 0) / topHooks.length;
    const clarityAvg = topHooks.reduce((sum, h) => sum + (h.clarity_score || 0), 0) / topHooks.length;
    const emotionalAvg = topHooks.reduce((sum, h) => sum + (h.emotional_pull_score || 0), 0) / topHooks.length;
    const specificityAvg = topHooks.reduce((sum, h) => sum + (h.specificity_score || 0), 0) / topHooks.length;

    // Determine primary/secondary categories from top hooks
    const categories = topHooks.map(h => h.category).filter(Boolean);
    const primaryCategory = categories[0] || "curiosity";
    const secondaryCategory = categories.find(c => c !== primaryCategory) || null;

    // Create A/B test suggestion
    const abTestSuggestion = {
      hook_a: topHooks[0]?.hook || "",
      hook_b: topHooks[1]?.hook || "",
      variable: topHooks[0]?.category !== topHooks[1]?.category
        ? `${topHooks[0]?.category} vs ${topHooks[1]?.category}`
        : "Statement style variation",
    };

    // Get platform note
    const platformRules = config.platform_rules?.[body.platform] || {};
    const platformNote = `${body.platform}: ${platformRules.hook_style || 'Optimized'} - Best categories: ${(platformRules.best_categories || []).join(', ')}`;

    // Update generation record with results
    const { error: updateError } = await supabase
      .from("reel_hook_generations")
      .update({
        status: "completed",
        top_hooks: topHooks,
        ab_test_suggestion: abTestSuggestion,
        primary_hook_category: primaryCategory,
        secondary_hook_category: secondaryCategory,
        strategy_used: `${primaryCategory}${secondaryCategory ? ` + ${secondaryCategory}` : ''}`,
        platform_note: platformNote,
        avg_quality_score: avgScore,
        scroll_stop_avg: scrollStopAvg,
        clarity_avg: clarityAvg,
        emotional_pull_avg: emotionalAvg,
        specificity_avg: specificityAvg,
        generation_attempts: attempt,
        regeneration_reason: regenerationReason,
        llm_model_generation: config.model_version || "gpt-4o",
        llm_model_scoring: config.scoring_model || "gpt-4o-mini",
        total_tokens_used: totalTokens,
        cost_usd: totalCost,
        generation_time_ms: generationTime,
        updated_at: new Date().toISOString(),
      })
      .eq("id", generation.id);

    if (updateError) {
      console.error("[reel-hook-generator] Failed to update generation:", updateError);
    }

    console.log("[reel-hook-generator] Generation completed successfully");
    console.log(`[reel-hook-generator] Attempts: ${attempt}, Avg Score: ${avgScore.toFixed(2)}, Cost: $${totalCost.toFixed(4)}`);

    // Return response
    return new Response(
      JSON.stringify({
        success: true,
        generation_id: generation.id,
        top_hooks: topHooks,
        strategy_used: `${primaryCategory}${secondaryCategory ? ` + ${secondaryCategory}` : ''}`,
        platform_note: platformNote,
        ab_test_suggestion: abTestSuggestion,
        scoring: {
          avg_quality_score: avgScore,
          scroll_stop_avg: scrollStopAvg,
          clarity_avg: clarityAvg,
          emotional_pull_avg: emotionalAvg,
          specificity_avg: specificityAvg,
        },
        meta: {
          attempts: attempt,
          regeneration_reason: regenerationReason,
          total_tokens: totalTokens,
          cost_usd: totalCost,
          generation_time_ms: generationTime,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("[reel-hook-generator] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
