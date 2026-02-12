-- Create client_testimonials table
CREATE TABLE public.client_testimonials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  
  -- Type and status
  type TEXT NOT NULL DEFAULT 'written_quote', -- 'google_review', 'written_quote', 'video', 'linkedin', 'case_study'
  status TEXT NOT NULL DEFAULT 'pending_outreach', -- 'pending_outreach', 'requested', 'received', 'approved', 'published', 'dismissed'
  
  -- Content
  content TEXT,
  video_url TEXT,
  external_url TEXT,
  
  -- Display information
  client_name TEXT NOT NULL,
  client_title TEXT,
  company_name TEXT,
  
  -- Detection metadata
  sentiment_score INTEGER CHECK (sentiment_score >= 0 AND sentiment_score <= 100),
  detected_from TEXT, -- 'meeting', 'email', 'task_comment', 'manual'
  source_reference TEXT,
  positive_signals TEXT[],
  last_signal TEXT,
  
  -- Assignment
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  
  -- Timestamps
  requested_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add constraints
ALTER TABLE public.client_testimonials 
  ADD CONSTRAINT client_testimonials_type_check 
  CHECK (type IN ('google_review', 'written_quote', 'video', 'linkedin', 'case_study'));

ALTER TABLE public.client_testimonials 
  ADD CONSTRAINT client_testimonials_status_check 
  CHECK (status IN ('pending_outreach', 'requested', 'received', 'approved', 'published', 'dismissed'));

-- Enable RLS
ALTER TABLE public.client_testimonials ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "PMs and above can view testimonials"
ON public.client_testimonials
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'manager', 'pm')
  )
);

CREATE POLICY "PMs and above can insert testimonials"
ON public.client_testimonials
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'manager', 'pm')
  )
);

CREATE POLICY "PMs and above can update testimonials"
ON public.client_testimonials
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'manager', 'pm')
  )
);

CREATE POLICY "Managers and above can delete testimonials"
ON public.client_testimonials
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'manager')
  )
);

-- Indexes
CREATE INDEX idx_testimonials_client ON public.client_testimonials(client_id);
CREATE INDEX idx_testimonials_brand ON public.client_testimonials(brand_id);
CREATE INDEX idx_testimonials_status ON public.client_testimonials(status);
CREATE INDEX idx_testimonials_type ON public.client_testimonials(type);
CREATE INDEX idx_testimonials_assigned ON public.client_testimonials(assigned_to);

-- Create testimonial submission tokens table
CREATE TABLE public.testimonial_submission_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  testimonial_id UUID REFERENCES public.client_testimonials(id) ON DELETE CASCADE NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for token lookup
CREATE INDEX idx_testimonial_tokens_token ON public.testimonial_submission_tokens(token);
CREATE INDEX idx_testimonial_tokens_expires ON public.testimonial_submission_tokens(expires_at);

-- No RLS on tokens - public access via token validation
-- The token itself acts as the authentication

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_testimonials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_client_testimonials_updated_at
  BEFORE UPDATE ON public.client_testimonials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_testimonials_updated_at();