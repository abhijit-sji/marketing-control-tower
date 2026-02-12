-- Update user_has_brand_access function to check BOTH old and new assignment methods
CREATE OR REPLACE FUNCTION public.user_has_brand_access(_user_id uuid, _brand_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    -- Check old approach: owner, co-owner, or team member in brands table
    SELECT 1
    FROM public.brands
    WHERE id = _brand_id
      AND (
        owner_id = _user_id
        OR co_owner_id = _user_id
        OR _user_id = ANY(team_members)
      )
  ) OR EXISTS (
    -- Check new approach: user_brands junction table
    SELECT 1
    FROM public.user_brands
    WHERE user_id = _user_id
      AND brand_id = _brand_id
  )
$$;

-- Create RLS policy to allow regular users to view their assigned brands
CREATE POLICY "Users can view their assigned brands"
ON public.brands
FOR SELECT
TO authenticated
USING (
  user_has_brand_access(auth.uid(), id)
);