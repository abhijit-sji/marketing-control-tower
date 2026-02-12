/**
 * Hero Section Optimizer - Step Implementations
 *
 * This file contains the implementations for each step in the multi-step workflow.
 * Each step is designed to be independent and reusable.
 */

import { OpenAIClient, OpenAIResponse } from '../openai-client.ts';
import {
  NORMALIZE_INPUT_SYSTEM_PROMPT,
  EVALUATION_SYSTEM_PROMPT,
  buildGenerationSystemPrompt,
  buildRefinementSystemPrompt,
  getStrategyType,
  STRATEGY_GUIDELINES,
} from './prompts.ts';

/**
 * Input and output types for each step
 */

export interface HeroInput {
  product_service: string;
  audience: string;
  goal: string;
  industry: string;
  brand_tone?: string;
  price_point?: string;
  traffic_source?: string;
  additional_context?: string;
}

export interface NormalizedContext {
  audience_type: 'B2B' | 'B2C' | 'hybrid';
  awareness_level: 'problem-aware' | 'solution-aware' | 'product-aware';
  buying_intent: 'high' | 'medium' | 'low';
  attention_span: 'short' | 'medium' | 'long';
}

export interface StrategyDecision {
  strategy_used: 'outcome-first' | 'problem-solution' | 'social-proof' | 'speed-ease' | 'authority-led';
  reasoning: string;
}

export interface HeroSection {
  headline: string;
  subheadline: string;
  primary_cta: string;
  secondary_line?: string;
}

export interface EvaluationScores {
  clarity_score: number;
  clarity_fixes: string[];
  benefit_strength: number;
  benefit_fixes: string[];
  specificity: number;
  specificity_fixes: string[];
}

export interface StepResult<T> {
  data: T;
  tokens_used: number;
  prompt_tokens: number;
  completion_tokens: number;
  cost_usd: number;
  execution_time_ms: number;
  model_used: string;
}

/**
 * STEP 1: Normalize Input
 * Uses GPT-4o-mini to analyze user inputs and extract strategic context
 */
export async function normalizeInput(
  client: OpenAIClient,
  input: HeroInput
): Promise<StepResult<NormalizedContext>> {
  const startTime = Date.now();

  // Build user message with all input context
  const userMessage = `
Product/Service: ${input.product_service}
Target Audience: ${input.audience}
Primary Goal: ${input.goal}
Industry: ${input.industry}
${input.brand_tone ? `Brand Tone: ${input.brand_tone}` : ''}
${input.price_point ? `Price Point: ${input.price_point}` : ''}
${input.traffic_source ? `Traffic Source: ${input.traffic_source}` : ''}
${input.additional_context ? `Additional Context: ${input.additional_context}` : ''}

Analyze the above information and return the strategic context as JSON.
  `.trim();

  const response: OpenAIResponse = await client.chat([
    { role: 'system', content: NORMALIZE_INPUT_SYSTEM_PROMPT },
    { role: 'user', content: userMessage },
  ]);

  const executionTime = Date.now() - startTime;

  // Parse JSON response
  let normalized: NormalizedContext;
  try {
    normalized = JSON.parse(response.content);
  } catch (error) {
    console.error('Failed to parse normalization response:', response.content);
    throw new Error('Invalid JSON response from normalization step');
  }

  return {
    data: normalized,
    tokens_used: response.usage.total_tokens,
    prompt_tokens: response.usage.prompt_tokens,
    completion_tokens: response.usage.completion_tokens,
    cost_usd: response.cost_usd,
    execution_time_ms: executionTime,
    model_used: response.model,
  };
}

/**
 * STEP 2: Decide Strategy
 * Rules-based logic to choose the optimal hero section strategy
 * No AI call - fast and deterministic
 */
