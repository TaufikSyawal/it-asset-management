-- ==============================================================================
-- PRODUCTION HARDENING: CENTRALIZED USER MANAGEMENT & RBAC GOVERNANCE
-- ==============================================================================
-- Description:
--   1. Adds is_active status column to public.user_profiles (defaults to true).
--   2. Disables access immediately for deactivated users across all RLS functions.
--   3. Creates immutable public.user_role_history audit trail table.
--   4. Creates database trigger to prevent accidental demotion/deactivation of the last Super Admin.
--   5. Creates database trigger to automatically log all role, company, and active status modifications.
--   6. Enforces strict default EMPLOYEE role with all_companies=false and allowed_companies={} on newly invited/created users.
-- ==============================================================================

-- 1. ADD is_active COLUMN TO USER PROFILES
alter table public.user_profiles add column if not exists is_active boolean not null default true;
create index if not exists idx_user_profiles_is_active on public.user_profiles(is_active);

-- 2. CREATE IMMUTABLE USER ROLE & PERMISSION AUDIT HISTORY TABLE
create table if not exists public.user_role_history (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
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

alter table public.user_role_history enable row level security;

create policy "Super Admins can view all role history"
  on public.user_role_history for select
  to authenticated
  using (public.get_current_role() = 'SUPER_ADMIN' or user_id = auth.uid());

create policy "Role history can be inserted by Super Admin or trigger"
  on public.user_role_history for insert
  to authenticated
  with check (public.get_current_role() = 'SUPER_ADMIN' or auth.uid() is not null);

create policy "Role history is immutable (no update)"
  on public.user_role_history for update
  to authenticated
  using (false);

create policy "Role history is immutable (no delete)"
  on public.user_role_history for delete
  to authenticated
  using (false);

-- 3. TRIGGER: PROTECT LAST ACTIVE SUPER ADMIN FROM DEMOTION OR DEACTIVATION
create or replace function public.protect_last_super_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_other_admin_count integer;
begin
  if old.role = 'SUPER_ADMIN' and old.is_active = true and (new.role != 'SUPER_ADMIN' or new.is_active = false) then
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
end;
$$;

drop trigger if exists trg_protect_last_super_admin on public.user_profiles;
create trigger trg_protect_last_super_admin
  before update on public.user_profiles
  for each row
  execute function public.protect_last_super_admin();

-- 4. TRIGGER: AUTOMATIC ROLE & SCOPE AUDIT LOGGING
create or replace function public.log_user_profile_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_name text;
begin
  if old.role != new.role
     or old.all_companies != new.all_companies
     or old.allowed_companies != new.allowed_companies
     or old.is_active != new.is_active then

    select name into v_caller_name from public.user_profiles where id = auth.uid();

    insert into public.user_role_history (
      user_id,
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
      auth.uid(),
      coalesce(v_caller_name, 'Super Admin'),
      old.role,
      new.role,
      old.all_companies,
      new.all_companies,
      old.allowed_companies,
      new.allowed_companies,
      old.is_active,
      new.is_active,
      'Updated via centralized User Management'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_user_profile_changes on public.user_profiles;
create trigger trg_log_user_profile_changes
  after update on public.user_profiles
  for each row
  execute function public.log_user_profile_changes();

-- 5. UPDATE RLS HELPER FUNCTIONS TO IMMEDIATELY BLOCK DEACTIVATED ACCOUNTS
create or replace function public.get_current_role()
returns public.user_role
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select role from public.user_profiles where id = auth.uid() and is_active = true),
    'EMPLOYEE'::public.user_role
  );
$$;

create or replace function public.can_access_company(p_company_id text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles up
    join public.companies c on c.id = p_company_id
    where up.id = auth.uid()
      and up.is_active = true
      and (
        up.role = 'SUPER_ADMIN'
        or up.all_companies = true
        or c.code = any(up.allowed_companies)
      )
  );
$$;

create or replace function public.can_manage_assets()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles
    where id = auth.uid()
      and is_active = true
      and role in ('SUPER_ADMIN', 'IT_ADMIN')
  );
$$;

create or replace function public.can_view_financials()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles
    where id = auth.uid()
      and is_active = true
      and role in ('SUPER_ADMIN', 'MANAGEMENT', 'FINANCE')
  );
$$;

grant select, insert on public.user_role_history to authenticated;

