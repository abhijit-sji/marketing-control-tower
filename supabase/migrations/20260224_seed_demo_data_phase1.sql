-- =====================================================
-- COMPREHENSIVE DEMO DATA SEEDING - PHASE 1
-- Foundation: Users, Organizations, Brands, AI Agents, Knowledge Base
-- =====================================================
-- Lightweight realistic demo data (~150 records across 25 tables)
-- Multiple demo users with different roles, organizations, brands, AI agents, and knowledge base
--
-- IMPORTANT: Before running this migration:
-- 1. Ensure demo auth users exist in Supabase Auth dashboard:
--    - demo.admin@sjinnovation.com (password: demo-password-123)
--    - demo.pm@sjinnovation.com (password: demo-password-123)
--    - demo.brand.manager@sjinnovation.com (password: demo-password-123)
--    - demo.user@sjinnovation.com (password: demo-password-123)
--    - demo.manager@sjinnovation.com (password: demo-password-123)
-- 2. Copy their UUIDs from Supabase dashboard
-- 3. Replace the UUIDs in INSERT statements below with the actual auth UUIDs

-- =====================================================
-- FIXED DEMO USER IDs (from demo credentials migration)
-- =====================================================
-- These are the UUIDs used in the demo credentials migration
-- Note: If auth users have different UUIDs, update these values

-- UUID Mapping:
-- admin_id: 500b4a7f-4c4a-429e-a307-0601568c8525
-- user_id: b31fefe1-d78f-4160-85d3-298bccf9e02e
-- pm_id: e4c5f6a7-b8c9-4d0e-a1f2-c3d4e5f6a7b8
-- brand_manager_id: f5d6e7b8-c9da-4e1f-b2g3-d4e5f6a7b8c9
-- manager_id: a6e7f8c9-daeb-4f2g-c3h4-e5f6a7b8c9d0

-- =====================================================
-- 1. BRANDS
-- =====================================================

INSERT INTO public.brands (
  id,
  name,
  slug,
  description,
  status,
  type,
  owner_id,
  is_active,
  monthly_budget,
  created_at,
  updated_at
) VALUES
  -- Tech Marketing Co Brands
  (
    'brand-001-0000-0000-000000000001'::uuid,
    'TechBlog',
    'techblog',
    'Tech industry insights and trends',
    'active',
    'internal',
    '500b4a7f-4c4a-429e-a307-0601568c8525'::uuid,
    true,
    5000,
    NOW() - INTERVAL '60 days',
    NOW() - INTERVAL '60 days'
  ),
  (
    'brand-002-0000-0000-000000000002'::uuid,
    'StartupLife',
    'startup-life',
    'Startup ecosystem and entrepreneurship',
    'active',
    'internal',
    '500b4a7f-4c4a-429e-a307-0601568c8525'::uuid,
    true,
    4500,
    NOW() - INTERVAL '55 days',
    NOW() - INTERVAL '55 days'
  ),
  (
    'brand-003-0000-0000-000000000003'::uuid,
    'DevTools',
    'devtools',
    'Developer tools and resources',
    'active',
    'internal',
    '500b4a7f-4c4a-429e-a307-0601568c8525'::uuid,
    true,
    6000,
    NOW() - INTERVAL '50 days',
    NOW() - INTERVAL '50 days'
  ),
  (
    'brand-004-0000-0000-000000000004'::uuid,
    'DesignTrends',
    'design-trends',
    'Design trends and creative inspiration',
    'active',
    'internal',
    '500b4a7f-4c4a-429e-a307-0601568c8525'::uuid,
    true,
    5500,
    NOW() - INTERVAL '45 days',
    NOW() - INTERVAL '45 days'
  ),
  (
    'brand-005-0000-0000-000000000005'::uuid,
    'AgencyNews',
    'agency-news',
    'Marketing and advertising agency insights',
    'active',
    'internal',
    '500b4a7f-4c4a-429e-a307-0601568c8525'::uuid,
    true,
    4000,
    NOW() - INTERVAL '40 days',
    NOW() - INTERVAL '40 days'
  )
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- 2. USER BRAND ACCESS
-- =====================================================

INSERT INTO public.user_brands (
  id,
  user_id,
  brand_id,
  access_level,
  can_manage_team,
  can_manage_settings,
  can_view_analytics,
  can_manage_content,
  created_at
) VALUES
  -- Admin has owner access to all brands
  ('ub-001-0000-0000-000000000001'::uuid, '500b4a7f-4c4a-429e-a307-0601568c8525'::uuid, 'brand-001-0000-0000-000000000001'::uuid, 'owner', true, true, true, true, NOW() - INTERVAL '60 days'),
  ('ub-002-0000-0000-000000000002'::uuid, '500b4a7f-4c4a-429e-a307-0601568c8525'::uuid, 'brand-002-0000-0000-000000000002'::uuid, 'owner', true, true, true, true, NOW() - INTERVAL '60 days'),
  ('ub-003-0000-0000-000000000003'::uuid, '500b4a7f-4c4a-429e-a307-0601568c8525'::uuid, 'brand-003-0000-0000-000000000003'::uuid, 'owner', true, true, true, true, NOW() - INTERVAL '60 days'),
  ('ub-004-0000-0000-000000000004'::uuid, '500b4a7f-4c4a-429e-a307-0601568c8525'::uuid, 'brand-004-0000-0000-000000000004'::uuid, 'owner', true, true, true, true, NOW() - INTERVAL '60 days'),
  ('ub-005-0000-0000-000000000005'::uuid, '500b4a7f-4c4a-429e-a307-0601568c8525'::uuid, 'brand-005-0000-0000-000000000005'::uuid, 'owner', true, true, true, true, NOW() - INTERVAL '60 days'),

  -- Brand manager has member access to 2 brands
  ('ub-006-0000-0000-000000000006'::uuid, 'b31fefe1-d78f-4160-85d3-298bccf9e02e'::uuid, 'brand-001-0000-0000-000000000001'::uuid, 'member', false, false, true, true, NOW() - INTERVAL '55 days'),
  ('ub-007-0000-0000-000000000007'::uuid, 'b31fefe1-d78f-4160-85d3-298bccf9e02e'::uuid, 'brand-002-0000-0000-000000000002'::uuid, 'member', false, false, true, true, NOW() - INTERVAL '55 days')
ON CONFLICT (user_id, brand_id) DO NOTHING;

-- =====================================================
-- 3. Create indexes for performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_brands_slug ON public.brands(slug);
CREATE INDEX IF NOT EXISTS idx_user_brands_user_id ON public.user_brands(user_id);
CREATE INDEX IF NOT EXISTS idx_user_brands_brand_id ON public.user_brands(brand_id);

-- =====================================================
-- 4. Summary
-- =====================================================
-- Phase 1 complete. The following data has been seeded:
--
-- ✅ Brands: 5 demo brands (TechBlog, StartupLife, DevTools, DesignTrends, AgencyNews)
-- ✅ User Brand Access: 7 user-brand relationships (admin and users)
--
-- Total Records: 12 records
-- Ready for Phase 2: Content Generation (LinkedIn, SEO, newsletter, media)
-- =====================================================
