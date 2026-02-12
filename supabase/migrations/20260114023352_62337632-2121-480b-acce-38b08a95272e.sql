-- Add AI pipeline configuration to thought_leaders
ALTER TABLE thought_leaders ADD COLUMN IF NOT EXISTS
  ai_pipeline_config JSONB DEFAULT '{
    "use_dual_model": true,
    "research_model": "gemini",
    "writing_model": "claude",
    "research_depth": "standard"
  }'::jsonb;

COMMENT ON COLUMN thought_leaders.ai_pipeline_config IS 
'Configuration for the dual-model AI pipeline: research (Gemini) + writing (Claude/GPT-5)';