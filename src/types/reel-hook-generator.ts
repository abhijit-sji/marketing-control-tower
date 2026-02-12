/**
 * TypeScript types for Reel Hook Generator
 */

export type Platform = 'instagram' | 'youtube_shorts' | 'tiktok' | 'facebook';
export type PrimaryGoal = 'views' | 'saves' | 'follows' | 'clicks';
export type HookLength = 'short' | 'medium' | 'long';
export type ContentFormat = 'talking_head' | 'broll' | 'text_overlay' | 'mixed';
export type UrgencyLevel = 'low' | 'medium' | 'high';
export type CreatorPersona = 'expert' | 'peer' | 'entertainer' | 'educator';

export interface ReelHookInput {
  brand_id: string;
  topic: string;
  target_audience: string;
  platform: Platform;
  primary_goal: PrimaryGoal;
  tone: string;
  hook_length?: HookLength;
  competitor_hooks?: string[];
  past_performing_hooks?: string[];
  content_format?: ContentFormat;
  urgency_level?: UrgencyLevel;
  creator_persona?: CreatorPersona;
  additional_context?: string;
  model?: string;
}

export interface GeneratedHook {
  hook: string;
  category: string;
  reasoning?: string;
  best_for?: string;
  scroll_stop_score: number;
  clarity_score: number;
  emotional_pull_score: number;
  specificity_score: number;
  weighted_score?: number;
  feedback?: string;
}

export interface ABTestSuggestion {
  hook_a: string;
  hook_b: string;
  variable: string;
}

export interface ScoringMetrics {
  avg_quality_score: number;
  scroll_stop_avg: number;
  clarity_avg: number;
  emotional_pull_avg: number;
  specificity_avg: number;
}

export interface GenerationMeta {
  attempts: number;
  regeneration_reason?: string | null;
  total_tokens: number;
  cost_usd: number;
  generation_time_ms: number;
}

export interface ReelHookResult {
  success: true;
  generation_id: string;
  top_hooks: GeneratedHook[];
  strategy_used: string;
  platform_note: string;
  ab_test_suggestion: ABTestSuggestion;
  scoring: ScoringMetrics;
  meta: GenerationMeta;
}

export interface ReelHookError {
  success: false;
  error: string;
}

export interface ReelHookGeneration {
  id: string;
  brand_id: string;
  user_id: string;
  agent_run_id: string | null;

  // User inputs
  topic: string;
  target_audience: string;
  platform: Platform;
  primary_goal: PrimaryGoal;
  tone: string;
  hook_length?: HookLength | null;
  competitor_hooks?: string[] | null;
  past_performing_hooks?: string[] | null;
  content_format?: ContentFormat | null;
  urgency_level?: UrgencyLevel | null;
  creator_persona?: CreatorPersona | null;
  additional_context?: string | null;

  // Strategy
  primary_hook_category: string;
  secondary_hook_category?: string | null;
  strategy_reasoning?: string | null;
  awareness_level?: string | null;
  scroll_state?: string | null;
  trust_level?: string | null;

  // Results
  top_hooks: GeneratedHook[];
  ab_test_suggestion: ABTestSuggestion;
  strategy_used: string;
  platform_note?: string | null;

  // Scoring
  avg_quality_score?: number | null;
  scroll_stop_avg?: number | null;
  clarity_avg?: number | null;
  emotional_pull_avg?: number | null;
  specificity_avg?: number | null;

  // Meta
  generation_attempts: number;
  regeneration_reason?: string | null;
  llm_model_generation: string;
  llm_model_scoring: string;
  total_tokens_used: number;
  prompt_tokens: number;
  completion_tokens: number;
  cost_usd: number;
  generation_time_ms: number;

  // Status
  status: 'draft' | 'generating' | 'completed' | 'failed';
  error_message?: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface ReelHookGenerationLog {
  id: string;
  reel_hook_generation_id: string;
  step_name: 'validate_input' | 'generate_hooks' | 'score_hooks' | 'regenerate';
  attempt_number: number;
  input_data: Record<string, any>;
  output_data: Record<string, any>;
  model_used?: string | null;
  tokens_used: number;
  prompt_tokens: number;
  completion_tokens: number;
  execution_time_ms: number;
  cost_usd: number;
  status: 'started' | 'completed' | 'failed';
  error_message?: string | null;
  created_at: string;
}

export interface ReelHookStats {
  total_generations: number;
  avg_quality_score: number;
  avg_attempts: number;
  platform_distribution: Record<Platform, number>;
  goal_distribution: Record<PrimaryGoal, number>;
  category_distribution: Record<string, number>;
  most_used_platform: Platform;
  most_used_goal: PrimaryGoal;
  most_used_category: string;
  total_cost: number;
}
