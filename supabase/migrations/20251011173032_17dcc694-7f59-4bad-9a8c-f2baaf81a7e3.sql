-- Create perplexity_settings table for storing user-specific default prompts and configurations
CREATE TABLE IF NOT EXISTS public.perplexity_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  default_prompt TEXT NOT NULL DEFAULT 'Find the top 5 trending LinkedIn topics this week for {audience}. Explain why each topic resonates with the audience and how {leader_name} could add insight. Respond with JSON using the structure {"topics": [{"title": string, "summary": string, "score": number}]}.',
  model TEXT NOT NULL DEFAULT 'llama-3.1-sonar-small-128k-online',
  temperature NUMERIC NOT NULL DEFAULT 0.4,
  max_tokens INTEGER NOT NULL DEFAULT 1000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.perplexity_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own settings"
ON public.perplexity_settings FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Users can manage their own settings"
ON public.perplexity_settings FOR ALL
TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(), 'super_admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_perplexity_settings_updated_at
  BEFORE UPDATE ON public.perplexity_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();