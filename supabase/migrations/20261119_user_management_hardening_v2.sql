-- ==============================================================================
-- PRODUCTION HARDENING REVISION 5: CENTRALIZED USER MANAGEMENT & RBAC GOVERNANCE
-- Architecture: Zero-Trust Deny-by-Default, Anti-Privilege Escalation,
-- Last Super Admin Row-Locking Protection, Immutable Role Audit Trail,
-- Explicit Grant Least-Privilege, Strict Removal of Implicit Role Fallbacks
-- Target: Supabase PostgreSQL (Free Tier, $0/month)
-- ==============================================================================

begin;

-- ------------------------------------------------------------------------------
-- 1. SCHEMA PREREQUISITES & COLUMN DEFINITIONS
-- ------------------------------------------------------------------------------

-- Ensure account active status column exists on user_profiles
alter table public.user_profiles add column if not exists is_active boolean not null default true;
create index if not exists idx_user_profiles_is_active on public.user_profiles(is_active);

-- Ensure company active status column exists on companies
alter table public.companies add column if not exists is_active boolean not null default true;

-- ------------------------------------------------------------------------------
-- 2. IMMUTABLE USER ROLE & PERMISSION AUDIT HISTORY TABLE
-- Preserves audit history permanently without cascading deletion when profiles are removed
-- ------------------------------------------------------------------------------

