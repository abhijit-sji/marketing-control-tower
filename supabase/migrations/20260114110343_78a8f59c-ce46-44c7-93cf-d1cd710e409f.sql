-- Drop the existing doc_category check constraint
ALTER TABLE documentation_templates DROP CONSTRAINT documentation_templates_doc_category_check;

-- Add new check constraint with marketing doc categories
ALTER TABLE documentation_templates ADD CONSTRAINT documentation_templates_doc_category_check 
CHECK (doc_category = ANY (ARRAY['api', 'component', 'architecture', 'setup', 'readme', 'changelog', 'inline_comments', 'tutorial', 'brand_voice', 'playbook', 'campaign', 'sop', 'social_guidelines', 'onboarding']));

-- Update the documentation-generator agent to Brand Docs Generator
UPDATE ai_agents 
SET 
  name = 'Brand Docs Generator',
  slug = 'brand-docs-generator',
  description = 'Generate marketing documentation including brand voice guidelines, content playbooks, campaign briefs, and team SOPs',
  category = 'content_generation',
  scope = 'brand',
  data_sources = '["brand_knowledge", "brand_analytics", "brand_kpis"]'::jsonb,
  system_prompt = 'You are a brand marketing documentation specialist. Generate comprehensive, actionable documentation tailored to the brand''s voice, values, and strategic goals. Your documentation should be practical, well-structured, and immediately usable by marketing teams.',
  updated_at = now()
WHERE slug = 'documentation-generator';

-- Deactivate old code-focused templates
UPDATE documentation_templates SET is_active = false WHERE is_active = true;

-- Insert new marketing documentation templates
INSERT INTO documentation_templates (template_name, doc_category, sections_template, system_prompt, output_format, is_active)
VALUES 
  (
    'Brand Voice Guidelines',
    'brand_voice',
    '["tone_definition", "vocabulary", "dos_and_donts", "examples_by_channel", "personas"]'::jsonb,
    'Create comprehensive brand voice guidelines that define how the brand communicates across all channels. Include specific examples, word choices to use and avoid, and tone variations for different contexts.',
    'markdown',
    true
  ),
  (
    'Content Playbook',
    'playbook',
    '["strategy_overview", "content_pillars", "channel_guidelines", "content_calendar", "metrics_and_kpis"]'::jsonb,
    'Develop a complete content playbook that serves as the master guide for all content creation. Include strategic foundations, content types, publishing cadence, and success metrics.',
    'markdown',
    true
  ),
  (
    'Campaign Brief',
    'campaign',
    '["objective", "target_audience", "key_messages", "channels", "timeline", "budget_allocation", "success_metrics"]'::jsonb,
    'Create a detailed campaign brief that provides all information needed to execute a marketing campaign. Be specific about goals, audiences, and deliverables.',
    'markdown',
    true
  ),
  (
    'Team SOP',
    'sop',
    '["purpose", "scope", "workflow_steps", "tools_required", "responsibilities", "escalation_procedures", "quality_checklist"]'::jsonb,
    'Document standard operating procedures for marketing team workflows. Include step-by-step instructions, decision points, and quality checkpoints.',
    'markdown',
    true
  ),
  (
    'Social Media Guidelines',
    'social_guidelines',
    '["platform_overview", "posting_rules", "engagement_guidelines", "hashtag_strategy", "crisis_response", "legal_compliance"]'::jsonb,
    'Create platform-specific social media guidelines that ensure consistent brand presence across all social channels. Include best practices, restrictions, and crisis management protocols.',
    'markdown',
    true
  ),
  (
    'Client Onboarding Doc',
    'onboarding',
    '["welcome_message", "service_overview", "expectations", "communication_protocol", "timeline", "key_contacts", "faq"]'::jsonb,
    'Develop a client-facing onboarding document that sets clear expectations and provides all necessary information for a successful partnership.',
    'markdown',
    true
  );