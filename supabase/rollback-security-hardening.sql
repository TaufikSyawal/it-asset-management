-- ==============================================================================
-- IT Asset Management System - Security Hardening Rollback Script
-- Target: Supabase PostgreSQL (Rollback to Baseline Schema)
-- ==============================================================================

begin;

-- 1. Drop added triggers
drop trigger if exists trg_prevent_direct_status_tampering on public.assets;
drop function if exists public.prevent_direct_asset_status_tampering();

drop trigger if exists trg_enforce_asset_financials on public.assets;
drop function if exists public.enforce_asset_financial_permissions();

drop trigger if exists trg_log_asset_history on public.assets;
drop function if exists public.log_asset_lifecycle_history();

drop trigger if exists trg_log_asset_photo_history on public.asset_photos;
drop function if exists public.log_asset_photo_history();

-- 2. Drop can_edit_financials function
drop function if exists public.can_edit_financials();

-- 3. Restore baseline helper functions
create or replace function public.get_current_role()
returns public.user_role
language sql
security definer
stable
as $$
  select coalesce(
    (select role from public.user_profiles where id = auth.uid()),
    'EMPLOYEE'::public.user_role
  );
$$;

create or replace function public.can_access_company(target_company_id text)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.user_profiles up
    join public.companies c on c.id = target_company_id
    where up.id = auth.uid()
      and (
        up.role = 'SUPER_ADMIN'
        or up.all_companies = true
        or c.code = any(up.allowed_companies)
      )
  );
$$;

create or replace function public.can_view_financials()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.user_profiles
    where id = auth.uid()
      and role in ('SUPER_ADMIN', 'MANAGEMENT', 'FINANCE')
  );
$$;

-- 4. Restore baseline table grants
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.companies to anon;
grant select on public.assets_view to anon, authenticated;
grant usage, select on all sequences in schema public to authenticated, anon;
grant execute on all routines in schema public to authenticated, anon;

-- 5. Restore baseline policies on asset_histories
drop policy if exists "Histories insert is forbidden for application users" on public.asset_histories;
create policy "Histories insert allowed for system/authenticated"
  on public.asset_histories for insert
  to authenticated
  with check (true);

commit;

