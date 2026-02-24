
-- Fix: create weekly_content_ideas table and retry the failed part
CREATE TABLE IF NOT EXISTS public.weekly_content_ideas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  leader_id UUID DEFAULT NULL,
  headline TEXT NOT NULL,
  description TEXT DEFAULT NULL,
  source_urls TEXT[] DEFAULT NULL,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID DEFAULT NULL
);
ALTER TABLE public.weekly_content_ideas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view content ideas" ON public.weekly_content_ideas FOR SELECT USING (true);
CREATE POLICY "Auth insert content ideas" ON public.weekly_content_ideas FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