export function decideStrategy(
  normalized: NormalizedContext,
  industry: string,
  goal: string
): StepResult<StrategyDecision> {
  const startTime = Date.now();

  let strategy: StrategyDecision['strategy_used'];
  let reasoning: string;

  // Rule 1: High buying intent + product-aware = outcome-first
  if (normalized.buying_intent === 'high' && normalized.awareness_level === 'product-aware') {
    strategy = 'outcome-first';
    reasoning = 'High buying intent and product awareness indicate the audience is ready to convert. Leading with the outcome removes final friction and provides clear value proposition.';
  }
  // Rule 2: Low awareness + complex product = problem-solution
  else if (
    normalized.awareness_level === 'problem-aware' &&
    (industry.toLowerCase().includes('tech') ||
      industry.toLowerCase().includes('software') ||
      industry.toLowerCase().includes('saas') ||
      industry.toLowerCase().includes('b2b'))
  ) {
    strategy = 'problem-solution';
    reasoning = 'Problem-aware audience in a complex industry needs empathy and education. Starting with their pain point builds trust before introducing the solution.';
  }
  // Rule 3: B2B + enterprise + contact/demo goal = authority-led
  else if (
    normalized.audience_type === 'B2B' &&
    (goal === 'demo' || goal === 'contact') &&
    (industry.toLowerCase().includes('enterprise') || industry.toLowerCase().includes('b2b'))
  ) {
    strategy = 'authority-led';
    reasoning = 'Enterprise B2B buyers require credibility and trust. Authority-led messaging establishes expertise and reduces perceived risk in high-stakes decisions.';
  }
  // Rule 4: Short attention span + SaaS tool = speed-ease
  else if (
    normalized.attention_span === 'short' &&
    (industry.toLowerCase().includes('saas') ||
      industry.toLowerCase().includes('tool') ||
      industry.toLowerCase().includes('app'))
  ) {
    strategy = 'speed-ease';
    reasoning = 'Short attention span requires immediate clarity. Speed-ease messaging promises quick value and removes barriers to entry, perfect for impatient users.';
  }
  // Rule 5: Solution-aware = social-proof
  else if (normalized.awareness_level === 'solution-aware') {
    strategy = 'social-proof';
    reasoning = 'Solution-aware audience is comparing options. Social proof provides external validation and reduces uncertainty through credibility markers.';
  }
  // Default fallback: outcome-first (most universally effective)
  else {
    strategy = 'outcome-first';
    reasoning = 'Default to outcome-first strategy as it provides clear value proposition and works well across most scenarios where other specific conditions are not met.';
  }

  const executionTime = Date.now() - startTime;

  return {
    data: { strategy_used: strategy, reasoning },
    tokens_used: 0,
    prompt_tokens: 0,
    completion_tokens: 0,
    cost_usd: 0,
    execution_time_ms: executionTime,
    model_used: 'rules-based',
  };
}

/**
 * STEP 3: Generate Hero Section
 * Uses GPT-4o to generate headline, subheadline, and CTA
 */
