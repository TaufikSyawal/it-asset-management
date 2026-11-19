-- ==============================================================================
-- ROLLBACK SCRIPT: CENTRALIZED USER MANAGEMENT & RBAC GOVERNANCE (REV 6)
-- Purpose: Safely rolls back User Management triggers, anti-escalation rules,
-- and audit trail policies to the pre-migration baseline.
-- Target: Supabase PostgreSQL (dhwtybzvkhcsqzrtgohn)
-- ==============================================================================

begin;

-- 1. DROP SECURITY TRIGGERS
drop trigger if exists trg_log_user_profile_deletion on public.user_profiles;
drop trigger if exists trg_log_user_profile_changes on public.user_profiles;
drop trigger if exists trg_log_user_profile_creation on public.user_profiles;
drop trigger if exists trg_protect_last_super_admin on public.user_profiles;
drop trigger if exists trg_prevent_unauthorized_profile_updates on public.user_profiles;

-- 2. DROP TRIGGER FUNCTIONS
drop function if exists public.log_user_profile_deletion();
drop function if exists public.log_user_profile_changes();
drop function if exists public.log_user_profile_creation();
drop function if exists public.protect_last_super_admin();
drop function if exists public.prevent_unauthorized_profile_updates();

-- 3. RESTORE USER PROFILES RLS POLICIES
drop policy if exists "User profiles selectable by authorized users" on public.user_profiles;
drop policy if exists "Super Admins can update all profiles" on public.user_profiles;
drop policy if exists "Users can update own display name" on public.user_profiles;
drop policy if exists "Super Admins can delete profiles" on public.user_profiles;

create policy "User profiles selectable by authenticated"
  on public.user_profiles for select
  to authenticated
  using (
    public.get_current_role() = 'SUPER_ADMIN'
    or id = auth.uid()
  );

create policy "Super Admins can update all profiles"
  on public.user_profiles for update
  to authenticated
  using (public.get_current_role() = 'SUPER_ADMIN')
  with check (public.get_current_role() = 'SUPER_ADMIN');

create policy "Users can update own profile"
  on public.user_profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- 4. RESTORE USER ROLE HISTORY POLICIES
drop policy if exists "Super Admins can view all role history" on public.user_role_history;
drop policy if exists "Role history insert is forbidden for application users" on public.user_role_history;
drop policy if exists "Role history is immutable (no update)" on public.user_role_history;
drop policy if exists "Role history is immutable (no delete)" on public.user_role_history;

-- Note: Table public.user_role_history and column is_active are preserved to prevent data loss.

commit;
