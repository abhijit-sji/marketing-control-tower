-- ============================================================================
-- Critical Security Fix: Restrict Sensitive Data Access to Admin/SuperAdmin Only
-- ============================================================================
-- Fixes 7 critical security bugs:
-- 1. feedback_reports - Fix INSERT policy to prevent impersonation
-- 2. user_activecollab_settings - Restrict to admin/superadmin only
-- 3. activecollab_credentials - Verify superadmin only (already correct, but ensure)
-- 4. brand_analytics_integrations - Restrict sensitive columns to admin/superadmin
-- 5. gohighlevel_integrations - Restrict api_key_encrypted to admin/superadmin
-- 6. control_tower_api_keys - Restrict to superadmin only (remove manager access)
-- 7. n8n_workflow_configs - Restrict to superadmin only (remove manager access)
-- ============================================================================

-- Helper function to check if user is admin or superadmin
CREATE OR REPLACE FUNCTION public.is_admin_or_superadmin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id 
    AND role IN ('super_admin'::app_role, 'manager'::app_role)
  )
$$;

-- Helper function to check if user is superadmin only
CREATE OR REPLACE FUNCTION public.is_superadmin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id 
    AND role = 'super_admin'::app_role
  )
$$;

-- ============================================================================
-- 1. FIX: feedback_reports INSERT policy to prevent impersonation
-- ============================================================================
DROP POLICY IF EXISTS "All authenticated users can create feedback" ON public.feedback_reports;

CREATE POLICY "Users can create feedback (no impersonation)"
  ON public.feedback_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- ============================================================================
-- 2. FIX: user_activecollab_settings - Restrict to admin/superadmin only
-- ============================================================================
-- First, check if table exists and create if needed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_activecollab_settings'
  ) THEN
    CREATE TABLE IF NOT EXISTS public.user_activecollab_settings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      activecollab_username text NOT NULL,
      activecollab_password text NOT NULL,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      UNIQUE(user_id)
    );
    
    ALTER TABLE public.user_activecollab_settings ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view own ActiveCollab settings" ON public.user_activecollab_settings;
DROP POLICY IF EXISTS "Users can manage own ActiveCollab settings" ON public.user_activecollab_settings;
DROP POLICY IF EXISTS "Admins can view ActiveCollab settings" ON public.user_activecollab_settings;

-- Only admin and superadmin can access
CREATE POLICY "Admins can view ActiveCollab settings"
  ON public.user_activecollab_settings FOR SELECT
  TO authenticated
  USING (public.is_admin_or_superadmin(auth.uid()));

CREATE POLICY "Admins can insert ActiveCollab settings"
  ON public.user_activecollab_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_superadmin(auth.uid()));

CREATE POLICY "Admins can update ActiveCollab settings"
  ON public.user_activecollab_settings FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_superadmin(auth.uid()))
  WITH CHECK (public.is_admin_or_superadmin(auth.uid()));

CREATE POLICY "Admins can delete ActiveCollab settings"
  ON public.user_activecollab_settings FOR DELETE
  TO authenticated
  USING (public.is_admin_or_superadmin(auth.uid()));

-- ============================================================================
-- 3. VERIFY: activecollab_credentials - Ensure superadmin only
-- ============================================================================
-- Drop and recreate policies to ensure they're correct
DROP POLICY IF EXISTS "Super admins can manage ActiveCollab credentials" ON public.activecollab_credentials;
DROP POLICY IF EXISTS "Super admins can view activecollab credentials" ON public.activecollab_credentials;
DROP POLICY IF EXISTS "Super admins can insert activecollab credentials" ON public.activecollab_credentials;
DROP POLICY IF EXISTS "Super admins can update activecollab credentials" ON public.activecollab_credentials;
DROP POLICY IF EXISTS "Super admins can delete activecollab credentials" ON public.activecollab_credentials;

-- Only superadmin can access (not manager)
CREATE POLICY "Super admins can manage ActiveCollab credentials"
  ON public.activecollab_credentials FOR ALL
  TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

-- ============================================================================
-- 4. FIX: brand_analytics_integrations - Restrict sensitive columns
-- ============================================================================
-- Drop existing policies
DROP POLICY IF EXISTS "Marketing team can manage brand analytics integrations" ON public.brand_analytics_integrations;

-- Create view without sensitive columns for non-admin users
-- Excludes: webhook_secret, access_token_encrypted, refresh_token_encrypted, service_account_key_encrypted
CREATE OR REPLACE VIEW public.brand_analytics_integrations_safe AS
SELECT 
  id,
  brand_id,
  integration_type,
  webhook_url,
  n8n_workflow_id,
  is_active,
  last_sync_at,
  sync_frequency,
  data_sources,
  ga4_property_id,
  token_expires_at,
  service_account_email,
  metrics_config,
  metadata,
  created_at,
  updated_at,
  created_by
