-- Phase 1: Database Schema for Multi-Agent Shared Knowledge

-- Create company_knowledge_files table to track files uploaded to OpenAI
CREATE TABLE company_knowledge_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_id UUID REFERENCES company_knowledge_base(id) ON DELETE CASCADE,
  knowledge_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  openai_file_id TEXT,
  file_size BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_company_knowledge_files_knowledge_id ON company_knowledge_files(knowledge_id);
CREATE INDEX idx_company_knowledge_files_openai_file ON company_knowledge_files(openai_file_id) WHERE openai_file_id IS NOT NULL;

COMMENT ON TABLE company_knowledge_files IS 'Tracks company knowledge entries uploaded to OpenAI for vector store';
COMMENT ON COLUMN company_knowledge_files.openai_file_id IS 'OpenAI file ID for indexed knowledge';

-- Create ai_shared_resources table to store shared vector store IDs
CREATE TABLE ai_shared_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type TEXT NOT NULL,
  resource_name TEXT NOT NULL UNIQUE,
  openai_resource_id TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(resource_type, resource_name)
);

CREATE INDEX idx_ai_shared_resources_type_name ON ai_shared_resources(resource_type, resource_name);

COMMENT ON TABLE ai_shared_resources IS 'Stores shared AI resources like vector stores for multi-agent systems';
COMMENT ON COLUMN ai_shared_resources.openai_resource_id IS 'OpenAI resource ID (e.g., vs_xxx for vector stores)';

-- Enable RLS
ALTER TABLE company_knowledge_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_shared_resources ENABLE ROW LEVEL SECURITY;

-- RLS Policies for company_knowledge_files
CREATE POLICY "company_knowledge_files_read" ON company_knowledge_files
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin') OR 
    has_role(auth.uid(), 'manager') OR 
    has_role(auth.uid(), 'pm')
  );

CREATE POLICY "company_knowledge_files_manage" ON company_knowledge_files
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin') OR 
    has_role(auth.uid(), 'manager')
  );

-- RLS Policies for ai_shared_resources
CREATE POLICY "ai_shared_resources_read" ON ai_shared_resources
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin') OR 
    has_role(auth.uid(), 'manager') OR 
    has_role(auth.uid(), 'pm')
  );

CREATE POLICY "ai_shared_resources_manage" ON ai_shared_resources
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin') OR 
    has_role(auth.uid(), 'manager')
  );