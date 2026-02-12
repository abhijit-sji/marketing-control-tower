-- Agent execution steps for audit trail and transparency
CREATE TABLE public.agent_execution_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES public.ai_agent_runs(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('think', 'tool_call', 'tool_result', 'human_approval', 'complete', 'error')),
  tool_name TEXT,
  tool_input JSONB,
  tool_result JSONB,
  reasoning TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for efficient step retrieval
CREATE INDEX idx_agent_execution_steps_run_id ON public.agent_execution_steps(run_id);
CREATE INDEX idx_agent_execution_steps_created_at ON public.agent_execution_steps(created_at DESC);

-- Enable RLS
ALTER TABLE public.agent_execution_steps ENABLE ROW LEVEL SECURITY;

-- RLS policies for agent execution steps
CREATE POLICY "Users can view execution steps for their runs"
  ON public.agent_execution_steps FOR SELECT
  USING (
    run_id IN (
      SELECT id FROM public.ai_agent_runs WHERE executed_by = auth.uid()
    )
  );

CREATE POLICY "Super admins can view all execution steps"
  ON public.agent_execution_steps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

-- Agent approvals for human-in-the-loop actions
CREATE TABLE public.agent_pending_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES public.ai_agent_runs(id) ON DELETE CASCADE,
  step_id UUID REFERENCES public.agent_execution_steps(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  action_payload JSONB NOT NULL,
  risk_level TEXT DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  requested_at TIMESTAMPTZ DEFAULT now(),
  requested_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution TEXT CHECK (resolution IN ('approved', 'rejected', 'expired', 'auto_approved')),
  resolution_notes TEXT,
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '24 hours')
);

-- Indexes for approval workflow
CREATE INDEX idx_agent_approvals_run_id ON public.agent_pending_approvals(run_id);
CREATE INDEX idx_agent_approvals_pending ON public.agent_pending_approvals(resolution) WHERE resolution IS NULL;
CREATE INDEX idx_agent_approvals_requested_by ON public.agent_pending_approvals(requested_by);

-- Enable RLS
ALTER TABLE public.agent_pending_approvals ENABLE ROW LEVEL SECURITY;

-- RLS policies for approvals
CREATE POLICY "Users can view their approval requests"
  ON public.agent_pending_approvals FOR SELECT
  USING (requested_by = auth.uid());

CREATE POLICY "Managers and super admins can view all approvals"
  ON public.agent_pending_approvals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role IN ('super_admin', 'manager')
    )
  );

CREATE POLICY "Users can resolve their own approval requests"
  ON public.agent_pending_approvals FOR UPDATE
  USING (requested_by = auth.uid())
  WITH CHECK (requested_by = auth.uid());

CREATE POLICY "Managers can resolve any approval"
  ON public.agent_pending_approvals FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role IN ('super_admin', 'manager')
    )
  );

-- Agent session memory for cross-run context
CREATE TABLE public.agent_session_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  memory_key TEXT NOT NULL,
  memory_value JSONB NOT NULL,
  memory_type TEXT DEFAULT 'context' CHECK (memory_type IN ('context', 'preference', 'pattern', 'blocker', 'trend')),
  importance_score REAL DEFAULT 0.5,
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agent_id, user_id, memory_key)
);

-- Indexes for efficient memory lookup
CREATE INDEX idx_agent_memory_lookup ON public.agent_session_memory(agent_id, user_id, memory_key);
CREATE INDEX idx_agent_memory_type ON public.agent_session_memory(agent_id, memory_type);
CREATE INDEX idx_agent_memory_importance ON public.agent_session_memory(importance_score DESC);

-- Enable RLS
ALTER TABLE public.agent_session_memory ENABLE ROW LEVEL SECURITY;

-- RLS policies for agent memory
CREATE POLICY "Users can manage their own agent memories"
  ON public.agent_session_memory FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Super admins can view all memories"
  ON public.agent_session_memory FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

-- Agent tool definitions for dynamic tool registry
CREATE TABLE public.agent_tool_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  tool_description TEXT NOT NULL,
  tool_category TEXT DEFAULT 'general' CHECK (tool_category IN ('read', 'write', 'external', 'approval_required')),
  parameters_schema JSONB NOT NULL,
  requires_approval BOOLEAN DEFAULT false,
  is_enabled BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  avg_execution_time_ms REAL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agent_id, tool_name)
);

-- Enable RLS
ALTER TABLE public.agent_tool_definitions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can view tool definitions"
  ON public.agent_tool_definitions FOR SELECT
  USING (true);

CREATE POLICY "Super admins can manage tool definitions"
  ON public.agent_tool_definitions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_agent_memory_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_agent_session_memory_updated_at
  BEFORE UPDATE ON public.agent_session_memory
  FOR EACH ROW
  EXECUTE FUNCTION public.update_agent_memory_timestamp();

CREATE TRIGGER update_agent_tool_definitions_updated_at
  BEFORE UPDATE ON public.agent_tool_definitions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_agent_memory_timestamp();