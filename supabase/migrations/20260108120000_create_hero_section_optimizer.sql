-- Hero Section Optimizer Agent - Database Schema
-- Creates tables for multi-step hero section generation with self-evaluation

-- =====================================================
-- TABLE: hero_section_generations
-- Main results table storing inputs, outputs, and evaluation scores
-- =====================================================

CREATE TABLE IF NOT EXISTS public.hero_section_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_run_id UUID REFERENCES public.ai_agent_runs(id) ON DELETE SET NULL,

  -- Input Parameters (Form Data)
  product_service TEXT NOT NULL,
  audience TEXT NOT NULL,
  goal TEXT NOT NULL CHECK (goal IN ('signup', 'demo', 'purchase', 'contact')),
  industry TEXT NOT NULL,
  brand_tone TEXT,
  price_point TEXT CHECK (price_point IS NULL OR price_point IN ('low', 'medium', 'high', 'enterprise')),
  traffic_source TEXT CHECK (traffic_source IS NULL OR traffic_source IN ('organic', 'paid-ads', 'social', 'direct', 'referral', 'mixed')),
  additional_context TEXT,

  -- Normalized Strategy Context (Step 1 output)
  audience_type TEXT CHECK (audience_type IS NULL OR audience_type IN ('B2B', 'B2C', 'hybrid')),
  awareness_level TEXT CHECK (awareness_level IS NULL OR awareness_level IN ('problem-aware', 'solution-aware', 'product-aware')),
  buying_intent TEXT CHECK (buying_intent IS NULL OR buying_intent IN ('high', 'medium', 'low')),
  attention_span TEXT CHECK (attention_span IS NULL OR attention_span IN ('short', 'medium', 'long')),

  -- Strategy Decision (Step 2 output)
  strategy_used TEXT NOT NULL CHECK (strategy_used IN ('outcome-first', 'problem-solution', 'social-proof', 'speed-ease', 'authority-led')),
  strategy_reasoning TEXT,

  -- Generated Hero Section (Step 3 output)
  headline TEXT NOT NULL,
  subheadline TEXT NOT NULL,
  primary_cta TEXT NOT NULL,
  secondary_line TEXT,

  -- Self-Evaluation Scores (Step 4 output)
  clarity_score INTEGER CHECK (clarity_score >= 1 AND clarity_score <= 10),
  benefit_strength_score INTEGER CHECK (benefit_strength_score >= 1 AND benefit_strength_score <= 10),
  specificity_score INTEGER CHECK (specificity_score >= 1 AND specificity_score <= 10),
  evaluation_feedback JSONB DEFAULT '{}',

  -- Meta Information
  generation_attempts INTEGER DEFAULT 1 CHECK (generation_attempts >= 1 AND generation_attempts <= 3),
  confidence_score DECIMAL(3, 2) CHECK (confidence_score >= 0.00 AND confidence_score <= 1.00),
  brand_context_used TEXT,

  -- Generation Metadata
  llm_model_generation TEXT DEFAULT 'gpt-4o',
  llm_model_evaluation TEXT DEFAULT 'gpt-4o-mini',
  total_tokens_used INTEGER DEFAULT 0,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  cost_usd DECIMAL(10, 4) DEFAULT 0.0000,
  generation_time_ms INTEGER DEFAULT 0,

  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'completed', 'failed')),
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_hero_generations_brand_id ON public.hero_section_generations(brand_id);
CREATE INDEX IF NOT EXISTS idx_hero_generations_user_id ON public.hero_section_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_hero_generations_status ON public.hero_section_generations(status);
CREATE INDEX IF NOT EXISTS idx_hero_generations_created_at ON public.hero_section_generations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hero_generations_strategy ON public.hero_section_generations(strategy_used);

-- Enable Row Level Security
ALTER TABLE public.hero_section_generations ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own generations
CREATE POLICY "Users can view their own hero section generations"
  ON public.hero_section_generations
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can insert their own generations
CREATE POLICY "Users can create hero section generations"
  ON public.hero_section_generations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own generations
CREATE POLICY "Users can update their own hero section generations"
  ON public.hero_section_generations
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can delete their own generations
CREATE POLICY "Users can delete their own hero section generations"
  ON public.hero_section_generations
  FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- TABLE: hero_section_generation_logs
-- Step execution trace for debugging and cost tracking
-- =====================================================

