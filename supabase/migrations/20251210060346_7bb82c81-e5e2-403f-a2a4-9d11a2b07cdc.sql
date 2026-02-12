-- Enable RLS on knowledge_embeddings table
ALTER TABLE public.knowledge_embeddings ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for knowledge_embeddings
CREATE POLICY "Admins can manage knowledge embeddings" ON public.knowledge_embeddings
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    OR has_role(auth.uid(), 'manager'::app_role)
  );