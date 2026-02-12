-- Reel Hook Generator Agent - Database Schema
-- Creates tables for reel hook generation with scoring and evaluation

-- =====================================================
-- TABLE: reel_hook_generations
-- Main results table storing inputs, outputs, and scores
-- =====================================================

CREATE TABLE IF NOT EXISTS public.reel_hook_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_run_id UUID REFERENCES public.ai_agent_runs(id) ON DELETE SET NULL,

  -- User Input Parameters (Form Data)
  topic TEXT NOT NULL,
  target_audience TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'youtube_shorts', 'tiktok', 'facebook')),
  primary_goal TEXT NOT NULL CHECK (primary_goal IN ('views', 'saves', 'follows', 'clicks')),
  tone TEXT NOT NULL,

  -- Optional Inputs
  hook_length TEXT CHECK (hook_length IS NULL OR hook_length IN ('short', 'medium', 'long')),
  competitor_hooks TEXT[], -- Array of competitor hook examples
  past_performing_hooks TEXT[], -- Array of user's past successful hooks
  content_format TEXT CHECK (content_format IS NULL OR content_format IN ('talking_head', 'broll', 'text_overlay', 'mixed')),
  urgency_level TEXT CHECK (urgency_level IS NULL OR urgency_level IN ('low', 'medium', 'high')),
  creator_persona TEXT CHECK (creator_persona IS NULL OR creator_persona IN ('expert', 'peer', 'entertainer', 'educator')),
  additional_context TEXT,

  -- Strategy Selection (from psychology mapping)
  primary_hook_category TEXT NOT NULL, -- e.g., "curiosity", "pain", "contrarian"
  secondary_hook_category TEXT, -- Optional secondary category
  strategy_reasoning TEXT,
  awareness_level TEXT CHECK (awareness_level IS NULL OR awareness_level IN ('unaware', 'problem_aware', 'solution_aware', 'product_aware')),
  scroll_state TEXT CHECK (scroll_state IS NULL OR scroll_state IN ('passive', 'active_searching', 'end_of_session')),
  trust_level TEXT CHECK (trust_level IS NULL OR trust_level IN ('cold', 'warm', 'hot')),

  -- Generated Hooks (JSON array of top hooks)
  top_hooks JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Format: [{"hook": "text", "category": "curiosity", "score": 8.9, "best_for": "cold audience"}]

  -- A/B Test Suggestions
  ab_test_suggestion JSONB DEFAULT '{}'::jsonb,
  -- Format: {"hook_a": "text", "hook_b": "text", "variable": "Question vs Statement"}

  -- Strategy & Platform Notes
  strategy_used TEXT NOT NULL,
  platform_note TEXT,

  -- Scoring Metadata
  avg_quality_score DECIMAL(3, 1) CHECK (avg_quality_score >= 0.0 AND avg_quality_score <= 10.0),
  scroll_stop_avg DECIMAL(3, 1) CHECK (scroll_stop_avg >= 0.0 AND scroll_stop_avg <= 10.0),
  clarity_avg DECIMAL(3, 1) CHECK (clarity_avg >= 0.0 AND clarity_avg <= 10.0),
  emotional_pull_avg DECIMAL(3, 1) CHECK (emotional_pull_avg >= 0.0 AND emotional_pull_avg <= 10.0),
  specificity_avg DECIMAL(3, 1) CHECK (specificity_avg >= 0.0 AND specificity_avg <= 10.0),

  -- Generation Attempts
  generation_attempts INTEGER DEFAULT 1 CHECK (generation_attempts >= 1 AND generation_attempts <= 3),
  regeneration_reason TEXT, -- Why regeneration was needed

  -- AI Model Metadata
  llm_model_generation TEXT DEFAULT 'gpt-4o',
  llm_model_scoring TEXT DEFAULT 'gpt-4o-mini',
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
CREATE INDEX IF NOT EXISTS idx_reel_hook_generations_brand_id ON public.reel_hook_generations(brand_id);
CREATE INDEX IF NOT EXISTS idx_reel_hook_generations_user_id ON public.reel_hook_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_reel_hook_generations_status ON public.reel_hook_generations(status);
CREATE INDEX IF NOT EXISTS idx_reel_hook_generations_platform ON public.reel_hook_generations(platform);
CREATE INDEX IF NOT EXISTS idx_reel_hook_generations_goal ON public.reel_hook_generations(primary_goal);
CREATE INDEX IF NOT EXISTS idx_reel_hook_generations_created_at ON public.reel_hook_generations(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.reel_hook_generations ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own generations
CREATE POLICY "Users can view their own reel hook generations"
  ON public.reel_hook_generations
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can insert their own generations
CREATE POLICY "Users can create reel hook generations"
  ON public.reel_hook_generations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own generations
CREATE POLICY "Users can update their own reel hook generations"
  ON public.reel_hook_generations
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can delete their own generations
CREATE POLICY "Users can delete their own reel hook generations"
  ON public.reel_hook_generations
  FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- TABLE: reel_hook_generation_logs
-- Execution trace for debugging and cost tracking
-- =====================================================

CREATE TABLE IF NOT EXISTS public.reel_hook_generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_hook_generation_id UUID NOT NULL REFERENCES public.reel_hook_generations(id) ON DELETE CASCADE,

  step_name TEXT NOT NULL CHECK (step_name IN ('validate_input', 'generate_hooks', 'score_hooks', 'regenerate')),
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
CREATE INDEX IF NOT EXISTS idx_reel_hook_logs_generation_id ON public.reel_hook_generation_logs(reel_hook_generation_id);
CREATE INDEX IF NOT EXISTS idx_reel_hook_logs_step_name ON public.reel_hook_generation_logs(step_name);
CREATE INDEX IF NOT EXISTS idx_reel_hook_logs_created_at ON public.reel_hook_generation_logs(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.reel_hook_generation_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view logs for their own generations
CREATE POLICY "Users can view their reel hook generation logs"
  ON public.reel_hook_generation_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.reel_hook_generations
      WHERE id = reel_hook_generation_logs.reel_hook_generation_id
      AND user_id = auth.uid()
    )
  );

