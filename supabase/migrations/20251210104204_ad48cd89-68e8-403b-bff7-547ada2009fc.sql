-- Add brand knowledge base support to shared knowledge tables

-- 1) Add brand association and uploader tracking to knowledge_files
ALTER TABLE public.knowledge_files
  ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE;

ALTER TABLE public.knowledge_files
  ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_knowledge_files_brand_id
  ON public.knowledge_files(brand_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_files_uploaded_by
  ON public.knowledge_files(uploaded_by);

CREATE INDEX IF NOT EXISTS idx_knowledge_files_brand_status
  ON public.knowledge_files(brand_id, processing_status)
  WHERE brand_id IS NOT NULL;

-- 2) Update knowledge_sources to support brand-specific sources
ALTER TABLE public.knowledge_sources
  ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE;

-- Allow brand-only sources by relaxing category constraint
ALTER TABLE public.knowledge_sources
  ALTER COLUMN category_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'knowledge_sources'
      AND constraint_name = 'knowledge_sources_brand_or_category_check'
  ) THEN
    ALTER TABLE public.knowledge_sources
      ADD CONSTRAINT knowledge_sources_brand_or_category_check
      CHECK (
        (brand_id IS NOT NULL AND category_id IS NULL) OR
        (brand_id IS NULL AND category_id IS NOT NULL)
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_knowledge_sources_brand_id
  ON public.knowledge_sources(brand_id);

-- 3) Add scope/brand support to knowledge_base_categories
ALTER TABLE public.knowledge_base_categories
  ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'global' CHECK (scope IN ('global', 'brand'));

ALTER TABLE public.knowledge_base_categories
  ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'knowledge_base_categories'
      AND constraint_name = 'check_brand_category_has_brand_id'
  ) THEN
    ALTER TABLE public.knowledge_base_categories
      ADD CONSTRAINT check_brand_category_has_brand_id
      CHECK (
        (scope = 'global' AND brand_id IS NULL) OR
        (scope = 'brand' AND brand_id IS NOT NULL)
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_knowledge_base_categories_brand
  ON public.knowledge_base_categories(brand_id, scope)
  WHERE brand_id IS NOT NULL;

-- 4) Update knowledge_files RLS policies for brand-aware access control
ALTER TABLE public.knowledge_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage files" ON public.knowledge_files;
DROP POLICY IF EXISTS "knowledge_files_read" ON public.knowledge_files;
DROP POLICY IF EXISTS "knowledge_files_all" ON public.knowledge_files;

CREATE POLICY "Knowledge files accessible by brand or role"
  ON public.knowledge_files
  FOR SELECT
  USING (
    brand_id IS NULL
    OR user_has_brand_access(auth.uid(), brand_id)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  );

CREATE POLICY "Upload knowledge files within access"
  ON public.knowledge_files
  FOR INSERT
  WITH CHECK (
    (
      brand_id IS NOT NULL
      AND uploaded_by = auth.uid()
      AND user_has_brand_access(auth.uid(), brand_id)
    )
    OR (
      brand_id IS NULL
      AND (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
    )
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  );

CREATE POLICY "Update own knowledge files"
  ON public.knowledge_files
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR (
      brand_id IS NOT NULL
      AND uploaded_by = auth.uid()
      AND user_has_brand_access(auth.uid(), brand_id)
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR (
      brand_id IS NOT NULL
      AND uploaded_by = auth.uid()
      AND user_has_brand_access(auth.uid(), brand_id)
    )
  );

CREATE POLICY "Delete own knowledge files"
  ON public.knowledge_files
  FOR DELETE
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR (
      brand_id IS NOT NULL
      AND uploaded_by = auth.uid()
      AND user_has_brand_access(auth.uid(), brand_id)
    )
  );