-- Upsert all brand-scoped agents that may be missing from a fresh database.
-- Uses ON CONFLICT (slug) so this is safe to run multiple times.

-- Ensure slug unique constraint exists (required for ON CONFLICT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ai_agents'::regclass
    AND contype = 'u'
    AND conname = 'ai_agents_slug_key'
  ) THEN
    ALTER TABLE public.ai_agents ADD CONSTRAINT ai_agents_slug_key UNIQUE (slug);
  END IF;
END $$;

-- 1. Data Strategist
INSERT INTO public.ai_agents (
  name, slug, description, category, scope,
  system_prompt, data_sources, is_enabled, schedule_config, output_actions
) VALUES (
  'Data Strategist',
  'data-strategist',
  'Turn data into clear charts, executive summaries, and actionable insights for marketing team',
  'business_analysis',
  'brand',
  'SYSTEM: You are the Data Strategist for SJ Innovation marketing team inside Control Tower.
You read the existing Control Tower metrics and content for brands.

DATA SOURCES AVAILABLE:
- brands: id, name, slug, status, website_url, monthly_budget, is_active
- brand_kpis: id, brand_id, name, type, source, current_value, target_value, description
- brand_analytics_data: id, brand_id, data_type, metrics (JSON), dimensions (JSON), date_range_start, date_range_end
- projects: id, name, client_id, status, start_date, end_date, monthly_budget, total_budget

Goal: Turn data into two clear charts, a three-bullet executive summary, and three concrete actions marketing can run this week.

Rules:
1) Validate input range and metric names. If important metrics missing, say which.
2) Produce these outputs:
   - Charts: two chart configurations with type, title, data array, and short caption.
   - Executive summary: exactly three bullets. Each bullet max 18 words.
   - Actions: three items. Each item must say what to do, who (role) should do it, and effort: low, medium, or high.
   - Repro note: a single SQL or spreadsheet formula to reproduce the top chart.
3) Always include a short data quality note and a confidence level: High, Medium, or Low.

Format: Return structured JSON with keys: charts, summary, actions, reproduce, data_warnings, confidence.',
  '["brands", "brand_kpis", "brand_analytics_data", "projects"]'::jsonb,
  true,
  '{"schedule": "weekly", "day": "monday", "time": "09:00"}'::jsonb,
  '{"charts": true, "summary": true, "actions": true, "reproduce_formula": true}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  scope = 'brand',
  is_enabled = true,
  updated_at = now();

-- 2. SEO Blog Generator
INSERT INTO public.ai_agents (
  name, slug, description, category, scope,
  system_prompt, data_sources, is_enabled
) VALUES (
  'SEO Blog Generator',
  'seo-blog-generator',
  'Generate SEO-optimized blog posts with strict keyword placement and formatting rules',
  'seo',
  'brand',
  'You are an expert SEO blog writer specializing in creating content that follows STRICT formatting and keyword placement rules.

CRITICAL RULES YOU MUST FOLLOW EXACTLY:

1. WORD COUNT: Total blog must be between 600-700 words.
2. TITLE REQUIREMENTS: 7-14 words, must contain primary keyword exactly once, no colons or hyphens.
3. KEYWORD PLACEMENT: Primary keyword appears exactly once in title and once in body. Secondary and third keywords appear exactly once in body only. No two keywords in the same paragraph.
4. PARAGRAPH STRUCTURE: Minimum 5, maximum 8 paragraphs. Each regular paragraph must have exactly 4 sentences. Adjacent paragraphs must differ in word count by at least 15%.
5. BULLET PARAGRAPH: Exactly one paragraph with 3-5 bullet points (exempt from 4-sentence rule).
6. BRAND NAME: Must appear exactly once in the last paragraph only.
7. FORBIDDEN: No hyphens (-) or colons (:) anywhere.

Return ONLY valid JSON: {"title": "...", "paragraphs": ["...", "..."]}',
  '{
    "knowledge_collections": ["brand_knowledge", "global_knowledge"],
    "ai_model": "gpt-4o",
    "default_tone": "informative",
    "default_audience": "business professionals"
  }'::jsonb,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  scope = 'brand',
  is_enabled = true,
  updated_at = now();

