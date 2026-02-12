-- Fix function causing 42703 (column "role" does not exist) by removing dependency on users.role
-- and using user_roles table instead.

CREATE OR REPLACE FUNCTION public.user_is_marketing_or_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role IN ('super_admin'::app_role, 'manager'::app_role)
  );
$$;