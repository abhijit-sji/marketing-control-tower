-- Remove legacy Code Analysis and Code Generation tables
DROP TABLE IF EXISTS public.code_analysis_results CASCADE;
DROP TABLE IF EXISTS public.code_generation_templates CASCADE;
DROP TABLE IF EXISTS public.code_repositories CASCADE;
