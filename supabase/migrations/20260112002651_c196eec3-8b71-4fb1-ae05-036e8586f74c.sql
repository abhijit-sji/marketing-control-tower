-- Fix RLS policies for content knowledge base workflow

-- =============================================
-- WEEKLY_TRENDS: Allow content creators to view their ready ideas
-- =============================================

-- Allow content creators to view trends for their own leader profile
CREATE POLICY "Content creators can view own trends" 
ON public.weekly_trends 
FOR SELECT 
TO authenticated
USING (
  leader_id IN (
    SELECT id FROM thought_leaders WHERE user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'pm'::app_role)
  OR has_role(auth.uid(), 'marketing'::app_role)
);

-- Allow marketing role to manage trends (insert, update, delete)
CREATE POLICY "Marketing can insert trends" 
ON public.weekly_trends 
FOR INSERT 
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'pm'::app_role)
  OR has_role(auth.uid(), 'marketing'::app_role)
);

CREATE POLICY "Marketing can update trends" 
ON public.weekly_trends 
FOR UPDATE 
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'pm'::app_role)
  OR has_role(auth.uid(), 'marketing'::app_role)
);

CREATE POLICY "Marketing can delete trends" 
ON public.weekly_trends 
FOR DELETE 
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'pm'::app_role)
  OR has_role(auth.uid(), 'marketing'::app_role)
);

-- =============================================
-- LEADER_UPLOADS: Add delete policy for content creators + marketing access
-- =============================================

-- Content creators can delete their own uploads
CREATE POLICY "Content creators can delete own uploads" 
ON public.leader_uploads 
FOR DELETE 
TO authenticated
USING (
  leader_id IN (
    SELECT id FROM thought_leaders WHERE user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
);

-- Content creators can update their own uploads
CREATE POLICY "Content creators can update own uploads" 
ON public.leader_uploads 
FOR UPDATE 
TO authenticated
USING (
  leader_id IN (
    SELECT id FROM thought_leaders WHERE user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
);

-- =============================================
-- SEO_BLOG_CONTENT: Allow leaders to access blogs by leader_id
-- =============================================

-- Leaders can view blogs linked to their profile via leader_id
CREATE POLICY "Leaders can view blogs by leader_id" 
ON public.seo_blog_content 
FOR SELECT 
TO authenticated
USING (
  leader_id IN (
    SELECT id FROM thought_leaders WHERE user_id = auth.uid()
  )
);

-- Leaders can update blogs linked to their profile
CREATE POLICY "Leaders can update blogs by leader_id" 
ON public.seo_blog_content 
FOR UPDATE 
TO authenticated
USING (
  leader_id IN (
    SELECT id FROM thought_leaders WHERE user_id = auth.uid()
  )
);

-- Marketing can manage all blog content
CREATE POLICY "Marketing can manage blogs" 
ON public.seo_blog_content 
FOR ALL 
TO authenticated
USING (
  has_role(auth.uid(), 'marketing'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'marketing'::app_role)
);