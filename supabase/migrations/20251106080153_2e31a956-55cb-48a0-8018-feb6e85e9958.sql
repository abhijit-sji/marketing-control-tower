-- Drop existing restrictive PM policies on clients table
DROP POLICY IF EXISTS "PMs can update assigned clients" ON public.clients;
DROP POLICY IF EXISTS "PMs can view assigned clients" ON public.clients;

-- Create new policy allowing PMs full access to all clients
CREATE POLICY "PMs can manage all clients"
ON public.clients
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'pm'::app_role))
WITH CHECK (has_role(auth.uid(), 'pm'::app_role));