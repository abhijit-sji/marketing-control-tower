-- Create table for content safety override requests and false positive reports
CREATE TABLE IF NOT EXISTS public.content_safety_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id UUID REFERENCES public.ai_generated_images(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL CHECK (report_type IN ('false_positive', 'override_request', 'override_approved', 'override_denied')),
  prompt TEXT NOT NULL,
  reason TEXT,
  reviewer_id UUID REFERENCES public.users(id),
  reviewed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'resolved')),
  safety_ratings JSONB,
  triggered_categories JSONB,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.content_safety_reports ENABLE ROW LEVEL SECURITY;

-- Users can view their own reports
CREATE POLICY "Users can view their own safety reports"
  ON public.content_safety_reports
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Users can create their own reports
CREATE POLICY "Users can create safety reports"
  ON public.content_safety_reports
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all reports
CREATE POLICY "Admins can view all safety reports"
  ON public.content_safety_reports
  FOR SELECT 
  USING (
    public.has_role(auth.uid(), 'super_admin') OR
    public.has_role(auth.uid(), 'manager')
  );

-- Admins can update reports
CREATE POLICY "Admins can update safety reports"
  ON public.content_safety_reports
  FOR UPDATE 
  USING (
    public.has_role(auth.uid(), 'super_admin') OR
    public.has_role(auth.uid(), 'manager')
  );

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_safety_reports_user ON content_safety_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_safety_reports_image ON content_safety_reports(image_id);
CREATE INDEX IF NOT EXISTS idx_safety_reports_status ON content_safety_reports(status);
CREATE INDEX IF NOT EXISTS idx_safety_reports_type ON content_safety_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_safety_reports_pending ON content_safety_reports(status, created_at) 
  WHERE status = 'pending';

-- Add comments for documentation
COMMENT ON TABLE content_safety_reports IS 'Tracks false positive reports and admin override requests for content safety blocks';
COMMENT ON COLUMN content_safety_reports.report_type IS 'Type: false_positive (user report), override_request (admin override attempt), override_approved/denied';
COMMENT ON COLUMN content_safety_reports.reason IS 'User explanation for why they believe this is a false positive';
COMMENT ON COLUMN content_safety_reports.reviewer_id IS 'Admin who reviewed the report';
COMMENT ON COLUMN content_safety_reports.safety_ratings IS 'Safety ratings from Gemini API that triggered the block';
COMMENT ON COLUMN content_safety_reports.triggered_categories IS 'Categories that caused the block';

-- Create notification function for new false positive reports
CREATE OR REPLACE FUNCTION notify_admins_of_false_positive()
RETURNS TRIGGER AS $$
BEGIN
  -- This will be used to trigger notifications to admins
  -- Can be integrated with email/Slack/etc.
  IF NEW.report_type = 'false_positive' THEN
    -- Log to admin notification system (can be enhanced later)
    INSERT INTO public.admin_notifications (
      user_id,
      notification_type,
      title,
      message,
      link,
      created_at
    )
    SELECT 
      u.id,
      'content_safety_alert',
      'False Positive Report: Content Safety',
      'A user has reported a false positive content safety block. Prompt: ' || LEFT(NEW.prompt, 100),
      '/admin/content-safety-reports/' || NEW.id,
      NOW()
    FROM public.users u
    WHERE u.role IN ('super_admin', 'manager')
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for admin notifications
DROP TRIGGER IF EXISTS trigger_notify_admins_false_positive ON content_safety_reports;
CREATE TRIGGER trigger_notify_admins_false_positive
  AFTER INSERT ON content_safety_reports
  FOR EACH ROW
  WHEN (NEW.report_type = 'false_positive')
  EXECUTE FUNCTION notify_admins_of_false_positive();

-- Add override_used column to ai_generated_images if not exists
ALTER TABLE public.ai_generated_images
ADD COLUMN IF NOT EXISTS override_used BOOLEAN DEFAULT false;

-- Add index for override tracking
CREATE INDEX IF NOT EXISTS idx_ai_images_override ON ai_generated_images(override_used) 
  WHERE override_used = true;

COMMENT ON COLUMN ai_generated_images.override_used IS 'Whether admin override was used to bypass content safety';