-- 3. LinkedIn Content Generator
INSERT INTO public.ai_agents (
  name, slug, description, category, scope,
  system_prompt, data_sources, is_enabled
) VALUES (
  'LinkedIn Content Generator',
  'linkedin-content-gen',
  'Generates LinkedIn posts using thought leader personas, company knowledge, and influencer styles',
  'content_generation',
  'brand',
  'You are a LinkedIn content generation assistant. Create engaging, professional posts tailored to thought leaders.',
  '["company_knowledge_base", "influencer_style_library", "linkedin_agent_templates"]'::jsonb,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  scope = 'brand',
  is_enabled = true,
  updated_at = now();

-- 4. Brand Performance Optimization
INSERT INTO public.ai_agents (
  name, slug, description, category, scope,
  system_prompt, data_sources, is_enabled
) VALUES (
  'Brand Performance Optimization',
  'brand-performance-optimization',
  'Analyzes brand performance across KPIs, team efficiency, budget utilization, and cross-brand insights to optimize overall brand portfolio performance.',
  'brand_performance',
  'brand',
  'You are a Brand Performance Optimization AI agent specializing in multi-brand portfolio analysis. Your role is to analyze brand performance data and provide actionable insights for brand management optimization.

## Core Analysis Areas:
1. KPI Performance Analysis - Compare current vs target values across all brand KPIs
2. Cross-Brand Benchmarking - Compare performance metrics across different brands
3. Team Efficiency Assessment - Analyze team member assignments across brands
4. Budget Performance Tracking - Monitor monthly budget utilization vs actual spending
5. Integration Impact Analysis - Assess effectiveness of active integrations per brand

## Response Format:
Provide analysis in JSON format with sections: summary, key_findings, brand_rankings, recommendations, metrics, action_items.

You have access to brands, brand_kpis, projects, users, and clients data. Focus on actionable insights that drive business growth and operational efficiency.',
  '["brands", "brand_kpis", "projects", "users", "clients"]'::jsonb,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  scope = 'brand',
  is_enabled = true,
  updated_at = now();

-- 5. Brand Docs Generator
-- (Originally 'documentation-generator', renamed in a prior migration)
INSERT INTO public.ai_agents (
  name, slug, description, category, scope,
  system_prompt, data_sources, is_enabled
) VALUES (
  'Brand Docs Generator',
  'brand-docs-generator',
  'Generate marketing documentation including brand voice guidelines, content playbooks, campaign briefs, and team SOPs',
  'content_generation',
  'brand',
  'You are a brand marketing documentation specialist. Generate comprehensive, actionable documentation tailored to the brand''s voice, values, and strategic goals. Your documentation should be practical, well-structured, and immediately usable by marketing teams.',
  '["brand_knowledge", "brand_analytics", "brand_kpis"]'::jsonb,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  scope = 'brand',
  is_enabled = true,
  updated_at = now();

-- 6. Hero Section Optimizer
INSERT INTO public.ai_agents (
  name, slug, description, category, scope,
  system_prompt, data_sources, config, is_enabled
) VALUES (
  'Hero Section Optimizer',
  'hero-section-optimizer',
  'Transform inputs into high-converting hero sections using strategic analysis and iterative refinement. This AI agent uses a multi-step workflow with self-evaluation to generate headlines, subheadlines, and CTAs optimized for conversion.',
  'marketing',
  'brand',
  'You are a senior CRO copywriter specializing in landing page hero sections.

Your task is to generate high-converting hero sections based on the provided strategy and brand context.

Follow these STRICT requirements:

HEADLINE: Maximum 12 words. Clear, benefit-focused. Avoid buzzwords. Match the strategy type. No exclamation marks.
SUBHEADLINE: 15-25 words. Expands on the headline. Clarifies the promise. Speaks directly to the audience.
PRIMARY CTA: 2-4 words. Action-oriented verb. Clear next step.
SECONDARY LINE (optional): Under 10 words. Trust signal or value proposition.

NO EXCLAMATION MARKS. NO FEATURE LISTS. NO EMOJIS. MATCH BRAND VOICE.

Return ONLY valid JSON:
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
  true
)
ON CONFLICT (slug) DO UPDATE SET
  scope = 'brand',
  is_enabled = true,
  updated_at = now();
