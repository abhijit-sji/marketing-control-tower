-- Phase 1 Complete: Security Migration with Proper Dependency Handling
-- This migration properly handles all RLS policy dependencies before dropping columns

-- Step 1: Create user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Step 2: Create security definer functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- Step 3: Migrate existing role data
INSERT INTO public.user_roles (user_id, role)
SELECT id, role FROM public.users WHERE role IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- Step 4: Update get_current_user_role function
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1
$$;

-- Step 5: Update handle_new_auth_user trigger
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, status, created_at, updated_at)
  VALUES (NEW.id, NEW.email, 'active', now(), now())
  ON CONFLICT (id) DO NOTHING;
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Step 6: Create RLS policies for user_roles
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Super admins can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins can manage all roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

-- Step 7: Drop ALL dependent policies across ALL tables

-- Drop users table policies
DROP POLICY IF EXISTS "Managers can view manager level and below" ON public.users;
DROP POLICY IF EXISTS "Super admins can insert users" ON public.users;
DROP POLICY IF EXISTS "Super admins can update any user" ON public.users;
DROP POLICY IF EXISTS "Super admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;

-- Drop brands table policies
DROP POLICY IF EXISTS "Super admins can view all brands" ON public.brands;
DROP POLICY IF EXISTS "Managers can view all brands" ON public.brands;
DROP POLICY IF EXISTS "Super admins can manage all brands" ON public.brands;

-- Drop user_permissions policies
DROP POLICY IF EXISTS "Super admins can view all user permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Super admins can manage all user permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Users can view their own permissions" ON public.user_permissions;

-- Drop user_brands policies
DROP POLICY IF EXISTS "Super admins can view all user brand assignments" ON public.user_brands;
DROP POLICY IF EXISTS "Super admins can manage all user brand assignments" ON public.user_brands;
DROP POLICY IF EXISTS "Users can view their own brand assignments" ON public.user_brands;

-- Drop brand_kpis policies
DROP POLICY IF EXISTS "Super admins can manage all brand KPIs" ON public.brand_kpis;
DROP POLICY IF EXISTS "Managers can view all brand KPIs" ON public.brand_kpis;

-- Drop clients policies
DROP POLICY IF EXISTS "Super admins can manage all clients" ON public.clients;
DROP POLICY IF EXISTS "Managers can view and edit clients" ON public.clients;
DROP POLICY IF EXISTS "PMs can view assigned clients" ON public.clients;

-- Drop projects policies
DROP POLICY IF EXISTS "Super admins can manage all projects" ON public.projects;
DROP POLICY IF EXISTS "Managers and PMs can view and edit projects" ON public.projects;
DROP POLICY IF EXISTS "Team members can view assigned projects" ON public.projects;

-- Drop project_tasks policies
DROP POLICY IF EXISTS "Super admins can manage all project tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "Team members can view and edit their assigned tasks" ON public.project_tasks;

-- Drop client_communications policies
DROP POLICY IF EXISTS "Super admins can manage all communications" ON public.client_communications;
DROP POLICY IF EXISTS "Team members can view and create communications" ON public.client_communications;

-- Drop collabai_integrations policies
DROP POLICY IF EXISTS "collabai_integrations_user_access" ON public.collabai_integrations;

-- Drop gohighlevel_integrations policies
DROP POLICY IF EXISTS "ghl_integrations_user_access" ON public.gohighlevel_integrations;

-- Drop gohighlevel_contacts policies
DROP POLICY IF EXISTS "ghl_contacts_user_access" ON public.gohighlevel_contacts;

-- Drop ai_agents policies
DROP POLICY IF EXISTS "ai_agents_user_access" ON public.ai_agents;

-- Drop ai_configurations policies
DROP POLICY IF EXISTS "ai_configurations_user_access" ON public.ai_configurations;

-- Drop ai_agent_runs policies
DROP POLICY IF EXISTS "ai_agent_runs_user_access" ON public.ai_agent_runs;

-- Drop code_repositories policies
DROP POLICY IF EXISTS "code_repositories_user_access" ON public.code_repositories;

