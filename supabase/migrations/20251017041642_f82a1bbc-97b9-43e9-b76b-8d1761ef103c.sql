-- Create feedback_reports table
CREATE TABLE IF NOT EXISTS public.feedback_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('bug', 'feature')),
  subject text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'resolved', 'closed')),
  email text,
  attachment_url text,
  created_by uuid REFERENCES auth.users(id),
  reviewed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- Create feedback_comments table
CREATE TABLE IF NOT EXISTS public.feedback_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL REFERENCES public.feedback_reports(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  comment text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create trigger for updated_at on feedback_reports
DROP TRIGGER IF EXISTS update_feedback_reports_updated_at ON public.feedback_reports;
CREATE TRIGGER update_feedback_reports_updated_at
  BEFORE UPDATE ON public.feedback_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS on feedback_reports
ALTER TABLE public.feedback_reports ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can create feedback" ON public.feedback_reports;
DROP POLICY IF EXISTS "Users can view own feedback" ON public.feedback_reports;
DROP POLICY IF EXISTS "Admins can view all feedback" ON public.feedback_reports;
DROP POLICY IF EXISTS "Admins can update feedback" ON public.feedback_reports;

-- RLS Policies for feedback_reports
CREATE POLICY "Users can create feedback"
  ON public.feedback_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can view own feedback"
  ON public.feedback_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Admins can view all feedback"
  ON public.feedback_reports FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admins can update feedback"
  ON public.feedback_reports FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Enable RLS on feedback_comments
ALTER TABLE public.feedback_comments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can manage comments" ON public.feedback_comments;
DROP POLICY IF EXISTS "Users can view comments on own feedback" ON public.feedback_comments;

-- RLS Policies for feedback_comments
CREATE POLICY "Admins can manage comments"
  ON public.feedback_comments FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Users can view comments on own feedback"
  ON public.feedback_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.feedback_reports fr
      WHERE fr.id = feedback_comments.feedback_id
      AND fr.created_by = auth.uid()
    )
  );

-- Add unique constraint to ai_configurations.configuration_type
ALTER TABLE public.ai_configurations 
  DROP CONSTRAINT IF EXISTS ai_configurations_configuration_type_key;
  
ALTER TABLE public.ai_configurations 
  ADD CONSTRAINT ai_configurations_configuration_type_key 
  UNIQUE (configuration_type);

-- Insert or update feature flags
INSERT INTO public.ai_configurations (configuration_type, configuration_data)
VALUES (
  'feature_flags',
  '{"feedback_enabled": true, "feedback_auto_email": false, "feedback_widget": false}'::jsonb
) ON CONFLICT (configuration_type) DO UPDATE
SET configuration_data = EXCLUDED.configuration_data,
    updated_at = now();

-- Create storage bucket for feedback attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('feedback-attachments', 'feedback-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Drop existing storage policies if they exist
DROP POLICY IF EXISTS "Authenticated users can upload feedback attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own attachments" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all feedback attachments" ON storage.objects;

-- Storage RLS policies for feedback attachments
CREATE POLICY "Authenticated users can upload feedback attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'feedback-attachments');

CREATE POLICY "Users can view own attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'feedback-attachments' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Admins can view all feedback attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'feedback-attachments' AND
    (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  );