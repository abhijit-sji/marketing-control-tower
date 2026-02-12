-- Create junction table to link generated posts with external agents
CREATE TABLE IF NOT EXISTS public.post_agent_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.brand_generated_posts(id) ON DELETE CASCADE,
  external_agent_id UUID NOT NULL,
  agent_name TEXT NOT NULL,
  agent_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_post_agent_references_post_id ON public.post_agent_references(post_id);
CREATE INDEX IF NOT EXISTS idx_post_agent_references_agent_id ON public.post_agent_references(external_agent_id);

-- Enable RLS
ALTER TABLE public.post_agent_references ENABLE ROW LEVEL SECURITY;

-- Allow team members to view agent references for posts they can access
CREATE POLICY "Team members can view post agent references"
ON public.post_agent_references
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.brand_generated_posts bgp
    WHERE bgp.id = post_agent_references.post_id
    AND (
      user_has_brand_access(auth.uid(), bgp.brand_id)
      OR has_role(auth.uid(), 'super_admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
    )
  )
);

-- Allow team members to create agent references for their posts
CREATE POLICY "Team members can create post agent references"
ON public.post_agent_references
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.brand_generated_posts bgp
    WHERE bgp.id = post_agent_references.post_id
    AND (
      user_has_brand_access(auth.uid(), bgp.brand_id)
      OR has_role(auth.uid(), 'super_admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
    )
  )
);

-- Allow deletion of agent references
CREATE POLICY "Team members can delete post agent references"
ON public.post_agent_references
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.brand_generated_posts bgp
    WHERE bgp.id = post_agent_references.post_id
    AND (
      user_has_brand_access(auth.uid(), bgp.brand_id)
      OR has_role(auth.uid(), 'super_admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
    )
  )
);