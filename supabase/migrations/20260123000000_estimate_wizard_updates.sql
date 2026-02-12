-- ================================================
-- ESTIMATE WIZARD UPDATES
-- ================================================
-- Makes client_name optional and updates RLS policies
-- to allow all authenticated users (not just PM+)

-- ================================================
-- 1. Make client_name optional (nullable)
-- ================================================
ALTER TABLE estimates ALTER COLUMN client_name DROP NOT NULL;

-- ================================================
-- 2. Update RLS Policies for estimates table
-- Allow all authenticated users to use estimates
-- ================================================

-- Drop existing estimates policies
DROP POLICY IF EXISTS "estimates_insert" ON estimates;
DROP POLICY IF EXISTS "estimates_select_own" ON estimates;
DROP POLICY IF EXISTS "estimates_super_admin_read" ON estimates;
DROP POLICY IF EXISTS "estimates_update_own" ON estimates;
DROP POLICY IF EXISTS "estimates_delete" ON estimates;

-- Create new policies for all authenticated users

-- INSERT: All authenticated users can create estimates
CREATE POLICY "estimates_authenticated_insert" ON estimates
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- SELECT: Users can read their own estimates
CREATE POLICY "estimates_authenticated_select_own" ON estimates
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

-- SELECT: Super admin can read all estimates
CREATE POLICY "estimates_super_admin_select_all" ON estimates
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- UPDATE: Users can update their own estimates
CREATE POLICY "estimates_authenticated_update_own" ON estimates
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- DELETE: Users can delete their own draft estimates, super admin can delete any
CREATE POLICY "estimates_authenticated_delete" ON estimates
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
-- 3. Update RLS Policies for service_categories
-- Allow all authenticated users to read active categories
-- ================================================

-- Drop existing pm read policy
DROP POLICY IF EXISTS "service_categories_pm_read" ON service_categories;

-- Create new policy for all authenticated users
CREATE POLICY "service_categories_authenticated_read" ON service_categories
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- ================================================
-- 4. Update RLS Policies for services
-- Allow all authenticated users to read active services
-- ================================================

-- Drop existing pm read policy
DROP POLICY IF EXISTS "services_pm_read" ON services;

-- Create new policy for all authenticated users
CREATE POLICY "services_authenticated_read" ON services
  FOR SELECT
  TO authenticated
  USING (is_active = true);
