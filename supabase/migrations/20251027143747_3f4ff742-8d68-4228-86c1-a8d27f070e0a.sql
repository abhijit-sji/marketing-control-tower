-- Phase 1: Unified Knowledge System - Agent Knowledge Selection
-- Create table to track which knowledge categories each AI agent uses

CREATE TABLE IF NOT EXISTS ai_agent_knowledge_selection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES company_knowledge_categories(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 5 CHECK (priority >= 0 AND priority <= 10),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agent_id, category_id)
);

-- Add updated_at trigger
CREATE TRIGGER update_ai_agent_knowledge_selection_updated_at
BEFORE UPDATE ON ai_agent_knowledge_selection
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE ai_agent_knowledge_selection ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage agent knowledge selections"
ON ai_agent_knowledge_selection
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role) 
  OR has_role(auth.uid(), 'manager'::app_role)
);

-- Create default knowledge sources for existing categories
-- Each category gets a "Manual Uploads" source if it doesn't exist
INSERT INTO knowledge_sources (category_id, name, type, config, is_active)
SELECT 
  ckc.id as category_id,
  'Manual Uploads' as name,
  'manual' as type,
  jsonb_build_object(
    'bucket', 'knowledge', 
    'folder', 'manual-' || ckc.id::text
  ) as config,
  true as is_active
FROM company_knowledge_categories ckc
WHERE ckc.is_active = true
  AND NOT EXISTS (
    SELECT 1 
    FROM knowledge_sources ks 
    WHERE ks.category_id = ckc.id 
    AND ks.type = 'manual'
  );

-- Add helpful comment
COMMENT ON TABLE ai_agent_knowledge_selection IS 'Tracks which knowledge categories each AI agent can access, with priority weighting for relevance';
COMMENT ON COLUMN ai_agent_knowledge_selection.priority IS 'Priority level from 0-10, where 10 is highest importance for the agent';