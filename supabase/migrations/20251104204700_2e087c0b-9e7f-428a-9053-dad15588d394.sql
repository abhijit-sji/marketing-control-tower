-- Rename company_knowledge_* tables to knowledge_base_*

-- Rename company_knowledge_categories to knowledge_base_categories
ALTER TABLE IF EXISTS company_knowledge_categories 
RENAME TO knowledge_base_categories;

-- Rename company_knowledge_base to knowledge_base
ALTER TABLE IF EXISTS company_knowledge_base 
RENAME TO knowledge_base;

-- Rename company_knowledge_files to knowledge_base_files
ALTER TABLE IF EXISTS company_knowledge_files 
RENAME TO knowledge_base_files;