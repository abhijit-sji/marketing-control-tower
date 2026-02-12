# Debug: Weekly Client Email Agent Not Showing

## Possible Issues

1. **Migration not run** - The agent record might not exist in the database
2. **RLS Policy** - User might not have permission to see the agent
3. **Query error** - There might be a silent error in the query

## Debug Steps

### 1. Check if Migration Was Run

Run this SQL query in Supabase SQL Editor:

```sql
-- Check if the agent exists
SELECT id, name, slug, is_enabled, category 
FROM ai_agents 
WHERE slug = 'weekly-client-email';

-- Check all enabled agents
SELECT id, name, slug, is_enabled, category 
FROM ai_agents 
WHERE is_enabled = true;
```

### 2. Check RLS Policy

```sql
-- Check current RLS policy
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual 
FROM pg_policies 
WHERE tablename = 'ai_agents';
```

### 3. Check User Role

```sql
-- Check your user role
SELECT id, email, role 
FROM users 
WHERE id = auth.uid();
```

### 4. Run Migration Manually (if needed)

If the agent doesn't exist, run this SQL:

```sql
-- Insert Weekly Client Email Agent
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

-- Update RLS policy to allow PMs and Managers
DROP POLICY IF EXISTS "ai_agents_user_access" ON public.ai_agents;
CREATE POLICY "ai_agents_user_access"
ON public.ai_agents
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.users 
  WHERE id::text = auth.uid()::text 
  AND role = ANY(ARRAY['super_admin'::app_role, 'manager'::app_role, 'pm'::app_role])
));
```

### 5. Check Browser Console

Open browser DevTools (F12) and check the Console tab for:
- `[MyAgents] Fetching internal agents...`
- `[MyAgents] Internal agents fetched: [...]`
- Any error messages

### 6. Check Network Tab

In DevTools Network tab, look for requests to Supabase:
- Check if the query to `ai_agents` table is being made
- Check the response status and data

## Quick Fix

If the migration hasn't been run, you can run it via Supabase CLI:

```bash
supabase db push
```

Or manually run the SQL from step 4 above in the Supabase SQL Editor.

