/**
 * Hero Section Optimizer - Orchestration Engine
 *
 * This is the FIRST multi-step orchestration engine in the platform.
 * It coordinates the entire workflow from input to final output with self-evaluation and refinement.
 *
 * KEY INNOVATION: Reusable pattern for future complex agents
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { OpenAIClient } from '../openai-client.ts';
import {
  HeroInput,
  NormalizedContext,
  StrategyDecision,
  HeroSection,
  EvaluationScores,
  StepResult,
  normalizeInput,
  decideStrategy,
  generateHeroSection,
  evaluateHeroSection,
  calculateConfidenceScore,
  meetsQualityThreshold,
} from './steps.ts';
import { BrandContext, collectBrandContext, validateBrand } from './brand-context.ts';

/**
 * Configuration for the orchestrator
 */
export interface OrchestratorConfig {
  max_refinement_attempts: number;
  min_quality_score: number;
  generation_model: string;
  evaluation_model: string;
}

/**
 * Input data for orchestrator execution
 */
export interface OrchestratorInput {
  input: HeroInput;
  brandId: string;
  userId: string;
  config: OrchestratorConfig;
}

/**
 * Final output from the orchestrator
 */
export interface OrchestratorResult {
  // Normalized context from Step 1
  normalized: NormalizedContext;

  // Strategy decision from Step 2
  strategy: StrategyDecision;

  // Final hero section from Step 3/5
  heroSection: HeroSection;

  // Evaluation scores from Step 4
  evaluation: EvaluationScores;

  // Brand context used
  brandContext: BrandContext;

  // Metadata
  meta: {
    attempts: number;
    confidence_score: number;
    total_tokens: number;
    total_cost_usd: number;
    total_execution_time_ms: number;
    steps_executed: number;
  };
}

/**
 * Multi-Step Orchestration Engine
 *
 * Coordinates the entire hero section generation workflow:
 * 1. Normalize inputs (GPT-4o-mini)
 * 2. Decide strategy (rules-based)
 * 3. Generate hero section (GPT-4o)
 * 4. Evaluate quality (GPT-4o-mini)
 * 5. Refine if needed (loop back to step 3, max 2 attempts)
 */
export class HeroOptimizerOrchestrator {
  private generationClient: OpenAIClient; // GPT-4o
  private evaluationClient: OpenAIClient; // GPT-4o-mini
  private supabaseClient: SupabaseClient;
  private heroId: string;

  constructor(
    generationClient: OpenAIClient,
    evaluationClient: OpenAIClient,
    supabaseClient: SupabaseClient,
    heroId: string
  ) {
    this.generationClient = generationClient;
    this.evaluationClient = evaluationClient;
    this.supabaseClient = supabaseClient;
    this.heroId = heroId;
  }

