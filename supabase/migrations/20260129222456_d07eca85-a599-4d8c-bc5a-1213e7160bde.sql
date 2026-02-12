-- Drop existing employees RLS policies
DROP POLICY IF EXISTS "Super admins and managers can view employees" ON public.employees;
DROP POLICY IF EXISTS "Super admins and managers can manage employees" ON public.employees;
DROP POLICY IF EXISTS "Super admins can manage employees" ON public.employees;
DROP POLICY IF EXISTS "Authenticated users can view employees" ON public.employees;
DROP POLICY IF EXISTS "PMs can view employees" ON public.employees;

-- Create new restrictive policy: only super_admin can view employees
CREATE POLICY "Only super_admin can view employees"
ON public.employees
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- Create policy for super_admin to manage (insert/update/delete) employees
CREATE POLICY "Only super_admin can manage employees"
ON public.employees
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));