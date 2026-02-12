-- Security Fix 1: Create helper function for client access control
CREATE OR REPLACE FUNCTION public.user_has_client_access(_user_id uuid, _client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- User has access if:
  -- 1. They are the assigned manager of the client
  -- 2. They manage a project for this client
  -- 3. They are on the assigned team of a project for this client
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

-- Security Fix 2: Replace overly permissive RLS policies on clients table
DROP POLICY IF EXISTS "Managers can view and edit clients" ON public.clients;
DROP POLICY IF EXISTS "PMs can view assigned clients" ON public.clients;
DROP POLICY IF EXISTS "Super admins can manage all clients" ON public.clients;

-- Super admins retain full access
CREATE POLICY "Super admins can manage all clients"
ON public.clients
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Managers can only view/edit clients they're assigned to or work on
CREATE POLICY "Managers can manage assigned clients"
ON public.clients
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role) 
  AND user_has_client_access(auth.uid(), id)
)
WITH CHECK (
  has_role(auth.uid(), 'manager'::app_role)
  AND user_has_client_access(auth.uid(), id)
);

-- PMs can only view clients they're assigned to or work on projects for
CREATE POLICY "PMs can view assigned clients"
ON public.clients
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'pm'::app_role)
  AND user_has_client_access(auth.uid(), id)
);

-- PMs can update clients they work with
CREATE POLICY "PMs can update assigned clients"
ON public.clients
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'pm'::app_role)
  AND user_has_client_access(auth.uid(), id)
)
WITH CHECK (
  has_role(auth.uid(), 'pm'::app_role)
  AND user_has_client_access(auth.uid(), id)
);

-- Security Fix 3: Apply similar restrictions to related tables
-- Update contacts table policies
DROP POLICY IF EXISTS "Managers can view and edit contacts" ON public.contacts;
DROP POLICY IF EXISTS "Super admins can manage all contacts" ON public.contacts;

CREATE POLICY "Super admins can manage all contacts"
ON public.contacts
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Users can view contacts for their clients"
ON public.contacts
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR user_has_client_access(auth.uid(), client_id)
);

CREATE POLICY "Users can manage contacts for their clients"
ON public.contacts
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'pm'::app_role))
    AND user_has_client_access(auth.uid(), client_id)
  )
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'pm'::app_role))
    AND user_has_client_access(auth.uid(), client_id)
  )
);

-- Update activities table policies
DROP POLICY IF EXISTS "Managers can view and edit activities" ON public.activities;
DROP POLICY IF EXISTS "Super admins can manage all activities" ON public.activities;

CREATE POLICY "Super admins can manage all activities"
ON public.activities
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Users can manage activities for their clients"
ON public.activities
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'pm'::app_role))
    AND user_has_client_access(auth.uid(), client_id)
  )
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'pm'::app_role))
    AND user_has_client_access(auth.uid(), client_id)
  )
);

-- Update deals table policies
DROP POLICY IF EXISTS "Managers can view and edit deals" ON public.deals;
DROP POLICY IF EXISTS "Super admins can manage all deals" ON public.deals;

CREATE POLICY "Super admins can manage all deals"
ON public.deals
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Users can manage deals for their clients"
ON public.deals
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'pm'::app_role))
    AND user_has_client_access(auth.uid(), client_id)
  )
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'pm'::app_role))
    AND user_has_client_access(auth.uid(), client_id)
  )
);

-- Update client_communications table policies
DROP POLICY IF EXISTS "Super admins can manage all communications" ON public.client_communications;
DROP POLICY IF EXISTS "Team members can view and create communications" ON public.client_communications;

CREATE POLICY "Super admins can manage all communications"
ON public.client_communications
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Users can manage communications for their clients"
ON public.client_communications
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'pm'::app_role))
    AND user_has_client_access(auth.uid(), client_id)
  )
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'pm'::app_role))
    AND user_has_client_access(auth.uid(), client_id)
  )
);

-- Security Fix 4: Fix search path vulnerability in set_current_timestamp function
CREATE OR REPLACE FUNCTION public.set_current_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;