-- Drop code_analysis_results policies
DROP POLICY IF EXISTS "code_analysis_results_user_access" ON public.code_analysis_results;

-- Drop code_generation_templates policies
DROP POLICY IF EXISTS "code_generation_templates_user_access" ON public.code_generation_templates;

-- Drop team_eod_submissions policies
DROP POLICY IF EXISTS "Managers can view all EOD submissions" ON public.team_eod_submissions;

-- Drop activecollab_task_data policies
DROP POLICY IF EXISTS "Managers can view all task data" ON public.activecollab_task_data;

-- Drop team_daily_summaries policies
DROP POLICY IF EXISTS "Managers can view all summaries" ON public.team_daily_summaries;

-- Drop contacts policies
DROP POLICY IF EXISTS "Super admins can manage all contacts" ON public.contacts;
DROP POLICY IF EXISTS "Managers can view and edit contacts" ON public.contacts;

-- Drop deals policies
DROP POLICY IF EXISTS "Super admins can manage all deals" ON public.deals;
DROP POLICY IF EXISTS "Managers can view and edit deals" ON public.deals;

-- Drop activities policies
DROP POLICY IF EXISTS "Super admins can manage all activities" ON public.activities;
DROP POLICY IF EXISTS "Managers can view and edit activities" ON public.activities;

-- Drop user_accountability_chart policies
DROP POLICY IF EXISTS "Managers can view all accountability charts" ON public.user_accountability_chart;
DROP POLICY IF EXISTS "Managers can manage all accountability charts" ON public.user_accountability_chart;
DROP POLICY IF EXISTS "Users can view their own accountability chart" ON public.user_accountability_chart;
DROP POLICY IF EXISTS "Users can manage their own accountability chart" ON public.user_accountability_chart;

-- Step 8: Now safe to drop dangerous columns
ALTER TABLE public.users DROP COLUMN IF EXISTS role;
ALTER TABLE public.users DROP COLUMN IF EXISTS password_hash;
ALTER TABLE public.users DROP COLUMN IF EXISTS refresh_token;
ALTER TABLE public.users DROP COLUMN IF EXISTS refresh_token_expires_at;

-- Step 9: Recreate ALL policies using has_role function

-- Recreate users policies
CREATE POLICY "Users can view their own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Super admins can view all users" ON public.users FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Managers can view manager level and below" ON public.users FOR SELECT USING (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins can insert users" ON public.users FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins can update any user" ON public.users FOR UPDATE USING (public.has_role(auth.uid(), 'super_admin'));

-- Recreate brands policies
CREATE POLICY "Managers can view all brands" ON public.brands FOR SELECT USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager'));
CREATE POLICY "Super admins can manage all brands" ON public.brands FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

-- Recreate user_permissions policies
CREATE POLICY "Super admins can view all user permissions" ON public.user_permissions FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins can manage all user permissions" ON public.user_permissions FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Users can view their own permissions" ON public.user_permissions FOR SELECT USING (user_id = auth.uid());

-- Recreate user_brands policies
CREATE POLICY "Super admins can view all user brand assignments" ON public.user_brands FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins can manage all user brand assignments" ON public.user_brands FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Users can view their own brand assignments" ON public.user_brands FOR SELECT USING (user_id = auth.uid());

-- Recreate brand_kpis policies
CREATE POLICY "Managers can view all brand KPIs" ON public.brand_kpis FOR SELECT USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager'));
CREATE POLICY "Super admins can manage all brand KPIs" ON public.brand_kpis FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

-- Recreate clients policies
CREATE POLICY "Managers can view and edit clients" ON public.clients FOR ALL USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager'));
CREATE POLICY "Super admins can manage all clients" ON public.clients FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "PMs can view assigned clients" ON public.clients FOR SELECT USING (assigned_manager = auth.uid() OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'pm'));

-- Recreate projects policies
CREATE POLICY "Super admins can manage all projects" ON public.projects FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Managers and PMs can view and edit projects" ON public.projects FOR ALL USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'pm'));
CREATE POLICY "Team members can view assigned projects" ON public.projects FOR SELECT USING (project_manager = auth.uid() OR auth.uid() = ANY(assigned_team) OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'pm'));

