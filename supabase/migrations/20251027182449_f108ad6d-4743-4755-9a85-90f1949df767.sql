-- Add migration tracking column to company_knowledge_base
ALTER TABLE company_knowledge_base 
ADD COLUMN IF NOT EXISTS migrated_to_file_id UUID REFERENCES knowledge_files(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_company_knowledge_base_migrated 
ON company_knowledge_base(migrated_to_file_id);

COMMENT ON COLUMN company_knowledge_base.migrated_to_file_id IS 'References the knowledge_files record this entry was migrated to in the unified system';