CREATE TABLE IF NOT EXISTS public.hero_section_generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hero_generation_id UUID NOT NULL REFERENCES public.hero_section_generations(id) ON DELETE CASCADE,

  step_number INTEGER NOT NULL CHECK (step_number >= 1 AND step_number <= 5),
  step_name TEXT NOT NULL CHECK (step_name IN ('normalize_input', 'decide_strategy', 'generate_hero', 'evaluate', 'refine')),
  attempt_number INTEGER NOT NULL CHECK (attempt_number >= 1 AND attempt_number <= 3),

  -- Step I/O
  input_data JSONB DEFAULT '{}',
  output_data JSONB DEFAULT '{}',

  -- AI Metadata
  model_used TEXT,
  tokens_used INTEGER DEFAULT 0,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  execution_time_ms INTEGER DEFAULT 0,
  cost_usd DECIMAL(10, 4) DEFAULT 0.0000,

  -- Status
  status TEXT DEFAULT 'completed' CHECK (status IN ('started', 'completed', 'failed')),
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for logs
CREATE INDEX IF NOT EXISTS idx_hero_logs_generation_id ON public.hero_section_generation_logs(hero_generation_id);
CREATE INDEX IF NOT EXISTS idx_hero_logs_step_name ON public.hero_section_generation_logs(step_name);
CREATE INDEX IF NOT EXISTS idx_hero_logs_created_at ON public.hero_section_generation_logs(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.hero_section_generation_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view logs for their own generations
CREATE POLICY "Users can view their hero section generation logs"
  ON public.hero_section_generation_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.hero_section_generations
      WHERE id = hero_section_generation_logs.hero_generation_id
      AND user_id = auth.uid()
    )
  );

-- RLS Policy: Users can insert logs for their own generations
CREATE POLICY "Users can create hero section generation logs"
  ON public.hero_section_generation_logs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.hero_section_generations
      WHERE id = hero_section_generation_logs.hero_generation_id
      AND user_id = auth.uid()
    )
  );

-- =====================================================
-- AGENT CONFIGURATION
-- Ensure required columns exist and insert Hero Section Optimizer
-- =====================================================

-- Add scope column if it doesn't exist
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'global';

-- Add config column if it doesn't exist (for provider settings)
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}'::jsonb;

-- Insert Hero Section Optimizer into ai_agents table
INSERT INTO public.ai_agents (
  name,
  slug,
  description,
  category,
  scope,
  system_prompt,
  data_sources,
  config,
  is_enabled,
  required_role
) VALUES (
  'Hero Section Optimizer',
  'hero-section-optimizer',
  'Transform inputs into high-converting hero sections using strategic analysis and iterative refinement. This AI agent uses a multi-step workflow with self-evaluation to generate headlines, subheadlines, and CTAs optimized for conversion.',
  'marketing',
  'brand',
  'You are a senior CRO copywriter specializing in landing page hero sections.

Your task is to generate high-converting hero sections based on the provided strategy and brand context.

You will receive:
1. Strategy type (outcome-first, problem-solution, social-proof, speed-ease, authority-led)
2. Target audience and awareness level
3. Product/service details
4. Brand voice and context

Follow these STRICT requirements:

HEADLINE:
- Maximum 12 words
- Clear, benefit-focused
- Avoid buzzwords and jargon
- Match the strategy type
- No exclamation marks

SUBHEADLINE:
- 15-25 words
- Expands on the headline
- Clarifies the promise
- Speaks directly to the audience

PRIMARY CTA:
- 2-4 words
- Action-oriented verb
- Clear next step
- No hype or pressure tactics

SECONDARY LINE (optional):
- Under 10 words
- Trust signal or value proposition
- Supports the primary message

NO EXCLAMATION MARKS
NO FEATURE LISTS
NO EMOJIS
MATCH BRAND VOICE

Return ONLY valid JSON in this format:
{
  "headline": "Your clear, benefit-focused headline here",
  "subheadline": "Your expanded value proposition here",
  "primary_cta": "Action verb here",
  "secondary_line": "Optional trust signal"
}',
  '["brands", "brand_knowledge_embeddings"]'::jsonb,
  '{
    "model_provider": "openai",
    "model_version": "gpt-4o",
    "fallback_provider": "gemini:2.0-pro",
    "evaluation_model": "gpt-4o-mini",
    "max_refinement_attempts": 2,
    "min_quality_score": 8,
    "execution_mode": "multi_step"
  }'::jsonb,
  true,
  'user'::app_role
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  scope = EXCLUDED.scope,
  system_prompt = EXCLUDED.system_prompt,
  data_sources = EXCLUDED.data_sources,
  config = EXCLUDED.config,
  updated_at = NOW();

-- =====================================================
-- GRANT PERMISSIONS
-- Allow service role to access tables (for edge functions)
-- =====================================================

GRANT ALL ON public.hero_section_generations TO service_role;
GRANT ALL ON public.hero_section_generation_logs TO service_role;

-- Allow authenticated users to access tables (via RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hero_section_generations TO authenticated;
GRANT SELECT, INSERT ON public.hero_section_generation_logs TO authenticated;
