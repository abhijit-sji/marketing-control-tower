/**
 * TypeScript Types for Hero Section Optimizer
 *
 * These types define the data structures for the hero section generation workflow.
 */

/**
 * Input data for hero section generation (form fields)
 */
export interface HeroSectionInput {
  brand_id: string;
  brand_name: string;
  product_service: string;
  audience: string;
  goal: 'signup' | 'demo' | 'purchase' | 'contact';
  industry: string;
  brand_tone?: string;
  price_point?: 'low' | 'medium' | 'high' | 'enterprise';
  traffic_source?: 'organic' | 'paid-ads' | 'social' | 'direct' | 'referral' | 'mixed';
  additional_context?: string;
  model?: string;
}

/**
 * Generated hero section output
 */
export interface HeroSection {
  headline: string;
  subheadline: string;
  primary_cta: string;
  secondary_line?: string;
}

/**
 * Evaluation scores from the self-evaluation step
 */
export interface EvaluationScores {
  clarity: number;
  benefit: number;
  specificity: number;
}

/**
 * Result returned from the edge function
 */
export interface HeroSectionResult {
  success: boolean;
  hero_id: string;
  hero_section: HeroSection;
  strategy_used: string;
  evaluation_scores: EvaluationScores;
  attempts: number;
  confidence_score: number;
  meta: {
    total_tokens: number;
    cost_usd: number;
    generation_time_ms: number;
  };
}

/**
 * Error response from the edge function
 */
export interface HeroSectionError {
  success: false;
  error: string;
}

/**
 * Full generation record from the database
 */
export interface HeroSectionGeneration {
  id: string;
  brand_id: string;
  user_id: string;

  // Inputs
  product_service: string;
  audience: string;
  goal: string;
  industry: string;
  brand_tone?: string;
  price_point?: string;
  traffic_source?: string;
  additional_context?: string;

  // Normalized context
  audience_type?: 'B2B' | 'B2C' | 'hybrid';
  awareness_level?: 'problem-aware' | 'solution-aware' | 'product-aware';
  buying_intent?: 'high' | 'medium' | 'low';
  attention_span?: 'short' | 'medium' | 'long';

  // Strategy
  strategy_used: string;
  strategy_reasoning?: string;

  // Hero section
  headline: string;
  subheadline: string;
  primary_cta: string;
  secondary_line?: string;

  // Evaluation
  clarity_score?: number;
  benefit_strength_score?: number;
  specificity_score?: number;
  evaluation_feedback?: {
    clarity_fixes: string[];
    benefit_fixes: string[];
    specificity_fixes: string[];
  };

  // Meta
  generation_attempts: number;
  confidence_score?: number;
  brand_context_used?: string;
  llm_model_generation?: string;
  llm_model_evaluation?: string;
  total_tokens_used?: number;
  cost_usd?: number;
  generation_time_ms?: number;

  // Status
  status: 'draft' | 'generating' | 'completed' | 'failed';
  error_message?: string;

  // Timestamps
  created_at: string;
  updated_at: string;
}

/**
 * Generation log entry (step execution trace)
 */
export interface HeroSectionGenerationLog {
  id: string;
  hero_generation_id: string;
  step_number: number;
  step_name: string;
  attempt_number: number;
  input_data: any;
  output_data: any;
  model_used?: string;
  tokens_used: number;
  prompt_tokens: number;
  completion_tokens: number;
  execution_time_ms: number;
  cost_usd?: number;
  status: 'started' | 'completed' | 'failed';
  error_message?: string;
  created_at: string;
}

/**
 * Form validation errors
 */
export interface FormErrors {
  product_service?: string;
  audience?: string;
  goal?: string;
  industry?: string;
  brand_tone?: string;
  price_point?: string;
  traffic_source?: string;
  additional_context?: string;
}

/**
 * Progress state during generation
 */
export interface GenerationProgress {
  step: 'idle' | 'normalizing' | 'strategizing' | 'generating' | 'evaluating' | 'refining' | 'complete' | 'error';
  progress: number; // 0-100
  message: string;
}

/**
 * Form state for the hero section optimizer
 */
export interface HeroSectionFormState {
  product_service: string;
  audience: string;
  goal: 'signup' | 'demo' | 'purchase' | 'contact' | '';
  industry: string;
  brand_tone: string;
  price_point: '' | 'low' | 'medium' | 'high' | 'enterprise';
  traffic_source: '' | 'organic' | 'paid-ads' | 'social' | 'direct' | 'referral' | 'mixed';
  additional_context: string;
}

/**
 * Default form state
 */
export const defaultFormState: HeroSectionFormState = {
  product_service: '',
  audience: '',
  goal: '',
  industry: '',
  brand_tone: '',
  price_point: '',
  traffic_source: '',
  additional_context: '',
};

/**
 * Helper type for strategy names
 */
export type HeroStrategy =
  | 'outcome-first'
  | 'problem-solution'
  | 'social-proof'
  | 'speed-ease'
  | 'authority-led';

/**
 * Strategy descriptions for UI display
 */
export const strategyDescriptions: Record<HeroStrategy, string> = {
  'outcome-first': 'Lead with the specific result or transformation customers will achieve',
  'problem-solution': 'Identify the pain point first, then present your solution',
  'social-proof': 'Build credibility with user counts, notable customers, or proven results',
  'speed-ease': 'Emphasize simplicity, quick setup, and ease of use',
  'authority-led': 'Establish expertise, credentials, and institutional trust',
};
