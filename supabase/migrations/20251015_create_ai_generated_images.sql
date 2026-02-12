CREATE TABLE IF NOT EXISTS public.ai_generated_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  size TEXT DEFAULT '1024x1024',
  style TEXT,
  image_url TEXT,
  provider TEXT DEFAULT 'Gemini',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
);

ALTER TABLE public.ai_generated_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own generated images"
  ON public.ai_generated_images
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own image logs"
  ON public.ai_generated_images
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all generated images"
  ON public.ai_generated_images
  FOR ALL USING (
    public.has_role(auth.uid(), 'super_admin') OR
    public.has_role(auth.uid(), 'manager')
  );
