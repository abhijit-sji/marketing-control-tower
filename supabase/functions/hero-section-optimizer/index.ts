/**
 * Hero Section Optimizer Edge Function
 *
 * Multi-step AI agent that generates high-converting hero sections with self-evaluation and refinement.
 * This is the FIRST multi-step orchestration agent in the platform.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createOrchestrator, OrchestratorConfig } from '../_shared/hero-optimizer/orchestrator.ts';
import type { HeroInput } from '../_shared/hero-optimizer/steps.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody extends HeroInput {
  brand_id: string;
  brand_name: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('[hero-optimizer] Starting hero section generation...');

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Authenticate user
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      throw new Error('Unauthorized');
    }

    // Parse request body
    const body: RequestBody = await req.json();

    console.log(`[hero-optimizer] Request from user ${user.id} for brand ${body.brand_id}`);

    // Validate required fields
    if (!body.product_service || !body.audience || !body.goal || !body.industry || !body.brand_id) {
      throw new Error('Missing required fields: product_service, audience, goal, industry, brand_id');
    }

    // Validate goal enum
    const validGoals = ['signup', 'demo', 'purchase', 'contact'];
    if (!validGoals.includes(body.goal)) {
      throw new Error(`Invalid goal. Must be one of: ${validGoals.join(', ')}`);
    }

    // Fetch agent configuration
    console.log('[hero-optimizer] Fetching agent configuration...');
    const { data: agentConfig, error: agentError } = await supabaseClient
      .from('ai_agents')
      .select('config')
      .eq('slug', 'hero-section-optimizer')
      .single();

    if (agentError) {
      console.warn('[hero-optimizer] Could not fetch agent config, using defaults:', agentError);
    }

    // Extract configuration with fallbacks
    const config = (agentConfig?.config as any) || {};
    const orchestratorConfig: OrchestratorConfig = {
      generation_model: config.model_version || 'gpt-4o',
      evaluation_model: config.evaluation_model || 'gpt-4o-mini',
      max_refinement_attempts: config.max_refinement_attempts || 2,
      min_quality_score: config.min_quality_score || 8,
    };

    console.log('[hero-optimizer] Configuration:', orchestratorConfig);

    // STEP 1: Create hero_section_generations record
    console.log('[hero-optimizer] Creating generation record...');
    const { data: heroRecord, error: insertError } = await supabaseClient
      .from('hero_section_generations')
      .insert({
        user_id: user.id,
        brand_id: body.brand_id,
        product_service: body.product_service,
        audience: body.audience,
        goal: body.goal,
        industry: body.industry,
        brand_tone: body.brand_tone,
        price_point: body.price_point,
        traffic_source: body.traffic_source,
        additional_context: body.additional_context,
        status: 'generating',
      })
      .select()
      .single();

    if (insertError) {
      console.error('[hero-optimizer] Insert error:', insertError);
      throw insertError;
    }

    const heroId = heroRecord.id;
    console.log(`[hero-optimizer] Created record ${heroId}`);

    // STEP 2: Run orchestrator
    console.log('[hero-optimizer] Creating orchestrator...');
    const orchestrator = createOrchestrator(supabaseClient, heroId, orchestratorConfig);

    console.log('[hero-optimizer] Executing workflow...');
    const startTime = Date.now();

    const result = await orchestrator.execute({
      input: {
        product_service: body.product_service,
        audience: body.audience,
        goal: body.goal,
        industry: body.industry,
        brand_tone: body.brand_tone,
        price_point: body.price_point,
        traffic_source: body.traffic_source,
        additional_context: body.additional_context,
      },
      brandId: body.brand_id,
      userId: user.id,
      config: orchestratorConfig,
    });

    const executionTime = Date.now() - startTime;

    console.log(`[hero-optimizer] Workflow completed in ${executionTime}ms`);
    console.log(`[hero-optimizer] Final headline: "${result.heroSection.headline}"`);
    console.log(`[hero-optimizer] Confidence score: ${result.meta.confidence_score}`);

    // STEP 3: Update record with results
    console.log('[hero-optimizer] Updating record with results...');
    const { error: updateError } = await supabaseClient
      .from('hero_section_generations')
      .update({
        // Normalized context
        audience_type: result.normalized.audience_type,
        awareness_level: result.normalized.awareness_level,
        buying_intent: result.normalized.buying_intent,
        attention_span: result.normalized.attention_span,

        // Strategy
        strategy_used: result.strategy.strategy_used,
        strategy_reasoning: result.strategy.reasoning,

        // Hero section
        headline: result.heroSection.headline,
        subheadline: result.heroSection.subheadline,
        primary_cta: result.heroSection.primary_cta,
        secondary_line: result.heroSection.secondary_line || '',

        // Evaluation scores
        clarity_score: result.evaluation.clarity_score,
        benefit_strength_score: result.evaluation.benefit_strength,
        specificity_score: result.evaluation.specificity,
        evaluation_feedback: {
          clarity_fixes: result.evaluation.clarity_fixes,
          benefit_fixes: result.evaluation.benefit_fixes,
          specificity_fixes: result.evaluation.specificity_fixes,
        },

        // Meta
        generation_attempts: result.meta.attempts,
        confidence_score: result.meta.confidence_score,
        brand_context_used: result.brandContext.summary,
        llm_model_generation: orchestratorConfig.generation_model,
        llm_model_evaluation: orchestratorConfig.evaluation_model,
        total_tokens_used: result.meta.total_tokens,
        cost_usd: result.meta.total_cost_usd,
        generation_time_ms: executionTime,

        // Status
        status: 'completed',
      })
      .eq('id', heroId);

    if (updateError) {
      console.error('[hero-optimizer] Update error:', updateError);
      throw updateError;
    }

    console.log('[hero-optimizer] Record updated successfully');

    // STEP 4: Return response
    return new Response(
      JSON.stringify({
        success: true,
        hero_id: heroId,
        hero_section: {
          headline: result.heroSection.headline,
          subheadline: result.heroSection.subheadline,
          primary_cta: result.heroSection.primary_cta,
          secondary_line: result.heroSection.secondary_line || '',
        },
        strategy_used: result.strategy.strategy_used,
        evaluation_scores: {
          clarity: result.evaluation.clarity_score,
          benefit: result.evaluation.benefit_strength,
          specificity: result.evaluation.specificity,
        },
        attempts: result.meta.attempts,
        confidence_score: result.meta.confidence_score,
        meta: {
          total_tokens: result.meta.total_tokens,
          cost_usd: result.meta.total_cost_usd,
          generation_time_ms: executionTime,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[hero-optimizer] Error:', error);

    // Try to update the record with error status if we have a heroId
    // (this will fail if the record wasn't created, but that's ok)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
