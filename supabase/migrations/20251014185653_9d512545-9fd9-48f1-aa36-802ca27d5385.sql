-- Create table for AI generated images
CREATE TABLE IF NOT EXISTS public.ai_generated_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  size TEXT DEFAULT '1024x1024',
  style TEXT,
  image_url TEXT,
  provider TEXT DEFAULT 'Gemini',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
);

-- Enable RLS
ALTER TABLE public.ai_generated_images ENABLE ROW LEVEL SECURITY;

-- Users can view their own images
CREATE POLICY "Users can view their own generated images"
  ON public.ai_generated_images
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Users can insert their own image logs
CREATE POLICY "Users can insert their own image logs"
  ON public.ai_generated_images
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all images
CREATE POLICY "Admins can view all generated images"
  ON public.ai_generated_images
  FOR ALL 
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role) OR
    public.has_role(auth.uid(), 'manager'::app_role)
  );