-- Migration: Core table updates for Nano Banana Image Generation System
-- Description: Adds new columns to ai_generated_images for iteration tracking,
--              status management, idempotency, cost tracking, storage, and sharing

-- Add new columns to ai_generated_images table
-- Using IF NOT EXISTS pattern for safety

-- Iteration tracking
ALTER TABLE public.ai_generated_images
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.ai_generated_images(id);

ALTER TABLE public.ai_generated_images
ADD COLUMN IF NOT EXISTS version_number INTEGER DEFAULT 1;

ALTER TABLE public.ai_generated_images
ADD COLUMN IF NOT EXISTS edit_instruction TEXT;

-- Generation state (CRITICAL: prevents zombie rows)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'ai_generated_images'
    AND column_name = 'generation_status'
  ) THEN
    ALTER TABLE public.ai_generated_images
    ADD COLUMN generation_status TEXT DEFAULT 'pending'
    CHECK (generation_status IN ('pending', 'processing', 'completed', 'failed'));
  END IF;
END $$;

-- Idempotency (CRITICAL: prevents duplicate billing on retries)
ALTER TABLE public.ai_generated_images
ADD COLUMN IF NOT EXISTS request_id UUID;

-- Add unique constraint on request_id if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ai_generated_images_request_id_key'
  ) THEN
    ALTER TABLE public.ai_generated_images
    ADD CONSTRAINT ai_generated_images_request_id_key UNIQUE (request_id);
  END IF;
END $$;

-- Cost tracking (resolution-based)
ALTER TABLE public.ai_generated_images
ADD COLUMN IF NOT EXISTS cost_cents DECIMAL(10,6) DEFAULT 0;

ALTER TABLE public.ai_generated_images
ADD COLUMN IF NOT EXISTS generation_time_ms INTEGER;

ALTER TABLE public.ai_generated_images
ADD COLUMN IF NOT EXISTS model_name TEXT DEFAULT 'gemini-2.5-flash-image';

-- Storage (path only, not blob)
ALTER TABLE public.ai_generated_images
ADD COLUMN IF NOT EXISTS storage_path TEXT;

ALTER TABLE public.ai_generated_images
ADD COLUMN IF NOT EXISTS storage_bucket TEXT DEFAULT 'ai-images';

-- SynthID & Safety
ALTER TABLE public.ai_generated_images
ADD COLUMN IF NOT EXISTS synthid_embedded BOOLEAN DEFAULT true;

ALTER TABLE public.ai_generated_images
ADD COLUMN IF NOT EXISTS aspect_ratio TEXT;

ALTER TABLE public.ai_generated_images
ADD COLUMN IF NOT EXISTS safety_scores JSONB;

-- Team sharing
ALTER TABLE public.ai_generated_images
ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT false;

ALTER TABLE public.ai_generated_images
ADD COLUMN IF NOT EXISTS shared_folder_id UUID;

-- Soft delete (prevents accidental data loss)
ALTER TABLE public.ai_generated_images
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Hash dedupe (prevents storing identical images)
ALTER TABLE public.ai_generated_images
ADD COLUMN IF NOT EXISTS image_hash TEXT;

-- Admin override tracking
ALTER TABLE public.ai_generated_images
ADD COLUMN IF NOT EXISTS override_used BOOLEAN DEFAULT false;

