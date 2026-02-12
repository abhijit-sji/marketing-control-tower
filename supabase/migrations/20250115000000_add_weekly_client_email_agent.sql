-- Insert Weekly Client Email Agent into ai_agents table
INSERT INTO public.ai_agents (name, slug, description, category, system_prompt, is_enabled, required_role, data_sources, output_actions)
VALUES (
  'Weekly Client Email Agent',
  'weekly-client-email',
  'Generate and send weekly project summaries to clients based on task comments',
  'communication',
  'You are a professional project communication assistant that creates clear, concise weekly summaries for clients. Focus on highlighting completed work, progress updates, and key comments from team members. Use a professional but friendly tone. Format the summary with clear sections and use markdown formatting (bold, italic) appropriately.',
  true,
  'manager',
  '["activecollab_task_data", "projects", "clients"]'::jsonb,
  '{"email": true, "save_communication": true}'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

-- Update RLS policy to allow PMs and Managers to access ai_agents
DROP POLICY IF EXISTS "ai_agents_user_access" ON public.ai_agents;
CREATE POLICY "ai_agents_user_access"
ON public.ai_agents
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'pm'::app_role)
);