-- Recreate project_tasks policies
CREATE POLICY "Super admins can manage all project tasks" ON public.project_tasks FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Team members can view and edit their assigned tasks" ON public.project_tasks FOR ALL USING (assigned_to = auth.uid() OR EXISTS (SELECT 1 FROM projects p WHERE p.id = project_tasks.project_id AND (p.project_manager = auth.uid() OR auth.uid() = ANY(p.assigned_team))) OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'pm'));

-- Recreate client_communications policies
CREATE POLICY "Super admins can manage all communications" ON public.client_communications FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Team members can view and create communications" ON public.client_communications FOR ALL USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'pm'));

-- Recreate collabai_integrations policies
CREATE POLICY "collabai_integrations_user_access" ON public.collabai_integrations FOR ALL USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

-- Recreate gohighlevel_integrations policies
CREATE POLICY "ghl_integrations_user_access" ON public.gohighlevel_integrations FOR ALL USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

-- Recreate gohighlevel_contacts policies
CREATE POLICY "ghl_contacts_user_access" ON public.gohighlevel_contacts FOR ALL USING (EXISTS (SELECT 1 FROM gohighlevel_integrations gi WHERE gi.id = gohighlevel_contacts.integration_id AND (gi.user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'))));

-- Recreate ai_agents policies
CREATE POLICY "ai_agents_user_access" ON public.ai_agents FOR ALL USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager'));

-- Recreate ai_configurations policies
CREATE POLICY "ai_configurations_user_access" ON public.ai_configurations FOR ALL USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager'));

-- Recreate ai_agent_runs policies
CREATE POLICY "ai_agent_runs_user_access" ON public.ai_agent_runs FOR ALL USING (executed_by = auth.uid() OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager'));

-- Recreate code_repositories policies
CREATE POLICY "code_repositories_user_access" ON public.code_repositories FOR ALL USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'pm') OR created_by = auth.uid());

-- Recreate code_analysis_results policies
CREATE POLICY "code_analysis_results_user_access" ON public.code_analysis_results FOR ALL USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'pm') OR EXISTS (SELECT 1 FROM code_repositories cr WHERE cr.id = code_analysis_results.repository_id AND cr.created_by = auth.uid()));

-- Recreate code_generation_templates policies
CREATE POLICY "code_generation_templates_user_access" ON public.code_generation_templates FOR ALL USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'pm') OR created_by = auth.uid());

-- Recreate team_eod_submissions policies
CREATE POLICY "Managers can view all EOD submissions" ON public.team_eod_submissions FOR SELECT USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'pm'));

-- Recreate activecollab_task_data policies
CREATE POLICY "Managers can view all task data" ON public.activecollab_task_data FOR SELECT USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'pm'));

-- Recreate team_daily_summaries policies
CREATE POLICY "Managers can view all summaries" ON public.team_daily_summaries FOR SELECT USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'pm'));

-- Recreate contacts policies
CREATE POLICY "Super admins can manage all contacts" ON public.contacts FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Managers can view and edit contacts" ON public.contacts FOR ALL USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager'));

-- Recreate deals policies
CREATE POLICY "Super admins can manage all deals" ON public.deals FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Managers can view and edit deals" ON public.deals FOR ALL USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager'));

-- Recreate activities policies
CREATE POLICY "Super admins can manage all activities" ON public.activities FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Managers can view and edit activities" ON public.activities FOR ALL USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager'));

-- Recreate user_accountability_chart policies
CREATE POLICY "Users can view their own accountability chart" ON public.user_accountability_chart FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can manage their own accountability chart" ON public.user_accountability_chart FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Managers can view all accountability charts" ON public.user_accountability_chart FOR SELECT USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager'));
CREATE POLICY "Managers can manage all accountability charts" ON public.user_accountability_chart FOR ALL USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager'));

-- Step 10: Reload schema cache
NOTIFY pgrst, 'reload schema';