export async function generateHeroSection(
  client: OpenAIClient,
  input: HeroInput,
  normalized: NormalizedContext,
  strategy: StrategyDecision,
  brandContext: { voice: string; values: string[]; copyPatterns: string; summary: string },
  previousAttempt?: HeroSection,
  evaluationFeedback?: EvaluationScores
): Promise<StepResult<HeroSection>> {
  const startTime = Date.now();

  // Choose appropriate system prompt
  const systemPrompt = previousAttempt && evaluationFeedback
    ? buildRefinementSystemPrompt(
        strategy.strategy_used,
        brandContext,
        previousAttempt,
        {
          clarity_fixes: evaluationFeedback.clarity_fixes,
          benefit_fixes: evaluationFeedback.benefit_fixes,
          specificity_fixes: evaluationFeedback.specificity_fixes,
        }
      )
    : buildGenerationSystemPrompt(strategy.strategy_used, brandContext);

  // Build user message
  const userMessage = `
Product/Service: ${input.product_service}
Target Audience: ${input.audience}
Primary Goal: ${input.goal}
Industry: ${input.industry}
${input.brand_tone ? `Brand Tone: ${input.brand_tone}` : ''}
${input.additional_context ? `Additional Context: ${input.additional_context}` : ''}

Audience Analysis:
- Type: ${normalized.audience_type}
- Awareness Level: ${normalized.awareness_level}
- Buying Intent: ${normalized.buying_intent}
- Attention Span: ${normalized.attention_span}

Strategy: ${strategy.strategy_used}
${previousAttempt ? '\n[This is a refinement attempt. Address all issues from the feedback above.]' : ''}

Generate a high-converting hero section following the strategy guidelines.
  `.trim();

  const response: OpenAIResponse = await client.chat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ]);

  const executionTime = Date.now() - startTime;

  // Parse JSON response
  let heroSection: HeroSection;
  try {
    // Clean response (remove markdown code blocks if present)
    let cleanedContent = response.content.trim();
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.replace(/```json\n?/g, '').replace(/```\n?$/g, '').trim();
    } else if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/```\n?/g, '').trim();
    }

    heroSection = JSON.parse(cleanedContent);

    // Ensure secondary_line is a string (not undefined)
    if (!heroSection.secondary_line) {
      heroSection.secondary_line = '';
    }
  } catch (error) {
    console.error('Failed to parse hero generation response:', response.content);
    throw new Error('Invalid JSON response from hero generation step');
  }

  return {
    data: heroSection,
    tokens_used: response.usage.total_tokens,
    prompt_tokens: response.usage.prompt_tokens,
    completion_tokens: response.usage.completion_tokens,
    cost_usd: response.cost_usd,
    execution_time_ms: executionTime,
    model_used: response.model,
  };
}

/**
 * STEP 4: Evaluate Hero Section
 * Uses GPT-4o-mini to score quality and provide feedback
 */
export async function evaluateHeroSection(
  client: OpenAIClient,
  heroSection: HeroSection,
  originalInput: HeroInput,
  strategy: string
): Promise<StepResult<EvaluationScores>> {
  const startTime = Date.now();

  const userMessage = `
Hero Section to Evaluate:

Headline: "${heroSection.headline}"
Subheadline: "${heroSection.subheadline}"
Primary CTA: "${heroSection.primary_cta}"
${heroSection.secondary_line ? `Secondary Line: "${heroSection.secondary_line}"` : ''}

Context:
- Product/Service: ${originalInput.product_service}
- Target Audience: ${originalInput.audience}
- Strategy Used: ${strategy}

Evaluate this hero section and provide scores with specific fixes if needed.
  `.trim();

  const response: OpenAIResponse = await client.chat([
    { role: 'system', content: EVALUATION_SYSTEM_PROMPT },
    { role: 'user', content: userMessage },
  ]);

  const executionTime = Date.now() - startTime;

  // Parse JSON response
  let evaluation: EvaluationScores;
  try {
    // Clean response
    let cleanedContent = response.content.trim();
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.replace(/```json\n?/g, '').replace(/```\n?$/g, '').trim();
    } else if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/```\n?/g, '').trim();
    }

    evaluation = JSON.parse(cleanedContent);
  } catch (error) {
    console.error('Failed to parse evaluation response:', response.content);
    throw new Error('Invalid JSON response from evaluation step');
  }

  return {
    data: evaluation,
    tokens_used: response.usage.total_tokens,
    prompt_tokens: response.usage.prompt_tokens,
    completion_tokens: response.usage.completion_tokens,
    cost_usd: response.cost_usd,
    execution_time_ms: executionTime,
    model_used: response.model,
  };
}

/**
 * Helper function to calculate confidence score from evaluation scores
 */
export function calculateConfidenceScore(evaluation: EvaluationScores): number {
  const avgScore = (
    evaluation.clarity_score +
    evaluation.benefit_strength +
    evaluation.specificity
  ) / 3;

  // Normalize to 0.00-1.00 scale
  const confidence = Math.min(avgScore / 10, 1.0);

  // Round to 2 decimal places
  return Math.round(confidence * 100) / 100;
}

/**
 * Helper function to check if all scores meet the quality threshold
 */
export function meetsQualityThreshold(evaluation: EvaluationScores, threshold: number = 8): boolean {
  return (
    evaluation.clarity_score >= threshold &&
    evaluation.benefit_strength >= threshold &&
    evaluation.specificity >= threshold
  );
}