-- RLS Policy: Users can insert logs for their own generations
CREATE POLICY "Users can create reel hook generation logs"
  ON public.reel_hook_generation_logs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.reel_hook_generations
      WHERE id = reel_hook_generation_logs.reel_hook_generation_id
      AND user_id = auth.uid()
    )
  );

-- =====================================================
-- AGENT CONFIGURATION
-- Insert Reel Hook Generator with comprehensive config
-- =====================================================

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
  'Reel Hook Generator',
  'reel-hook-generator',
  'Generate scroll-stopping reel hooks optimized for platform algorithms and viewer psychology. Uses strategic analysis, gold examples, and two-pass scoring to create high-performing opening lines for Instagram Reels, YouTube Shorts, TikTok, and Facebook Reels.',
  'content',
  'brand',
  'You are an expert social media copywriter specializing in viral reel hooks.

Your task is to generate scroll-stopping hooks based on the provided strategy, platform rules, and viewer psychology.

You will receive:
1. Topic and target audience
2. Platform (Instagram, YouTube Shorts, TikTok, Facebook)
3. Primary goal (views, saves, follows, clicks)
4. Tone and creator persona
5. Gold examples from the category
6. Platform-specific rules and constraints

Follow these STRICT requirements:

WORD COUNT:
- Maximum 12 words per hook
- Shorter is better for TikTok (1 second attention)
- Slightly longer acceptable for YouTube Shorts (2 seconds)

FIRST WORD STRENGTH:
- Must start with: You, Stop, This, I, The
- Use power words that command attention
- Avoid weak openers like "Did you know", "So", "Hey"

PSYCHOLOGY:
- Match viewer awareness level (unaware, problem-aware, solution-aware, product-aware)
- Consider scroll state (passive, active searching, end of session)
- Align with trust level (cold, warm, hot)

LANGUAGE RULES:
- Spoken style (conversational, not corporate)
- NO emojis
- NO clickbait lies
- Avoid banned phrases: "Did you know", "most people", "nobody talks about"

CATEGORY ALIGNMENT:
- Curiosity: Use pattern interrupts, open loops
- Pain: Call out specific mistakes or problems
- Contrarian: Challenge common beliefs
- Mistake: "I wasted X doing Y"
- Identity: "If you''re a [persona]..."
- Shock: Unexpected statements
- FOMO: Time-sensitive urgency

PLATFORM OPTIMIZATION:
- Instagram: Visual + text overlay friendly
- YouTube Shorts: Slightly longer setup OK
- TikTok: Pattern interrupt heavy, Gen-Z friendly
- Facebook: Emotional + relatable, avoid Gen-Z slang

