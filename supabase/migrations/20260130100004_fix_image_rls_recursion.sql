-- Migration: Fix infinite recursion in ai_generated_images RLS policies
-- Problem: "Users can view their image version chains" policy queries the same table, causing recursion

-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "Users can view their image version chains" ON public.ai_generated_images;

-- Drop any duplicate/conflicting policies
DROP POLICY IF EXISTS "Users can view shared images" ON public.ai_generated_images;

-- Ensure RLS is enabled
ALTER TABLE public.ai_generated_images ENABLE ROW LEVEL SECURITY;

-- Simple policy: Users can see their own images (non-deleted)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ai_generated_images'
    AND policyname = 'Users can view own images'
  ) THEN
    CREATE POLICY "Users can view own images"
    ON public.ai_generated_images
    FOR SELECT
    USING (auth.uid() = user_id AND deleted_at IS NULL);
  END IF;
END $$;

-- Policy: Users can view shared images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ai_generated_images'
    AND policyname = 'Users can view shared images v2'
  ) THEN
    CREATE POLICY "Users can view shared images v2"
    ON public.ai_generated_images
    FOR SELECT
    USING (is_shared = true AND deleted_at IS NULL);
  END IF;
END $$;

-- Policy: Users can insert their own images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ai_generated_images'
    AND policyname = 'Users can insert own images'
  ) THEN
    CREATE POLICY "Users can insert own images"
    ON public.ai_generated_images
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Policy: Users can update their own images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ai_generated_images'
    AND policyname = 'Users can update own images'
  ) THEN
    CREATE POLICY "Users can update own images"
    ON public.ai_generated_images
    FOR UPDATE
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- Policy: Service role can do anything (for edge functions)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ai_generated_images'
    AND policyname = 'Service role has full access'
  ) THEN
    CREATE POLICY "Service role has full access"
    ON public.ai_generated_images
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');
  END IF;
END $$;

-- Create SECURITY DEFINER function for version chain lookup (bypasses RLS)
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
)
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_image_owner UUID;
BEGIN
  -- Get current user
  v_user_id := auth.uid();

  -- Get the owner of the requested image
  SELECT user_id INTO v_image_owner
  FROM public.ai_generated_images
  WHERE ai_generated_images.id = p_image_id;

  -- Only return results if user owns the image
  IF v_user_id IS NULL OR v_user_id != v_image_owner THEN
    RETURN;
  END IF;

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
  ORDER BY version_chain.version_number ASC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_image_version_chain IS 'Get all versions in an image edit chain. SECURITY DEFINER to bypass RLS safely.';
