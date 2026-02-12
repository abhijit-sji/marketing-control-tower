-- Create daily_head_starts table to track daily check-ins
CREATE TABLE public.daily_head_starts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  goals TEXT,
  priorities TEXT[],
  blockers TEXT,
  mood TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Enable RLS
ALTER TABLE public.daily_head_starts ENABLE ROW LEVEL SECURITY;

-- Users can view their own head starts
CREATE POLICY "Users can view their own head starts"
ON public.daily_head_starts
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own head starts
CREATE POLICY "Users can create their own head starts"
ON public.daily_head_starts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own head starts
CREATE POLICY "Users can update their own head starts"
ON public.daily_head_starts
FOR UPDATE
USING (auth.uid() = user_id);

-- Admins can view all head starts
CREATE POLICY "Admins can view all head starts"
ON public.daily_head_starts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('super_admin', 'manager')
  )
);

-- Create email_notifications_log table
CREATE TABLE public.email_notifications_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_email TEXT NOT NULL,
  recipient_user_id UUID REFERENCES public.users(id),
  email_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT,
  metadata JSONB
);

-- Enable RLS
ALTER TABLE public.email_notifications_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view email logs
CREATE POLICY "Admins can view email logs"
ON public.email_notifications_log
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('super_admin', 'manager')
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_daily_head_starts_updated_at
BEFORE UPDATE ON public.daily_head_starts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();