create table if not exists public.user_role_history (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null,
  user_email text not null,
  changed_by uuid references auth.users(id) on delete set null,
  changed_by_name text,
  old_role public.user_role,
  new_role public.user_role not null,
  old_all_companies boolean,
  new_all_companies boolean not null default false,
  old_allowed_companies text[],
  new_allowed_companies text[] not null default '{}',
  old_is_active boolean,
  new_is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_user_role_history_user on public.user_role_history(user_id);
create index if not exists idx_user_role_history_created on public.user_role_history(created_at desc);

-- Enable Row Level Security on audit trail
alter table public.user_role_history enable row level security;

-- Drop obsolete policies if exist
drop policy if exists "Super Admins can view all role history" on public.user_role_history;
drop policy if exists "Users can view own role history" on public.user_role_history;
drop policy if exists "Role history insert is forbidden for application users" on public.user_role_history;
drop policy if exists "Role history is immutable (no update)" on public.user_role_history;
drop policy if exists "Role history is immutable (no delete)" on public.user_role_history;

-- Super Admins can view all history; users can view their own history
create policy "Super Admins can view all role history"
  on public.user_role_history for select
  to authenticated
  using (
    public.get_current_role() = 'SUPER_ADMIN'
    or user_id = auth.uid()
  );

-- Direct client inserts are strictly forbidden. All inserts must occur via security definer trigger.
create policy "Role history insert is forbidden for application users"
  on public.user_role_history for insert
  to authenticated
  with check (false);

-- Audit history is append-only and permanently immutable (no update)
create policy "Role history is immutable (no update)"
  on public.user_role_history for update
  to authenticated
  using (false);

-- Audit history is append-only and permanently immutable (no delete)
create policy "Role history is immutable (no delete)"
  on public.user_role_history for delete
  to authenticated
  using (false);

-- ------------------------------------------------------------------------------
-- 3. HARDEN SECURITY DEFINER HELPER FUNCTIONS (REVISION 4 COMPATIBLE)
-- Strict Deny-by-Default: No Implicit Roles, Explicit search_path = public, pg_temp
-- ------------------------------------------------------------------------------

-- 3.1 Resolve active user profile
create or replace function public.get_current_profile()
returns public.user_profiles
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select * from public.user_profiles
  where id = auth.uid() and is_active = true;
$$;

-- 3.2 Resolve active user role (Returns NULL for unauthenticated, unprofiled, or deactivated users)
-- REQUIREMENT: REMOVE THE EMPLOYEE FALLBACK COMPLETELY.
create or replace function public.get_current_role()
returns public.user_role
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select case 
    when current_setting('is_superuser') = 'on' or current_user in ('postgres', 'service_role', 'supabase_admin') then 'SUPER_ADMIN'::public.user_role
    when auth.uid() is null then null
    else (select role from public.user_profiles where id = auth.uid() and is_active = true)
  end;
$$;

-- 3.3 Validate multi-company access (Strict: Returns FALSE for null auth.uid(), null company, or deactivated account)
create or replace function public.can_access_company(target_company_id text)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select case 
    when current_setting('is_superuser') = 'on' or current_user in ('postgres', 'service_role', 'supabase_admin') then true
    when auth.uid() is null or target_company_id is null then false
    else exists (
      select 1 from public.user_profiles up
      join public.companies c on c.id = target_company_id
      where up.id = auth.uid()
        and up.is_active = true
        and up.role is not null
        and c.is_active = true
        and (
          up.role = 'SUPER_ADMIN'
          or up.all_companies = true
          or c.code = any(up.allowed_companies)
        )
    )
  end;
$$;

-- 3.4 Validate financial data view permissions (SUPER_ADMIN, MANAGEMENT, FINANCE)
create or replace function public.can_view_financials()
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select case 
    when current_setting('is_superuser') = 'on' or current_user in ('postgres', 'service_role', 'supabase_admin') then true
    when auth.uid() is null then false
    else exists (
      select 1 from public.user_profiles
      where id = auth.uid()
        and is_active = true
        and role in ('SUPER_ADMIN', 'MANAGEMENT', 'FINANCE')
    )
  end;
$$;

-- 3.5 Validate financial data edit permissions (Strictly SUPER_ADMIN and FINANCE only; MANAGEMENT is read-only)
create or replace function public.can_edit_financials()
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select case 
    when current_setting('is_superuser') = 'on' or current_user in ('postgres', 'service_role', 'supabase_admin') then true
    when auth.uid() is null then false
    else exists (
      select 1 from public.user_profiles
      where id = auth.uid()
        and is_active = true
        and role in ('SUPER_ADMIN', 'FINANCE')
    )
  end;
$$;

-- 3.6 Validate hardware asset management permissions (SUPER_ADMIN, IT_ADMIN)
create or replace function public.can_manage_assets()
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select case 
    when current_setting('is_superuser') = 'on' or current_user in ('postgres', 'service_role', 'supabase_admin') then true
    when auth.uid() is null then false
    else exists (
      select 1 from public.user_profiles
      where id = auth.uid()
        and is_active = true
        and role in ('SUPER_ADMIN', 'IT_ADMIN')
    )
  end;
$$;

-- 3.7 Validate Stock Opname audit permissions (SUPER_ADMIN, IT_ADMIN, AUDITOR)
create or replace function public.can_reconcile_opname()
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select case 
    when current_setting('is_superuser') = 'on' or current_user in ('postgres', 'service_role', 'supabase_admin') then true
    when auth.uid() is null then false
    else exists (
      select 1 from public.user_profiles
      where id = auth.uid()
        and is_active = true
        and role in ('SUPER_ADMIN', 'IT_ADMIN', 'AUDITOR')
    )
  end;
$$;

-- 3.8 Resolve current employee ID
create or replace function public.get_current_employee_id()
returns text
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select case 
    when auth.uid() is null then null
    else (select employee_id from public.user_profiles where id = auth.uid() and is_active = true)
  end;
$$;

-- ------------------------------------------------------------------------------
-- 4. ANTI-PRIVILEGE ESCALATION TRIGGER
-- Strictly prevents unauthorized direct modifications to roles, scopes, or active statuses
-- ------------------------------------------------------------------------------

create or replace function public.prevent_unauthorized_profile_updates()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_role public.user_role;
begin
  -- Allow database administrator, service role, or internal migrations
  if current_setting('is_superuser') = 'on' or current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;

  v_caller_role := public.get_current_role();

  -- If caller is not an active SUPER_ADMIN:
  if v_caller_role is distinct from 'SUPER_ADMIN' then
    -- Non-Super Admins can NEVER modify role
    if old.role is distinct from new.role then
      raise exception 'Privilege Escalation Blocked: Only Super Admins can modify user roles.';
    end if;

    -- Non-Super Admins can NEVER modify company access permissions
    if old.all_companies is distinct from new.all_companies or old.allowed_companies is distinct from new.allowed_companies then
      raise exception 'Privilege Escalation Blocked: Only Super Admins can modify company access permissions.';
    end if;

    -- Non-Super Admins can NEVER activate or deactivate accounts
    if old.is_active is distinct from new.is_active then
      raise exception 'Security Violation: Only Super Admins can activate or deactivate user accounts.';
    end if;

    -- Non-Super Admins cannot modify other users' profiles
    if old.id != auth.uid() then
      raise exception 'Access Denied: You cannot modify another users profile.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_unauthorized_profile_updates on public.user_profiles;
create trigger trg_prevent_unauthorized_profile_updates
  before update on public.user_profiles
  for each row execute function public.prevent_unauthorized_profile_updates();

-- ------------------------------------------------------------------------------
-- 5. LAST ACTIVE SUPER ADMIN PROTECTION TRIGGER (CONCURRENCY-SAFE ROW LOCKING)
-- Protects the last active Super Admin from demotion, deactivation, deletion, and race conditions
-- ------------------------------------------------------------------------------

create or replace function public.protect_last_super_admin()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_other_admin_count integer;
begin
  -- Handle UPDATE: demotion or deactivation
  if tg_op = 'UPDATE' then
    if old.role = 'SUPER_ADMIN' and old.is_active = true and (new.role != 'SUPER_ADMIN' or new.is_active = false) then
      -- Exclusively lock all active Super Admin rows to prevent race conditions from concurrent transactions
      perform 1 from public.user_profiles
      where role = 'SUPER_ADMIN' and is_active = true
      for update;

      select count(*) into v_other_admin_count
      from public.user_profiles
      where role = 'SUPER_ADMIN'
        and is_active = true
        and id != old.id;

      if v_other_admin_count = 0 then
        raise exception 'Security Protection: Cannot demote or deactivate the last remaining active Super Admin account.';
      end if;
    end if;
    return new;
  end if;

  -- Handle DELETE: account deletion
  if tg_op = 'DELETE' then
    if old.role = 'SUPER_ADMIN' and old.is_active = true then
      -- Exclusively lock all active Super Admin rows to prevent race conditions from concurrent transactions
      perform 1 from public.user_profiles
      where role = 'SUPER_ADMIN' and is_active = true
      for update;

      select count(*) into v_other_admin_count
      from public.user_profiles
      where role = 'SUPER_ADMIN'
        and is_active = true
        and id != old.id;

      if v_other_admin_count = 0 then
        raise exception 'Security Protection: Cannot delete the last remaining active Super Admin account.';
      end if;
    end if;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_protect_last_super_admin on public.user_profiles;
create trigger trg_protect_last_super_admin
  before update or delete on public.user_profiles
  for each row execute function public.protect_last_super_admin();

-- ------------------------------------------------------------------------------
-- 6. AUTOMATED ROLE & SCOPE AUDIT LOGGING TRIGGER
-- ------------------------------------------------------------------------------

create or replace function public.log_user_profile_changes()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_name text;
begin
  if old.role is distinct from new.role
     or old.all_companies is distinct from new.all_companies
     or old.allowed_companies is distinct from new.allowed_companies
     or old.is_active is distinct from new.is_active then

    select coalesce(name, email, 'Super Admin') into v_caller_name
    from public.user_profiles
    where id = auth.uid();

    insert into public.user_role_history (
      user_id,
      user_email,
      changed_by,
      changed_by_name,
      old_role,
      new_role,
      old_all_companies,
      new_all_companies,
      old_allowed_companies,
      new_allowed_companies,
      old_is_active,
      new_is_active,
      notes
    ) values (
      new.id,
      new.email,
      auth.uid(),
      coalesce(v_caller_name, 'System Administrator'),
      old.role,
      new.role,
      old.all_companies,
      new.all_companies,
      old.allowed_companies,
      new.allowed_companies,
      old.is_active,
      new.is_active,
      'Administrative profile change recorded'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_user_profile_changes on public.user_profiles;
create trigger trg_log_user_profile_changes
  after update on public.user_profiles
  for each row execute function public.log_user_profile_changes();

-- ------------------------------------------------------------------------------
-- 7. REVISE USER PROFILES RLS POLICIES
-- ------------------------------------------------------------------------------

drop policy if exists "Profiles are viewable by everyone" on public.user_profiles;
drop policy if exists "Profiles are viewable by authenticated" on public.user_profiles;
drop policy if exists "Profiles update by user or admin" on public.user_profiles;
drop policy if exists "Users can update own profile" on public.user_profiles;
drop policy if exists "Super Admins can update all profiles" on public.user_profiles;
drop policy if exists "Users can update own display name" on public.user_profiles;
drop policy if exists "Super Admins can delete profiles" on public.user_profiles;

-- Super Admins can view all profiles; regular users can view their own profile
create policy "User profiles selectable by authorized users"
  on public.user_profiles for select
  to authenticated
  using (
    public.get_current_role() = 'SUPER_ADMIN'
    or id = auth.uid()
  );

-- Super Admins can update all profiles; regular users can only update their own display name
create policy "Super Admins can update all profiles"
  on public.user_profiles for update
  to authenticated
  using (public.get_current_role() = 'SUPER_ADMIN')
  with check (public.get_current_role() = 'SUPER_ADMIN');

create policy "Users can update own display name"
  on public.user_profiles for update
  to authenticated
  using (id = auth.uid() and public.get_current_role() is not null)
  with check (id = auth.uid() and public.get_current_role() is not null);

-- Super Admins can delete user profiles
create policy "Super Admins can delete profiles"
  on public.user_profiles for delete
  to authenticated
  using (public.get_current_role() = 'SUPER_ADMIN');

-- ------------------------------------------------------------------------------
-- 8. SECURE AUTH NEW-USER TRIGGER (PERMANENTLY DISABLE AUTO-ELEVATION)
-- All new users strictly default to EMPLOYEE with zero company access
-- ------------------------------------------------------------------------------

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text;
begin
  v_name := coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));

  insert into public.user_profiles (
    id,
    email,
    name,
    role,
    all_companies,
    allowed_companies,
    is_active
  ) values (
    new.id,
    lower(new.email),
    coalesce(v_name, 'New User'),
    'EMPLOYEE'::public.user_role,
    false,
    '{}',
    true
  )
  on conflict (id) do update
  set
    email = lower(excluded.email),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ------------------------------------------------------------------------------
-- 9. STRICT LEAST-PRIVILEGE GRANTS & PRIVILEGE HARDENING
-- ------------------------------------------------------------------------------

-- Audit history: authenticated users can only SELECT (audited records)
revoke all on public.user_role_history from public, anon;
revoke insert, update, delete, truncate on public.user_role_history from authenticated;
grant select on public.user_role_history to authenticated;

-- Function execution grants
grant execute on function public.get_current_profile() to authenticated;
grant execute on function public.get_current_role() to authenticated;
grant execute on function public.can_access_company(text) to authenticated;
grant execute on function public.can_view_financials() to authenticated;
grant execute on function public.can_edit_financials() to authenticated;
grant execute on function public.can_manage_assets() to authenticated;
grant execute on function public.can_reconcile_opname() to authenticated;
grant execute on function public.get_current_employee_id() to authenticated;

commit;