FROM public.brand_analytics_integrations;

-- Only admin/superadmin can access the full table with sensitive columns
CREATE POLICY "Admins can manage brand analytics integrations"
  ON public.brand_analytics_integrations FOR ALL
  TO authenticated
  USING (public.is_admin_or_superadmin(auth.uid()))
  WITH CHECK (public.is_admin_or_superadmin(auth.uid()));

-- Deny direct SELECT on table for non-admins (they should use the view)
-- Note: This is handled by RLS - non-admins won't match the policy above

-- ============================================================================
-- 5. FIX: gohighlevel_integrations - Restrict api_key_encrypted
-- ============================================================================
-- Drop existing policy
DROP POLICY IF EXISTS "ghl_integrations_user_access" ON public.gohighlevel_integrations;

-- Create view without api_key_encrypted for non-admin users
CREATE OR REPLACE VIEW public.gohighlevel_integrations_safe AS
SELECT 
  id,
  user_id,
  location_id,
  is_active,
  created_at,
  updated_at
FROM public.gohighlevel_integrations;

-- Only admin/superadmin can access the full table with api_key_encrypted
CREATE POLICY "Admins can manage GoHighLevel integrations"
  ON public.gohighlevel_integrations FOR ALL
  TO authenticated
  USING (public.is_admin_or_superadmin(auth.uid()))
  WITH CHECK (public.is_admin_or_superadmin(auth.uid()));

-- ============================================================================
-- 6. FIX: control_tower_api_keys - Restrict to superadmin only
-- ============================================================================
-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view API keys" ON public.control_tower_api_keys;
DROP POLICY IF EXISTS "Super admins can insert API keys" ON public.control_tower_api_keys;
DROP POLICY IF EXISTS "Super admins can update API keys" ON public.control_tower_api_keys;
DROP POLICY IF EXISTS "Super admins can delete API keys" ON public.control_tower_api_keys;

-- Create view without api_key_encrypted for non-superadmin users
CREATE OR REPLACE VIEW public.control_tower_api_keys_safe AS
SELECT 
  id,
  key_name,
  scopes,
  is_active,
  created_by,
  created_at,
  updated_at,
  last_used_at,
  rate_limit_per_hour
FROM public.control_tower_api_keys;

-- Only superadmin can access the full table with api_key_encrypted
CREATE POLICY "Super admins can manage control tower API keys"
  ON public.control_tower_api_keys FOR ALL
  TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

-- ============================================================================
-- 7. FIX: n8n_workflow_configs - Restrict to superadmin only
-- ============================================================================
-- Drop existing policy
DROP POLICY IF EXISTS "Admins and managers can manage n8n workflows" ON public.n8n_workflow_configs;

-- Create view without api_key_encrypted for non-superadmin users
CREATE OR REPLACE VIEW public.n8n_workflow_configs_safe AS
SELECT 
  id,
  workflow_name,
  workflow_slug,
  base_url,
  is_enabled,
  metadata,
  created_by,
  created_at,
  updated_at
FROM public.n8n_workflow_configs;

-- Only superadmin can access the full table with api_key_encrypted
CREATE POLICY "Super admins can manage n8n workflow configs"
  ON public.n8n_workflow_configs FOR ALL
  TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

-- ============================================================================
-- Grant permissions on views
-- ============================================================================
-- Allow authenticated users to read safe views (but they'll be empty due to RLS on underlying tables)
-- The views are mainly for documentation/clarity - actual access is controlled by RLS on base tables

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON VIEW public.brand_analytics_integrations_safe IS 'Safe view of brand_analytics_integrations excluding sensitive columns: webhook_secret, access_token_encrypted, refresh_token_encrypted, service_account_key_encrypted. Only admin/superadmin can access the base table.';
COMMENT ON VIEW public.gohighlevel_integrations_safe IS 'Safe view of gohighlevel_integrations excluding api_key_encrypted. Only admin/superadmin can access the base table.';
COMMENT ON VIEW public.control_tower_api_keys_safe IS 'Safe view of control_tower_api_keys excluding api_key_encrypted. Only superadmin can access the base table.';
COMMENT ON VIEW public.n8n_workflow_configs_safe IS 'Safe view of n8n_workflow_configs excluding api_key_encrypted. Only superadmin can access the base table.';