Return ONLY valid JSON in this format:
{
  "hooks": [
    {
      "hook": "Your scroll-stopping hook here",
      "category": "curiosity",
      "reasoning": "Why this works for the audience",
      "scroll_stop_score": 9,
      "clarity_score": 8,
      "emotional_pull_score": 9,
      "specificity_score": 8
    }
  ],
  "strategy_note": "Primary strategy used and why"
}',
  '["brands", "brand_knowledge_embeddings"]'::jsonb,
  '{
    "model_provider": "openai",
    "model_version": "gpt-4o",
    "fallback_provider": "gemini:2.0-pro",
    "scoring_model": "gpt-4o-mini",
    "min_quality_score": 7.5,
    "max_regeneration_attempts": 2,
    "hooks_per_generation": 5,
    "gold_examples": {
      "curiosity": ["I stopped posting reels for 30 days — here''s what happened", "The algorithm changed again and nobody noticed"],
      "pain": ["Your reels get 200 views because of this one mistake", "You''re losing followers every time you post"],
      "contrarian": ["Posting daily is destroying your reach", "Hashtags haven''t worked since 2022"],
      "mistake": ["I wasted 6 months making this reel error", "Stop using trending audio — here''s why"],
      "identity": ["If you''re a creator under 10K, watch this", "Founders — this reel strategy is for you"],
      "shock": ["I deleted my account with 100K followers", "This reel format got me banned"],
      "fomo": ["Do this before the algorithm updates tomorrow", "Only 3 days left to use this hack"]
    },
    "platform_rules": {
      "instagram": {
        "avg_attention": 1.5,
        "hook_style": "Visual + text overlay",
        "best_categories": ["curiosity", "identity", "mistake"],
        "avoid": "Long setups"
      },
      "youtube_shorts": {
        "avg_attention": 2,
        "hook_style": "Slightly longer",
        "best_categories": ["contrarian", "pain", "story"],
        "avoid": "Instagram-native phrases"
      },
      "tiktok": {
        "avg_attention": 1,
        "hook_style": "Pattern interrupt heavy",
        "best_categories": ["shock", "curiosity", "trend-jack"],
        "avoid": "Corporate tone"
      },
      "facebook": {
        "avg_attention": 2.5,
        "hook_style": "Emotional + relatable",
        "best_categories": ["pain", "identity", "nostalgia"],
        "avoid": "Gen-Z slang"
      }
    },
    "viewer_psychology": {
      "awareness_level": {
        "unaware": "Use pattern interrupt + curiosity",
        "problem_aware": "Use pain + mistake hooks",
        "solution_aware": "Use contrarian + outcome hooks",
        "product_aware": "Use identity + social proof hooks"
      },
      "scroll_state": {
        "passive": "Shock value needed",
        "active_searching": "Specificity wins",
        "end_of_session": "Emotional hooks work better"
      },
      "trust_level": {
        "cold": "Avoid claims, use questions",
        "warm": "Direct statements work",
        "hot": "Identity callouts convert"
      }
    },
    "hook_strategy_matrix": [
      {"goal": "views", "audience_type": "cold", "primary": ["curiosity", "pattern_interrupt"], "secondary": ["contrarian"]},
      {"goal": "saves", "tone": "educational", "primary": ["mistake", "checklist"], "secondary": ["pain"]},
      {"goal": "follows", "creator_persona": "expert", "primary": ["authority", "identity"], "secondary": ["contrarian"]},
      {"goal": "clicks", "urgency": "high", "primary": ["pain", "fomo"], "secondary": ["curiosity"]}
    ],
    "anti_patterns": [
      ["shock", "educational"],
      ["fomo", "calm_tone"],
      ["authority", "beginner_persona"]
    ],
    "always_pair": [
      ["pain", "solution_hint"],
      ["contrarian", "proof_element"],
      ["curiosity", "specificity"]
    ],
    "hard_rules": {
      "word_count_max": 12,
      "banned_phrases": ["Did you know", "most people", "nobody talks about", "you won''t believe"],
      "first_word_strength": ["You", "Stop", "This", "I", "The"],
      "spoken_style": true,
      "no_emojis": true,
      "avoid_clickbait_lies": true
    },
    "scoring_criteria": {
      "scroll_stop": {"weight": 0.40, "description": "Stops thumb mid-scroll"},
      "clarity": {"weight": 0.25, "description": "Immediately clear what it''s about"},
      "emotional_pull": {"weight": 0.25, "description": "Triggers emotion (curiosity, fear, FOMO)"},
      "specificity": {"weight": 0.10, "description": "Specific, not generic"}
    }
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

GRANT ALL ON public.reel_hook_generations TO service_role;
GRANT ALL ON public.reel_hook_generation_logs TO service_role;

-- Allow authenticated users to access tables (via RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reel_hook_generations TO authenticated;
GRANT SELECT, INSERT ON public.reel_hook_generation_logs TO authenticated;
