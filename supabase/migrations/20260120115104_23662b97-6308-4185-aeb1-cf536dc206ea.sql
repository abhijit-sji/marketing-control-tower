-- Allow all authenticated users to view active team members for task assignment
-- This enables normal users to see the full team list when assigning tasks

CREATE POLICY "Authenticated users can view active team members"
ON users
FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND status = 'active'
);