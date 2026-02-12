-- Create employees table for local sync
CREATE TABLE employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text UNIQUE NOT NULL,
  email text UNIQUE NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  full_name text GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
  title text,
  department text,
  location text,
  phone text,
  role text,
  reporting_manager_id text,
  reporting_manager_email text,
  reporting_manager_name text,
  dotted_line_manager_email text,
  is_active boolean DEFAULT true,
  api_metadata jsonb DEFAULT '{}',
  synced_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_employees_employee_id ON employees(employee_id);
CREATE INDEX idx_employees_email ON employees(email);
CREATE INDEX idx_employees_department ON employees(department);
CREATE INDEX idx_employees_is_active ON employees(is_active);
CREATE INDEX idx_employees_synced_at ON employees(synced_at);

-- Create pods table for local sync
CREATE TABLE pods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  color text,
  is_active boolean DEFAULT true,
  member_count integer DEFAULT 0,
  api_metadata jsonb DEFAULT '{}',
  synced_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_pods_pod_id ON pods(pod_id);
CREATE INDEX idx_pods_is_active ON pods(is_active);
CREATE INDEX idx_pods_synced_at ON pods(synced_at);

-- Create pod_members junction table
CREATE TABLE pod_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id text NOT NULL,
  employee_id text NOT NULL,
  user_id text,
  joined_at timestamptz,
  synced_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(pod_id, employee_id),
  FOREIGN KEY (pod_id) REFERENCES pods(pod_id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE
);

CREATE INDEX idx_pod_members_pod_id ON pod_members(pod_id);
CREATE INDEX idx_pod_members_employee_id ON pod_members(employee_id);

-- Create sync tracking table
CREATE TABLE control_tower_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type text NOT NULL,
  status text NOT NULL DEFAULT 'in_progress',
  records_fetched integer DEFAULT 0,
  records_synced integer DEFAULT 0,
  records_failed integer DEFAULT 0,
  error_message text,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  triggered_by uuid,
  metadata jsonb DEFAULT '{}'
);

CREATE INDEX idx_sync_logs_sync_type ON control_tower_sync_logs(sync_type);
CREATE INDEX idx_sync_logs_status ON control_tower_sync_logs(status);
CREATE INDEX idx_sync_logs_started_at ON control_tower_sync_logs(started_at DESC);

-- Enable RLS on all tables
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE pods ENABLE ROW LEVEL SECURITY;
ALTER TABLE pod_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE control_tower_sync_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for employees
CREATE POLICY "Admins can view all employees"
ON employees FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'pm'::app_role)
);

CREATE POLICY "Service role can manage employees"
ON employees FOR ALL
TO authenticated
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- RLS Policies for pods
CREATE POLICY "Admins can view all pods"
ON pods FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'pm'::app_role)
);

CREATE POLICY "Service role can manage pods"
ON pods FOR ALL
TO authenticated
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- RLS Policies for pod_members
CREATE POLICY "Admins can view pod members"
ON pod_members FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'pm'::app_role)
);

CREATE POLICY "Service role can manage pod members"
ON pod_members FOR ALL
TO authenticated
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- RLS Policies for sync logs
CREATE POLICY "Admins can view sync logs"
ON control_tower_sync_logs FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "Service role can manage sync logs"
ON control_tower_sync_logs FOR ALL
TO authenticated
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);