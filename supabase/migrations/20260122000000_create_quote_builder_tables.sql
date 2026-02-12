-- ================================================
-- QUOTE BUILDER MODULE - Database Schema
-- ================================================
-- Creates tables for internal quote builder with service catalog
-- Tables: service_categories, services, estimates, estimate_items

-- ================================================
-- 1. Service Categories
-- ================================================
CREATE TABLE IF NOT EXISTS service_categories (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  slug              TEXT UNIQUE NOT NULL,
  description       TEXT,
  sort_order        INTEGER DEFAULT 0,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Index for active categories sorted by order
CREATE INDEX IF NOT EXISTS idx_service_categories_active_sort
  ON service_categories(is_active, sort_order);

-- ================================================
-- 2. Services
-- ================================================
CREATE TABLE IF NOT EXISTS services (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id       UUID REFERENCES service_categories(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  slug              TEXT UNIQUE NOT NULL,
  description       TEXT,
  requirements_html TEXT,  -- WYSIWYG HTML content for requirements
  base_price        NUMERIC(10,2) NOT NULL DEFAULT 0,
  effort_hours      NUMERIC(6,2) NOT NULL DEFAULT 0,
  is_active         BOOLEAN DEFAULT true,
  sort_order        INTEGER DEFAULT 0,
  created_by        UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for services
CREATE INDEX IF NOT EXISTS idx_services_category
  ON services(category_id);
CREATE INDEX IF NOT EXISTS idx_services_active_sort
  ON services(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_services_created_by
  ON services(created_by);

-- ================================================
-- 3. Estimates
-- ================================================
CREATE TABLE IF NOT EXISTS estimates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name       TEXT NOT NULL,
  project_name      TEXT NOT NULL,
  billing_type      TEXT DEFAULT 'one_time' CHECK (billing_type IN ('one_time', 'monthly')),
  status            TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'approved', 'rejected', 'archived')),
  total_hours       NUMERIC(8,2) DEFAULT 0,
  total_price       NUMERIC(12,2) DEFAULT 0,
  notes             TEXT,
  is_template       BOOLEAN DEFAULT false,
  template_name     TEXT,
  created_by        UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for estimates
CREATE INDEX IF NOT EXISTS idx_estimates_created_by
  ON estimates(created_by);
CREATE INDEX IF NOT EXISTS idx_estimates_status
  ON estimates(status);
CREATE INDEX IF NOT EXISTS idx_estimates_is_template
  ON estimates(is_template);
CREATE INDEX IF NOT EXISTS idx_estimates_created_at
  ON estimates(created_at DESC);

-- ================================================
-- 4. Estimate Items
-- ================================================
CREATE TABLE IF NOT EXISTS estimate_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id       UUID REFERENCES estimates(id) ON DELETE CASCADE,
  service_id        UUID REFERENCES services(id) ON DELETE SET NULL,
  service_name      TEXT NOT NULL,  -- Snapshot of service name at time of creation
  base_price        NUMERIC(10,2) NOT NULL DEFAULT 0,
  effort_hours      NUMERIC(6,2) NOT NULL DEFAULT 0,
  quantity          INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  final_price       NUMERIC(10,2) NOT NULL DEFAULT 0,
  requirements_html TEXT,  -- Snapshot of requirements at time of creation
  sort_order        INTEGER DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for estimate items
CREATE INDEX IF NOT EXISTS idx_estimate_items_estimate
  ON estimate_items(estimate_id);
CREATE INDEX IF NOT EXISTS idx_estimate_items_service
  ON estimate_items(service_id);

-- ================================================
-- Row Level Security (RLS) Policies
-- ================================================

-- Enable RLS on all tables
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_items ENABLE ROW LEVEL SECURITY;

-- ================================================
-- Service Categories RLS
-- ================================================
-- Super admin can do everything
CREATE POLICY "service_categories_super_admin_all" ON service_categories
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- PM and above can read active categories
CREATE POLICY "service_categories_pm_read" ON service_categories
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('pm', 'manager', 'super_admin')
    )
  );

-- ================================================
-- Services RLS
-- ================================================
-- Super admin can do everything
CREATE POLICY "services_super_admin_all" ON services
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- PM and above can read active services
CREATE POLICY "services_pm_read" ON services
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('pm', 'manager', 'super_admin')
    )
  );

-- ================================================
-- Estimates RLS
-- ================================================
-- Users can create estimates
CREATE POLICY "estimates_insert" ON estimates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('pm', 'manager', 'super_admin')
    )
  );

-- Users can read their own estimates
CREATE POLICY "estimates_select_own" ON estimates
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('pm', 'manager', 'super_admin')
    )
  );

-- Super admin can read all estimates
CREATE POLICY "estimates_super_admin_read" ON estimates
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- Users can update their own estimates
CREATE POLICY "estimates_update_own" ON estimates
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('pm', 'manager', 'super_admin')
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('pm', 'manager', 'super_admin')
    )
  );

-- Users can delete their own non-sent estimates, super admin can delete any
CREATE POLICY "estimates_delete" ON estimates
  FOR DELETE
  TO authenticated
  USING (
    (created_by = auth.uid() AND status = 'draft')
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- ================================================
-- Estimate Items RLS
-- ================================================
-- Users can manage items for estimates they own
CREATE POLICY "estimate_items_own_estimate" ON estimate_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM estimates
      WHERE estimates.id = estimate_items.estimate_id
      AND estimates.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM estimates
      WHERE estimates.id = estimate_items.estimate_id
      AND estimates.created_by = auth.uid()
    )
  );

-- Super admin can manage all items
CREATE POLICY "estimate_items_super_admin" ON estimate_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- ================================================
-- Updated At Trigger Function (if not exists)
-- ================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS update_service_categories_updated_at ON service_categories;
CREATE TRIGGER update_service_categories_updated_at
  BEFORE UPDATE ON service_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_services_updated_at ON services;
CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_estimates_updated_at ON estimates;
CREATE TRIGGER update_estimates_updated_at
  BEFORE UPDATE ON estimates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
