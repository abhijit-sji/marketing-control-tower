-- Create project knowledge sources table
CREATE TABLE public.project_knowledge_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('manual', 'google_drive', 'supabase')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create project knowledge files table
CREATE TABLE public.project_knowledge_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES public.project_knowledge_sources(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  file_type TEXT NOT NULL DEFAULT 'upload',
  sync_status TEXT DEFAULT 'pending',
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_knowledge_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies for project_knowledge_sources
CREATE POLICY "Users can view sources for their projects"
  ON public.project_knowledge_sources FOR SELECT
  USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role) OR
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_knowledge_sources.project_id
      AND (p.project_manager = auth.uid() OR auth.uid() = ANY(p.assigned_team))
    )
  );

CREATE POLICY "Users can manage sources for their projects"
  ON public.project_knowledge_sources FOR ALL
  USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role) OR
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_knowledge_sources.project_id
      AND p.project_manager = auth.uid()
    )
  );

-- RLS Policies for project_knowledge_files
CREATE POLICY "Users can view files for their projects"
  ON public.project_knowledge_files FOR SELECT
  USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role) OR
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_knowledge_files.project_id
      AND (p.project_manager = auth.uid() OR auth.uid() = ANY(p.assigned_team))
    )
  );

CREATE POLICY "Users can manage files for their projects"
  ON public.project_knowledge_files FOR ALL
  USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role) OR
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_knowledge_files.project_id
      AND p.project_manager = auth.uid()
    )
  );

-- Create indexes
CREATE INDEX idx_project_knowledge_sources_project_id ON public.project_knowledge_sources(project_id);
CREATE INDEX idx_project_knowledge_files_project_id ON public.project_knowledge_files(project_id);
CREATE INDEX idx_project_knowledge_files_source_id ON public.project_knowledge_files(source_id);

-- Create triggers for updated_at
CREATE TRIGGER update_project_knowledge_sources_updated_at
  BEFORE UPDATE ON public.project_knowledge_sources
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_knowledge_files_updated_at
  BEFORE UPDATE ON public.project_knowledge_files
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();