  /**
   * Execute the complete multi-step workflow
   */
  async execute(input: OrchestratorInput): Promise<OrchestratorResult> {
    console.log(`[orchestrator] Starting execution for hero ${this.heroId}`);
    const overallStartTime = Date.now();

    // Validate brand exists
    const isBrandValid = await validateBrand(this.supabaseClient, input.brandId);
    if (!isBrandValid) {
      throw new Error(`Brand ${input.brandId} is not valid or not active`);
    }

    // Collect brand context first (needed for generation)
    console.log('[orchestrator] Collecting brand context...');
    const brandContext = await collectBrandContext(
      this.supabaseClient,
      input.brandId,
      input.input.product_service,
      input.input.audience
    );

    // STEP 1: Normalize Input (GPT-4o-mini)
    console.log('[orchestrator] Step 1: Normalizing inputs...');
    const normalizedResult = await normalizeInput(this.evaluationClient, input.input);
    await this.logStep(1, 'normalize_input', 1, input.input, normalizedResult);

    // STEP 2: Decide Strategy (Rules-based)
    console.log('[orchestrator] Step 2: Deciding strategy...');
    const strategyResult = decideStrategy(
      normalizedResult.data,
      input.input.industry,
      input.input.goal
    );
    await this.logStep(2, 'decide_strategy', 1, normalizedResult.data, strategyResult);

    console.log(`[orchestrator] Strategy selected: ${strategyResult.data.strategy_used}`);
    console.log(`[orchestrator] Reasoning: ${strategyResult.data.reasoning}`);

    // STEP 3-5: Generate + Evaluate + Refine Loop
    console.log('[orchestrator] Step 3-5: Generate → Evaluate → Refine loop...');

    let attempts = 0;
    let heroSection: StepResult<HeroSection> | null = null;
    let evaluation: StepResult<EvaluationScores> | null = null;
    const maxAttempts = input.config.max_refinement_attempts || 2;
    const minScore = input.config.min_quality_score || 8;

    while (attempts < maxAttempts + 1) {
      attempts++;
      console.log(`[orchestrator] Generation attempt ${attempts}/${maxAttempts + 1}...`);

      // Step 3: Generate hero section
      const isRefinement = attempts > 1;
      heroSection = await generateHeroSection(
        this.generationClient,
        input.input,
        normalizedResult.data,
        strategyResult.data,
        brandContext,
        isRefinement && heroSection ? heroSection.data : undefined,
        isRefinement && evaluation ? evaluation.data : undefined
      );
      await this.logStep(3, 'generate_hero', attempts, {
        ...input.input,
        normalized: normalizedResult.data,
        strategy: strategyResult.data,
        isRefinement,
      }, heroSection);

      console.log(`[orchestrator] Generated headline: "${heroSection.data.headline}"`);

      // Step 4: Evaluate quality
      evaluation = await evaluateHeroSection(
        this.evaluationClient,
        heroSection.data,
        input.input,
        strategyResult.data.strategy_used
      );
      await this.logStep(4, 'evaluate', attempts, heroSection.data, evaluation);

      console.log(`[orchestrator] Evaluation scores - Clarity: ${evaluation.data.clarity_score}, Benefit: ${evaluation.data.benefit_strength}, Specificity: ${evaluation.data.specificity}`);

      // Check if quality meets threshold
      const meetsThreshold = meetsQualityThreshold(evaluation.data, minScore);
      console.log(`[orchestrator] Meets threshold (${minScore}): ${meetsThreshold}`);

      if (meetsThreshold) {
        console.log(`[orchestrator] Quality threshold met on attempt ${attempts}!`);
        break;
      }

      // If not meeting threshold and we have attempts left, continue loop
      if (attempts > maxAttempts) {
        console.log(`[orchestrator] Max attempts (${maxAttempts + 1}) reached. Using best result.`);
        break;
      }

      // Log that we're refining
      console.log(`[orchestrator] Quality scores below ${minScore}. Refining...`);
      if (evaluation.data.clarity_fixes.length > 0) {
        console.log(`  - Clarity issues: ${evaluation.data.clarity_fixes.join('; ')}`);
      }
      if (evaluation.data.benefit_fixes.length > 0) {
        console.log(`  - Benefit issues: ${evaluation.data.benefit_fixes.join('; ')}`);
      }
      if (evaluation.data.specificity_fixes.length > 0) {
        console.log(`  - Specificity issues: ${evaluation.data.specificity_fixes.join('; ')}`);
      }
    }

    // Calculate final metadata
    const totalExecutionTime = Date.now() - overallStartTime;
    const totalTokens =
      normalizedResult.tokens_used +
      (heroSection?.tokens_used || 0) +
      (evaluation?.tokens_used || 0);
    const totalCost =
      normalizedResult.cost_usd +
      (heroSection?.cost_usd || 0) +
      (evaluation?.cost_usd || 0);
    const confidenceScore = evaluation ? calculateConfidenceScore(evaluation.data) : 0;

    console.log(`[orchestrator] Execution complete!`);
    console.log(`  - Total attempts: ${attempts}`);
    console.log(`  - Total tokens: ${totalTokens}`);
    console.log(`  - Total cost: $${totalCost.toFixed(4)}`);
    console.log(`  - Confidence score: ${confidenceScore}`);
    console.log(`  - Execution time: ${totalExecutionTime}ms`);

    return {
      normalized: normalizedResult.data,
      strategy: strategyResult.data,
      heroSection: heroSection!.data,
      evaluation: evaluation!.data,
      brandContext,
      meta: {
        attempts,
        confidence_score: confidenceScore,
        total_tokens: totalTokens,
        total_cost_usd: totalCost,
        total_execution_time_ms: totalExecutionTime,
        steps_executed: 2 + (attempts * 2), // normalize + strategy + (generate + evaluate) * attempts
      },
    };
  }

  /**
   * Log a step execution to the database
   */
  private async logStep<T>(
    stepNumber: number,
    stepName: string,
    attemptNumber: number,
    inputData: unknown,
    stepResult: StepResult<T>
  ): Promise<void> {
    try {
      const { error } = await this.supabaseClient
        .from('hero_section_generation_logs')
        .insert({
          hero_generation_id: this.heroId,
          step_number: stepNumber,
          step_name: stepName,
          attempt_number: attemptNumber,
          input_data: inputData as any,
          output_data: stepResult.data as any,
          model_used: stepResult.model_used,
          tokens_used: stepResult.tokens_used,
          prompt_tokens: stepResult.prompt_tokens,
          completion_tokens: stepResult.completion_tokens,
          execution_time_ms: stepResult.execution_time_ms,
          cost_usd: stepResult.cost_usd,
          status: 'completed',
        });

      if (error) {
        console.error('[orchestrator] Failed to log step:', error);
        // Don't throw - logging failure shouldn't stop execution
      }
    } catch (error) {
      console.error('[orchestrator] Error logging step:', error);
      // Don't throw - logging failure shouldn't stop execution
    }
  }
}

/**
 * Create an orchestrator instance
 */
export function createOrchestrator(
  supabaseClient: SupabaseClient,
  heroId: string,
  config: OrchestratorConfig
): HeroOptimizerOrchestrator {
  const generationClient = new OpenAIClient({
    apiKey: Deno.env.get('OPENAI_KEY') || '',
    model: config.generation_model,
    temperature: 0.7,
    maxTokens: 500,
  });

  const evaluationClient = new OpenAIClient({
    apiKey: Deno.env.get('OPENAI_KEY') || '',
    model: config.evaluation_model,
    temperature: 0.3,
    maxTokens: 400,
  });

  return new HeroOptimizerOrchestrator(
    generationClient,
    evaluationClient,
    supabaseClient,
    heroId
  );
}
