-- Step 1: Add 'content_creator' value to the existing app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'content_creator';

-- Step 2: Add user_id column to thought_leaders table to link leaders to auth users
ALTER TABLE public.thought_leaders 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_thought_leaders_user_id ON public.thought_leaders(user_id);

-- Step 3: Drop existing policies on thought_leaders if they exist (to recreate with new logic)
DROP POLICY IF EXISTS "Leaders can view own profile" ON public.thought_leaders;
DROP POLICY IF EXISTS "Leaders can update own profile" ON public.thought_leaders;
DROP POLICY IF EXISTS "Content creators can view own leader profile" ON public.thought_leaders;
DROP POLICY IF EXISTS "Content creators can update own leader profile" ON public.thought_leaders;

-- Step 4: Create RLS policies for content creators to access their own thought leader profiles
-- Content creators can view their own thought leader profile
CREATE POLICY "Content creators can view own leader profile"
ON public.thought_leaders
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() 
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
);

-- Content creators can update their own thought leader profile (guide_text, persona, etc.)
CREATE POLICY "Content creators can update own leader profile"
ON public.thought_leaders
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'::app_role));

-- Step 5: Update generated_posts policies for content creators
DROP POLICY IF EXISTS "Content creators can view own generated posts" ON public.generated_posts;
DROP POLICY IF EXISTS "Content creators can insert own generated posts" ON public.generated_posts;

-- Content creators can view their own generated posts
CREATE POLICY "Content creators can view own generated posts"
ON public.generated_posts
FOR SELECT
TO authenticated
USING (
  leader_id IN (SELECT id FROM public.thought_leaders WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
);

-- Content creators can insert posts for themselves
CREATE POLICY "Content creators can insert own generated posts"
ON public.generated_posts
FOR INSERT
TO authenticated
WITH CHECK (
  leader_id IN (SELECT id FROM public.thought_leaders WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
);

-- Step 6: Update leader_uploads policies for content creators
DROP POLICY IF EXISTS "Content creators can view own uploads" ON public.leader_uploads;
DROP POLICY IF EXISTS "Content creators can insert own uploads" ON public.leader_uploads;

-- Content creators can view their own uploads
CREATE POLICY "Content creators can view own uploads"
ON public.leader_uploads
FOR SELECT
TO authenticated
USING (
  leader_id IN (SELECT id FROM public.thought_leaders WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
);

-- Content creators can upload documents for themselves
CREATE POLICY "Content creators can insert own uploads"
ON public.leader_uploads
FOR INSERT
TO authenticated
WITH CHECK (
  leader_id IN (SELECT id FROM public.thought_leaders WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
);