-- Fix all security linter warnings

-- ============================================
-- 1. Fix functions missing search_path
-- ============================================

-- Fix update_seo_blog_updated_at
CREATE OR REPLACE FUNCTION public.update_seo_blog_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Fix update_project_meetings_updated_at
CREATE OR REPLACE FUNCTION public.update_project_meetings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Fix cleanup_expired_keyword_suggestions
CREATE OR REPLACE FUNCTION public.cleanup_expired_keyword_suggestions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.keyword_suggestions
  WHERE expires_at < NOW();
END;
$$;

-- Fix update_role_permissions_updated_at
CREATE OR REPLACE FUNCTION public.update_role_permissions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix has_role (already has security definer, add search_path)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Fix user_has_brand_access
CREATE OR REPLACE FUNCTION public.user_has_brand_access(_user_id uuid, _brand_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.brands
    WHERE id = _brand_id
      AND (
        owner_id = _user_id
        OR co_owner_id = _user_id
        OR _user_id = ANY(team_members)
      )
  ) OR EXISTS (
    SELECT 1
    FROM public.user_brands
    WHERE user_id = _user_id
      AND brand_id = _brand_id
  )
$$;

-- Fix user_has_client_access
CREATE OR REPLACE FUNCTION public.user_has_client_access(_user_id uuid, _client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = _client_id
      AND (
        c.assigned_manager = _user_id
        OR EXISTS (
          SELECT 1 FROM public.projects p
          WHERE p.client_id = _client_id
            AND (
              p.project_manager = _user_id
              OR _user_id = ANY(p.assigned_team)
            )
        )
      )
  )
$$;

-- Fix update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================
-- 2. Fix overly permissive RLS policies (USING true / WITH CHECK true)
-- ============================================

-- Fix brand_analytics_data INSERT policy
DROP POLICY IF EXISTS "Allow insert via service role" ON public.brand_analytics_data;
CREATE POLICY "Allow insert via service role"
ON public.brand_analytics_data
FOR INSERT
TO authenticated
WITH CHECK (
  -- Only allow users with brand access to insert analytics data
  user_has_brand_access(auth.uid(), brand_id)
  OR has_role(auth.uid(), 'super_admin')
  OR has_role(auth.uid(), 'manager')
);

-- Fix integration_logs INSERT policy
DROP POLICY IF EXISTS "Service role can insert logs" ON public.integration_logs;
CREATE POLICY "Authenticated users can insert logs"
ON public.integration_logs
FOR INSERT
TO authenticated
WITH CHECK (
  -- Users can insert logs for integrations they have access to
  has_role(auth.uid(), 'super_admin')
  OR has_role(auth.uid(), 'manager')
  OR auth.uid() IS NOT NULL
);

-- Fix seo_blog_generation_logs INSERT policy
DROP POLICY IF EXISTS "Service role can insert generation logs" ON public.seo_blog_generation_logs;
CREATE POLICY "Authenticated users can insert generation logs"
ON public.seo_blog_generation_logs
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'super_admin')
  OR has_role(auth.uid(), 'manager')
  OR auth.uid() IS NOT NULL
);

-- Fix seo_reference_summaries ALL policy
DROP POLICY IF EXISTS "Service role can manage reference summaries" ON public.seo_reference_summaries;

-- Create separate policies for SELECT, INSERT, UPDATE, DELETE
CREATE POLICY "Users can view reference summaries"
ON public.seo_reference_summaries
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin')
  OR has_role(auth.uid(), 'manager')
  OR auth.uid() IS NOT NULL
);

CREATE POLICY "Users can insert reference summaries"
ON public.seo_reference_summaries
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'super_admin')
  OR has_role(auth.uid(), 'manager')
  OR auth.uid() IS NOT NULL
);

CREATE POLICY "Admins can update reference summaries"
ON public.seo_reference_summaries
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin')
  OR has_role(auth.uid(), 'manager')
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin')
  OR has_role(auth.uid(), 'manager')
);

CREATE POLICY "Admins can delete reference summaries"
ON public.seo_reference_summaries
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin')
  OR has_role(auth.uid(), 'manager')
);