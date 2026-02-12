-- Agent Cost Tracking Phase 1 - Schema Migration
-- Adds cost, token, provider, and timing tracking to AI agent runs

-- Add cost tracking columns to ai_agent_runs table
ALTER TABLE public.ai_agent_runs
ADD COLUMN IF NOT EXISTS cost_usd DECIMAL(10,6),
ADD COLUMN IF NOT EXISTS total_tokens INTEGER,
ADD COLUMN IF NOT EXISTS prompt_tokens INTEGER,
ADD COLUMN IF NOT EXISTS completion_tokens INTEGER,
ADD COLUMN IF NOT EXISTS model_provider TEXT,
ADD COLUMN IF NOT EXISTS model_version TEXT,
ADD COLUMN IF NOT EXISTS execution_time_ms INTEGER;

-- Add cost tracking columns to agent_execution_steps table
ALTER TABLE public.agent_execution_steps
ADD COLUMN IF NOT EXISTS cost_usd DECIMAL(10,6),
ADD COLUMN IF NOT EXISTS tokens_used INTEGER,
ADD COLUMN IF NOT EXISTS prompt_tokens INTEGER,
ADD COLUMN IF NOT EXISTS completion_tokens INTEGER,
ADD COLUMN IF NOT EXISTS model_used TEXT;

-- Create index for fast per-user time-range queries
CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_user_time
ON public.ai_agent_runs(executed_by, created_at DESC);

-- Create view for per-user 30-day rollup
CREATE OR REPLACE VIEW agent_cost_summary AS
SELECT
  executed_by,
  COUNT(*) as total_runs,
  COALESCE(SUM(cost_usd), 0) as total_cost_usd,
  CASE
    WHEN COUNT(*) > 0 THEN COALESCE(SUM(cost_usd), 0) / COUNT(*)
    ELSE 0
  END as avg_cost_per_run,
  DATE_TRUNC('day', NOW()) as report_date
FROM public.ai_agent_runs
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY executed_by;

-- Create view for per-day rollup
CREATE OR REPLACE VIEW agent_daily_cost_stats AS
SELECT
  DATE_TRUNC('day', created_at)::date as day,
  COUNT(*) as total_runs,
  COALESCE(SUM(cost_usd), 0) as total_cost_usd,
  COALESCE(SUM(total_tokens), 0) as total_tokens,
  COUNT(DISTINCT executed_by) as unique_users
FROM public.ai_agent_runs
WHERE created_at >= NOW() - INTERVAL '90 days'
GROUP BY DATE_TRUNC('day', created_at);
