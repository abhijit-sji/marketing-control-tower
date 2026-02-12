-- Drop CollabAI tables and all associated policies/indexes

-- Drop collabai_agents table
DROP TABLE IF EXISTS public.collabai_agents CASCADE;

-- Drop collabai_integrations table  
DROP TABLE IF EXISTS public.collabai_integrations CASCADE;

-- Drop collabai_chats table (if it exists)
DROP TABLE IF EXISTS public.collabai_chats CASCADE;