-- ==============================================================================
-- IT Asset Management System - Clean Production Master Seed Data
-- Policy: Only approved master company records (GMD, GMC, TEL) are seeded.
-- ZERO tester assets, tester employees, or dummy photos are populated.
-- Real inventory will be imported via verified Excel Import.
-- ==============================================================================

-- 1. Master Operating Companies
insert into public.companies (id, code, name, description)
values
  ('comp-gmd-001', 'GMD', 'GMD', 'GMD Enterprise Operations'),
  ('comp-gmc-002', 'GMC', 'GMC', 'GMC Industrial & Technology Solutions'),
  ('comp-tel-003', 'TEL', 'TEL', 'TEL Logistics & Enterprise Services')
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description;

-- 2. Initial Super Admin Profile Template
-- Run this block in the Supabase SQL Editor AFTER creating the admin user under Authentication -> Users:
/*
insert into public.user_profiles (id, email, name, role, all_companies)
values (
  'YOUR-NEW-USER-UUID-FROM-AUTH-TAB', -- Paste UUID from auth.users
  'admin@company.com',                -- Admin email
  'System Administrator',             -- Admin full name
  'SUPER_ADMIN',                      -- Role
  true                                -- Access to all entities (GMD, GMC, TEL)
)
on conflict (id) do update
set
  role = 'SUPER_ADMIN',
  all_companies = true;
*/

