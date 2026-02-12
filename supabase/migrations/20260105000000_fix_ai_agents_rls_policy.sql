-- Fix AI Agents RLS Policy
-- Issue: Users without super_admin or manager role cannot see AI agents
-- Solution: Allow all authenticated users to SELECT agents, but restrict modifications to admins

-- Drop existing policy
DROP POLICY IF EXISTS "ai_agents_user_access" ON public.ai_agents;

-- Create separate policies for SELECT and modifications
-- All authenticated users can view AI agents
CREATE POLICY "ai_agents_select_access"
ON public.ai_agents
FOR SELECT
TO authenticated
USING (true);

-- Only super_admin and manager can INSERT, UPDATE, DELETE
CREATE POLICY "ai_agents_modify_access"
ON public.ai_agents
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'manager')
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'manager')
);