ALTER TABLE public.ai_generated_images
ADD COLUMN IF NOT EXISTS override_by UUID REFERENCES public.users(id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_images_parent_id
ON public.ai_generated_images(parent_id);

CREATE INDEX IF NOT EXISTS idx_ai_images_shared
ON public.ai_generated_images(is_shared)
WHERE is_shared = true;

CREATE INDEX IF NOT EXISTS idx_ai_images_request_id
ON public.ai_generated_images(request_id);

CREATE INDEX IF NOT EXISTS idx_ai_images_status
ON public.ai_generated_images(generation_status);

CREATE INDEX IF NOT EXISTS idx_ai_images_hash
ON public.ai_generated_images(image_hash)
WHERE image_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_images_deleted
ON public.ai_generated_images(deleted_at)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ai_images_user_created
ON public.ai_generated_images(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_images_model
ON public.ai_generated_images(model_name);

-- Function to get image version chain (recursive CTE)
CREATE OR REPLACE FUNCTION get_image_version_chain(p_image_id UUID)
RETURNS TABLE (
  id UUID,
  parent_id UUID,
  version_number INTEGER,
  prompt TEXT,
  edit_instruction TEXT,
  image_url TEXT,
  storage_path TEXT,
  created_at TIMESTAMPTZ,
  generation_status TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE version_chain AS (
    -- Base case: find the root (earliest version)
    SELECT
      img.id,
      img.parent_id,
      img.version_number,
      img.prompt,
      img.edit_instruction,
      img.image_url,
      img.storage_path,
      img.created_at,
      img.generation_status
    FROM public.ai_generated_images img
    WHERE img.id = p_image_id

    UNION ALL

    -- Recursive case: find parent versions
    SELECT
      parent.id,
      parent.parent_id,
      parent.version_number,
      parent.prompt,
      parent.edit_instruction,
      parent.image_url,
      parent.storage_path,
      parent.created_at,
      parent.generation_status
    FROM public.ai_generated_images parent
    INNER JOIN version_chain vc ON parent.id = vc.parent_id
    WHERE parent.deleted_at IS NULL
  )
  SELECT * FROM version_chain
  ORDER BY version_number ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get all children of an image (future versions)
CREATE OR REPLACE FUNCTION get_image_children(p_image_id UUID)
RETURNS TABLE (
  id UUID,
  parent_id UUID,
  version_number INTEGER,
  prompt TEXT,
  edit_instruction TEXT,
  image_url TEXT,
  storage_path TEXT,
  created_at TIMESTAMPTZ,
  generation_status TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE children AS (
    -- Base case: direct children
    SELECT
      img.id,
      img.parent_id,
      img.version_number,
      img.prompt,
      img.edit_instruction,
      img.image_url,
      img.storage_path,
      img.created_at,
      img.generation_status
    FROM public.ai_generated_images img
    WHERE img.parent_id = p_image_id
    AND img.deleted_at IS NULL

    UNION ALL

    -- Recursive case: children of children
    SELECT
      child.id,
      child.parent_id,
      child.version_number,
      child.prompt,
      child.edit_instruction,
      child.image_url,
      child.storage_path,
      child.created_at,
      child.generation_status
    FROM public.ai_generated_images child
    INNER JOIN children c ON child.parent_id = c.id
    WHERE child.deleted_at IS NULL
  )
  SELECT * FROM children
  ORDER BY version_number ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Update RLS policies for shared images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ai_generated_images'
    AND policyname = 'Users can view shared images'
  ) THEN
    CREATE POLICY "Users can view shared images"
    ON public.ai_generated_images
    FOR SELECT
    USING (is_shared = true AND deleted_at IS NULL);
  END IF;
END $$;

-- Add policy for viewing version chains (user can see all versions of their images)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ai_generated_images'
    AND policyname = 'Users can view their image version chains'
  ) THEN
    CREATE POLICY "Users can view their image version chains"
    ON public.ai_generated_images
    FOR SELECT
    USING (
      auth.uid() = user_id
      OR EXISTS (
        SELECT 1 FROM public.ai_generated_images parent
        WHERE parent.id = ai_generated_images.parent_id
        AND parent.user_id = auth.uid()
      )
    );
  END IF;
END $$;

-- Comments for documentation
COMMENT ON COLUMN public.ai_generated_images.parent_id IS 'Reference to parent image for edit chains';
COMMENT ON COLUMN public.ai_generated_images.version_number IS 'Version number in edit chain (1 = original)';
COMMENT ON COLUMN public.ai_generated_images.edit_instruction IS 'User instruction for this edit';
COMMENT ON COLUMN public.ai_generated_images.generation_status IS 'Current generation status: pending, processing, completed, failed';
COMMENT ON COLUMN public.ai_generated_images.request_id IS 'Client-generated UUID for idempotency';
COMMENT ON COLUMN public.ai_generated_images.cost_cents IS 'Generation cost in cents (resolution-based)';
COMMENT ON COLUMN public.ai_generated_images.storage_path IS 'Path in Supabase Storage bucket (never store blobs in DB)';
COMMENT ON COLUMN public.ai_generated_images.synthid_embedded IS 'Whether SynthID watermark is present';
COMMENT ON COLUMN public.ai_generated_images.image_hash IS 'SHA256 hash for deduplication';
COMMENT ON COLUMN public.ai_generated_images.deleted_at IS 'Soft delete timestamp';
