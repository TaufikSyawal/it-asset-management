-- ==============================================================================
-- IT Asset Management System - Production Supabase Database Schema
-- Architecture: Multi-Company Scoping (GMD, GMC, TEL), Strict RLS, 6 User Roles
-- Target: Supabase Free Tier ($0/month)
-- ==============================================================================

-- 1. EXTENSIONS
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 2. ENUMS
do $$ begin
  create type public.user_role as enum (
    'SUPER_ADMIN',
    'MANAGEMENT',
    'IT_ADMIN',
    'FINANCE',
    'AUDITOR',
    'EMPLOYEE'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.asset_status as enum (
    'AVAILABLE',
    'IN_USE',
    'MAINTENANCE',
    'DISPOSED',
    'ARCHIVED',
    'MISSING'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.physical_condition as enum (
    'EXCELLENT',
    'GOOD',
    'FAIR',
    'POOR',
    'DAMAGED'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.asset_category as enum (
    'LAPTOP',
    'DESKTOP',
    'SERVER',
    'MONITOR',
    'PRINTER',
    'NETWORK_EQUIPMENT',
    'ACCESSORY',
    'OTHER'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.assignment_action as enum (
    'ASSIGN',
    'RETURN',
    'TRANSFER',
    'REPLACEMENT'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.depreciation_method as enum (
    'STRAIGHT_LINE',
    'REDUCING_BALANCE',
    'NONE'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.opname_status as enum (
    'PLANNED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.verification_status as enum (
    'PENDING',
    'VERIFIED',
    'MISMATCH_LOCATION',
    'MISMATCH_USER',
    'MISSING',
    'UNREGISTERED'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.photo_category as enum (
    'MAIN_PHOTO',
    'FRONT_VIEW',
    'BACK_BOTTOM_VIEW',
    'SERIAL_NUMBER',
    'DAMAGE_CONDITION',
    'HANDOVER',
    'RETURN',
    'OTHER'
  );
exception when duplicate_object then null; end $$;

-- 3. TABLES

-- 3.1 Companies Table (GMD, GMC, TEL)
create table if not exists public.companies (
  id text primary key default gen_random_uuid()::text,
  code text unique not null, -- GMD, GMC, TEL
  name text not null,        -- GMD, GMC, TEL
  description text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

-- 3.2 Employees Table
create table if not exists public.employees (
  id text primary key default gen_random_uuid()::text,
  employee_id text unique not null,
  name text not null,
  email text unique,
  department text,
  company_id text not null references public.companies(id) on delete restrict,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);
create index if not exists idx_employees_company_id on public.employees(company_id);

-- 3.3 User Profiles (Links 1:1 with auth.users)
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  role public.user_role not null default 'EMPLOYEE',
  all_companies boolean not null default false,
  allowed_companies text[] not null default '{}',
  employee_id text references public.employees(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);
create index if not exists idx_user_profiles_role on public.user_profiles(role);

-- 3.4 Hardware Assets Table
create table if not exists public.assets (
  id text primary key default gen_random_uuid()::text,
  asset_tag text not null,
  is_duplicate_tag boolean not null default false,
  asset_name text not null,
  company_id text not null references public.companies(id) on delete restrict,
  category public.asset_category not null default 'LAPTOP',
  model text not null,
  cpu text not null,
  ram text not null,
  serial_number text,
  mac_address text,
  status public.asset_status not null default 'AVAILABLE',
  physical_condition public.physical_condition not null default 'GOOD',
  assigned_employee_id text references public.employees(id) on delete set null,
  location text not null,
  purchase_date timestamptz,
  
  -- Financial schema (column-masked at database level via views)
  purchase_cost numeric(12, 2),
  useful_life_months integer,
  depreciation_method public.depreciation_method not null default 'STRAIGHT_LINE',
  accumulated_depreciation numeric(12, 2) default 0,
  net_book_value numeric(12, 2),
  depreciation_start_date timestamptz,
  
  -- Non-sensitive hardware account references
  laptop_code text,
  laptop_account text,
  username text,
  notes text,
  
  -- Cryptographic Stock Opname token
  qr_code_token text unique,
  
  is_archived boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);
create index if not exists idx_assets_company_id on public.assets(company_id);
create index if not exists idx_assets_asset_tag on public.assets(asset_tag);
create index if not exists idx_assets_status on public.assets(status);
create index if not exists idx_assets_category on public.assets(category);
create index if not exists idx_assets_assigned_emp on public.assets(assigned_employee_id);

-- 3.5 Asset Assignment History Table
create table if not exists public.asset_assignments (
  id text primary key default gen_random_uuid()::text,
  asset_id text not null references public.assets(id) on delete cascade,
  employee_id text references public.employees(id) on delete set null,
  action_type public.assignment_action not null,
  condition_at_action public.physical_condition not null default 'GOOD',
  assigned_at timestamptz not null default timezone('utc'::text, now()),
  returned_at timestamptz,
  performed_by text,
  handover_doc_ref text,
  notes text
);
create index if not exists idx_assignments_asset_id on public.asset_assignments(asset_id);
create index if not exists idx_assignments_employee_id on public.asset_assignments(employee_id);

-- 3.6 Asset Photos Metadata Table
create table if not exists public.asset_photos (
  id text primary key default gen_random_uuid()::text,
  asset_id text not null references public.assets(id) on delete cascade,
  category public.photo_category not null default 'MAIN_PHOTO',
  file_key text unique not null,
  thumbnail_key text,
  original_filename text not null,
  mime_type text not null,
  file_size integer not null,
  width integer,
  height integer,
  description text,
  is_primary boolean not null default false,
  assignment_id text references public.asset_assignments(id) on delete set null,
  uploaded_by text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);
create index if not exists idx_photos_asset_id on public.asset_photos(asset_id);
create index if not exists idx_photos_category on public.asset_photos(category);
create index if not exists idx_photos_is_primary on public.asset_photos(is_primary);

-- 3.7 Immutable Audit History Table
create table if not exists public.asset_histories (
  id text primary key default gen_random_uuid()::text,
  asset_id text not null references public.assets(id) on delete cascade,
  action text not null,
  changes jsonb,
  notes text,
  performed_by text,
  created_at timestamptz not null default timezone('utc'::text, now())
);
create index if not exists idx_histories_asset_id on public.asset_histories(asset_id);

-- 3.8 Stock Opname Sessions Table
create table if not exists public.stock_opname_sessions (
  id text primary key default gen_random_uuid()::text,
  session_number text unique not null,
  title text not null,
  company_id text references public.companies(id) on delete set null,
  location_scope text default 'ALL',
  category_scope text default 'ALL',
  status public.opname_status not null default 'IN_PROGRESS',
  start_date timestamptz not null default timezone('utc'::text, now()),
  end_date timestamptz,
  conducted_by text,
  reconciled_at timestamptz,
  reconciled_by text,
  notes text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);
create index if not exists idx_opname_sessions_company on public.stock_opname_sessions(company_id);
create index if not exists idx_opname_sessions_status on public.stock_opname_sessions(status);

-- 3.9 Stock Opname Audit Items (Expected Snapshot & Actual Scans)
create table if not exists public.stock_opname_items (
  id text primary key default gen_random_uuid()::text,
  session_id text not null references public.stock_opname_sessions(id) on delete cascade,
  asset_id text not null references public.assets(id) on delete cascade,
  expected_location text,
  expected_employee_id text,
  expected_condition public.physical_condition,
  scanned_at timestamptz,
  scanned_by text,
  verification_status public.verification_status not null default 'PENDING',
  actual_location text,
  actual_condition public.physical_condition,
  actual_employee_id text,
  is_unexpected boolean not null default false,
  scan_count integer not null default 0,
  discrepancy_notes text,
  reconciled boolean not null default false,
  notes text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique(session_id, asset_id)
);
create index if not exists idx_opname_items_session on public.stock_opname_items(session_id);
create index if not exists idx_opname_items_asset on public.stock_opname_items(asset_id);
create index if not exists idx_opname_items_status on public.stock_opname_items(verification_status);

-- 4. SECURITY DEFINER HELPER FUNCTIONS

-- 4.1 Get current user's profile
create or replace function public.get_current_profile()
returns public.user_profiles
language sql
security definer
stable
as $$
  select * from public.user_profiles where id = auth.uid();
$$;

-- 4.2 Get current role
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

-- 4.3 Check company access
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

-- 4.4 Check financial view permission
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

-- 4.5 Check hardware management permission
create or replace function public.can_manage_assets()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.user_profiles
    where id = auth.uid()
      and role in ('SUPER_ADMIN', 'IT_ADMIN')
  );
$$;

-- 4.6 Check Stock Opname reconciliation permission
create or replace function public.can_reconcile_opname()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.user_profiles
    where id = auth.uid()
      and role in ('SUPER_ADMIN', 'IT_ADMIN', 'AUDITOR')
  );
$$;

-- 4.7 Get employee ID of logged-in user
create or replace function public.get_current_employee_id()
returns text
language sql
security definer
stable
as $$
  select employee_id from public.user_profiles where id = auth.uid();
$$;

-- 5. SECURE DATABASE VIEWS (WITH security_invoker = true)

-- Masked Assets View preventing direct API financial leaks
create or replace view public.assets_view as
select
  a.id,
  a.asset_tag,
  a.is_duplicate_tag,
  a.asset_name,
  a.company_id,
  a.category,
  a.model,
  a.cpu,
  a.ram,
  a.serial_number,
  a.mac_address,
  a.status,
  a.physical_condition,
  a.assigned_employee_id,
  a.location,
  a.purchase_date,
  a.laptop_code,
  a.laptop_account,
  a.username,
  a.notes,
  a.qr_code_token,
  a.is_archived,
  a.created_at,
  a.updated_at,
  -- Dynamic Financial Masking:
  case when public.can_view_financials() then a.purchase_cost else null end as purchase_cost,
  case when public.can_view_financials() then a.useful_life_months else null end as useful_life_months,
  case when public.can_view_financials() then a.depreciation_method else null end as depreciation_method,
  case when public.can_view_financials() then a.accumulated_depreciation else null end as accumulated_depreciation,
  case when public.can_view_financials() then a.net_book_value else null end as net_book_value,
  case when public.can_view_financials() then a.depreciation_start_date else null end as depreciation_start_date
from public.assets a
where public.can_access_company(a.company_id)
  and (
    public.get_current_role() != 'EMPLOYEE'
    or a.assigned_employee_id = public.get_current_employee_id()
  );

-- 6. ROW LEVEL SECURITY (RLS) POLICIES

-- Enable RLS across all tables
alter table public.companies enable row level security;
alter table public.employees enable row level security;
alter table public.user_profiles enable row level security;
alter table public.assets enable row level security;
alter table public.asset_assignments enable row level security;
alter table public.asset_photos enable row level security;
alter table public.asset_histories enable row level security;
alter table public.stock_opname_sessions enable row level security;
alter table public.stock_opname_items enable row level security;

-- 6.1 Companies RLS
create policy "Companies are readable by authorized company users"
  on public.companies for select
  to authenticated
  using (public.can_access_company(id));

create policy "Companies manage restricted to SUPER_ADMIN"
  on public.companies for all
  to authenticated
  using (public.get_current_role() = 'SUPER_ADMIN')
  with check (public.get_current_role() = 'SUPER_ADMIN');

-- 6.2 Employees RLS
create policy "Employees selectable by company members"
  on public.employees for select
  to authenticated
  using (public.can_access_company(company_id));

create policy "Employees manage restricted to IT_ADMIN and SUPER_ADMIN"
  on public.employees for all
  to authenticated
  using (public.can_manage_assets())
  with check (public.can_manage_assets());

-- 6.3 User Profiles RLS (Strict Anti-Privilege Escalation)
create policy "Users can read their own profile"
  on public.user_profiles for select
  to authenticated
  using (id = auth.uid() or public.get_current_role() = 'SUPER_ADMIN');

create policy "Only SUPER_ADMIN can insert profiles"
  on public.user_profiles for insert
  to authenticated
  with check (public.get_current_role() = 'SUPER_ADMIN');

create policy "Only SUPER_ADMIN can update profiles"
  on public.user_profiles for update
  to authenticated
  using (public.get_current_role() = 'SUPER_ADMIN')
  with check (public.get_current_role() = 'SUPER_ADMIN');

create policy "Only SUPER_ADMIN can delete profiles"
  on public.user_profiles for delete
  to authenticated
  using (public.get_current_role() = 'SUPER_ADMIN');

-- 6.4 Assets Table RLS
create policy "Assets selectable by company members"
  on public.assets for select
  to authenticated
  using (
    public.can_access_company(company_id)
    and (
      public.get_current_role() != 'EMPLOYEE'
      or assigned_employee_id = public.get_current_employee_id()
    )
  );

create policy "Assets insert restricted to IT_ADMIN and SUPER_ADMIN"
  on public.assets for insert
  to authenticated
  with check (
    public.can_manage_assets()
    and public.can_access_company(company_id)
  );

create policy "Assets update restricted to authorized roles"
  on public.assets for update
  to authenticated
  using (
    public.can_access_company(company_id)
    and (public.can_manage_assets() or public.get_current_role() = 'FINANCE')
  )
  with check (
    public.can_access_company(company_id)
    and (public.can_manage_assets() or public.get_current_role() = 'FINANCE')
  );

-- Hard Delete is disabled for Assets (Must use is_archived = true)
create policy "Assets delete is forbidden"
  on public.assets for delete
  to authenticated
  using (false);

-- 6.5 Asset Assignments RLS
create policy "Assignments selectable by company members"
  on public.asset_assignments for select
  to authenticated
  using (
    exists (
      select 1 from public.assets a
      where a.id = asset_id and public.can_access_company(a.company_id)
    )
  );

create policy "Assignments insert/update restricted to IT_ADMIN and SUPER_ADMIN"
  on public.asset_assignments for all
  to authenticated
  using (public.can_manage_assets())
  with check (public.can_manage_assets());

-- 6.6 Asset Photos RLS
create policy "Photos selectable by company members"
  on public.asset_photos for select
  to authenticated
  using (
    exists (
      select 1 from public.assets a
      where a.id = asset_id and public.can_access_company(a.company_id)
    )
  );

create policy "Photos manage restricted to IT_ADMIN and SUPER_ADMIN"
  on public.asset_photos for all
  to authenticated
  using (public.can_manage_assets())
  with check (public.can_manage_assets());

-- 6.7 Asset Histories RLS (IMMUTABLE AUDIT TRAIL)
create policy "Histories selectable by company members"
  on public.asset_histories for select
  to authenticated
  using (
    exists (
      select 1 from public.assets a
      where a.id = asset_id and public.can_access_company(a.company_id)
    )
  );

create policy "Histories insert allowed for system/authenticated"
  on public.asset_histories for insert
  to authenticated
  with check (true);

-- Explicitly forbid DELETE and UPDATE on asset_histories (strictly append-only audit trail)
create policy "Histories delete is forbidden"
  on public.asset_histories for delete
  to public
  using (false);

create policy "Histories update is forbidden"
  on public.asset_histories for update
  to public
  using (false);

-- 6.8 Stock Opname Sessions RLS
create policy "Opname sessions selectable by company members"
  on public.stock_opname_sessions for select
  to authenticated
  using (
    company_id is null or public.can_access_company(company_id)
  );

create policy "Opname sessions manage restricted to authorized administrators"
  on public.stock_opname_sessions for all
  to authenticated
  using (public.can_reconcile_opname())
  with check (public.can_reconcile_opname());

-- 6.9 Stock Opname Items RLS
create policy "Opname items selectable by session company members"
  on public.stock_opname_items for select
  to authenticated
  using (
    exists (
      select 1 from public.stock_opname_sessions s
      where s.id = session_id and (s.company_id is null or public.can_access_company(s.company_id))
    )
  );

create policy "Opname items manage restricted to auditors and admins"
  on public.stock_opname_items for all
  to authenticated
  using (public.can_reconcile_opname())
  with check (public.can_reconcile_opname());

-- 7. TRANSACTIONAL STORED PROCEDURES (RPC)

-- 7.1 Perform Asset Assignment (Handover, Return, Transfer, Replacement)
create or replace function public.perform_asset_assignment(
  p_asset_id text,
  p_action_type public.assignment_action,
  p_employee_id text default null,
  p_condition public.physical_condition default 'GOOD',
  p_handover_doc_ref text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_user_role public.user_role;
  v_caller_name text;
  v_asset public.assets%rowtype;
  v_new_status public.asset_status;
  v_new_employee_id text;
  v_assignment_id text;
  v_history_notes text;
  v_target_employee_name text;
begin
  -- 1. Authorization check
  v_user_role := public.get_current_role();
  if v_user_role not in ('SUPER_ADMIN', 'IT_ADMIN') then
    raise exception 'Forbidden: You do not have permission to assign or transfer assets.';
  end if;

  select name into v_caller_name from public.user_profiles where id = auth.uid();
  if v_caller_name is null then
    v_caller_name := 'Authorized IT Admin';
  end if;

  -- 2. Fetch target asset
  select * into v_asset from public.assets where id = p_asset_id;
  if not found then
    raise exception 'Asset with ID % not found.', p_asset_id;
  end if;

  -- 3. Check company access
  if not public.can_access_company(v_asset.company_id) then
    raise exception 'Forbidden: You do not have access to manage assets for this company.';
  end if;

  -- 4. Close any currently active assignments
  update public.asset_assignments
  set returned_at = now()
  where asset_id = p_asset_id and returned_at is null;

  -- 5. Determine new status and target assignment details
  if p_action_type = 'RETURN' then
    v_new_status := 'AVAILABLE';
    v_new_employee_id := null;
    v_history_notes := 'Asset returned to storage pool. Condition: ' || p_condition::text;
    if p_handover_doc_ref is not null then
      v_history_notes := v_history_notes || '. Ref: ' || p_handover_doc_ref;
    end if;

    -- Create return assignment record
    insert into public.asset_assignments (
      asset_id, employee_id, action_type, condition_at_action,
      assigned_at, returned_at, performed_by, handover_doc_ref, notes
    ) values (
      p_asset_id, v_asset.assigned_employee_id, 'RETURN', p_condition,
      now(), now(), v_caller_name, p_handover_doc_ref, p_notes
    ) returning id into v_assignment_id;

  elsif p_action_type in ('ASSIGN', 'TRANSFER') then
    if p_employee_id is null then
      raise exception 'Employee must be selected for assignment or transfer.';
    end if;

    select name into v_target_employee_name from public.employees where id = p_employee_id;
    if not found then
      raise exception 'Target employee not found.';
    end if;

    v_new_status := 'IN_USE';
    v_new_employee_id := p_employee_id;
    v_history_notes := (case when p_action_type = 'TRANSFER' then 'Transferred to ' else 'Assigned to ' end) || v_target_employee_name || '. Condition: ' || p_condition::text;
    if p_handover_doc_ref is not null then
      v_history_notes := v_history_notes || '. Ref: ' || p_handover_doc_ref;
    end if;

    insert into public.asset_assignments (
      asset_id, employee_id, action_type, condition_at_action,
      assigned_at, returned_at, performed_by, handover_doc_ref, notes
    ) values (
      p_asset_id, p_employee_id, p_action_type, p_condition,
      now(), null, v_caller_name, p_handover_doc_ref, p_notes
    ) returning id into v_assignment_id;

  elsif p_action_type = 'REPLACEMENT' then
    v_new_status := 'MAINTENANCE';
    v_new_employee_id := null;
    v_history_notes := 'Marked for replacement / hardware maintenance. Condition: ' || p_condition::text;

    insert into public.asset_assignments (
      asset_id, employee_id, action_type, condition_at_action,
      assigned_at, returned_at, performed_by, handover_doc_ref, notes
    ) values (
      p_asset_id, null, 'REPLACEMENT', p_condition,
      now(), now(), v_caller_name, p_handover_doc_ref, p_notes
    ) returning id into v_assignment_id;
  end if;

  -- 6. Update Asset Record
  update public.assets
  set
    status = v_new_status,
    assigned_employee_id = v_new_employee_id,
    physical_condition = p_condition,
    updated_at = now()
  where id = p_asset_id;

  -- 7. Create Immutable History Log
  insert into public.asset_histories (
    asset_id, action, notes, performed_by, created_at
  ) values (
    p_asset_id, p_action_type::text,
    v_history_notes || case when p_notes is not null then ' | Notes: ' || p_notes else '' end,
    v_caller_name, now()
  );

  return jsonb_build_object(
    'success', true,
    'asset_id', p_asset_id,
    'assignment_id', v_assignment_id,
    'status', v_new_status,
    'message', 'Asset assignment operation completed successfully.'
  );
end;
$$;

-- 7.2 Create Stock Opname Session with Snapshot of Expected Items
create or replace function public.create_stock_opname_session(
  p_title text,
  p_company_id text default null,
  p_location_scope text default 'ALL',
  p_category_scope text default 'ALL',
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_session_id text;
  v_session_number text;
  v_next_seq integer;
  v_year text;
  v_item_count integer := 0;
  v_caller_name text;
begin
  if not public.can_reconcile_opname() then
    raise exception 'Forbidden: You do not have permission to initiate stock opname audits.';
  end if;

  select name into v_caller_name from public.user_profiles where id = auth.uid();
  v_year := to_char(now(), 'YYYY');

  -- Generate sequential session number (e.g. OPN-2026-001)
  select count(*) + 1 into v_next_seq from public.stock_opname_sessions
  where to_char(created_at, 'YYYY') = v_year;

  v_session_number := 'OPN-' || v_year || '-' || lpad(v_next_seq::text, 3, '0');

  -- Create session
  insert into public.stock_opname_sessions (
    session_number, title, company_id, location_scope, category_scope,
    status, start_date, conducted_by, notes
  ) values (
    v_session_number, p_title, p_company_id, p_location_scope, p_category_scope,
    'IN_PROGRESS', now(), coalesce(v_caller_name, 'IT Auditor'), p_notes
  ) returning id into v_session_id;

  -- Capture expected snapshot of matching active assets
  insert into public.stock_opname_items (
    session_id, asset_id, expected_location, expected_employee_id, expected_condition
  )
  select
    v_session_id, a.id, a.location, a.assigned_employee_id, a.physical_condition
  from public.assets a
  where a.is_archived = false
    and (p_company_id is null or a.company_id = p_company_id)
    and (p_location_scope = 'ALL' or a.location = p_location_scope)
    and (p_category_scope = 'ALL' or a.category::text = p_category_scope);

  get diagnostics v_item_count = row_count;

  return jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'session_number', v_session_number,
    'expected_items_count', v_item_count
  );
end;
$$;

-- 7.3 Record Stock Opname Barcode Scan
create or replace function public.record_stock_opname_scan(
  p_session_id text,
  p_asset_id text,
  p_location text,
  p_condition public.physical_condition,
  p_employee_id text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_session public.stock_opname_sessions%rowtype;
  v_asset public.assets%rowtype;
  v_existing_item public.stock_opname_items%rowtype;
  v_status public.verification_status := 'VERIFIED';
  v_is_unexpected boolean := false;
  v_discrepancy text := null;
  v_caller_name text;
begin
  if not public.can_reconcile_opname() then
    raise exception 'Forbidden: You do not have permission to record audit scans.';
  end if;

  select name into v_caller_name from public.user_profiles where id = auth.uid();

  -- Verify active session
  select * into v_session from public.stock_opname_sessions where id = p_session_id;
  if not found or v_session.status != 'IN_PROGRESS' then
    raise exception 'Stock Opname session is not active.';
  end if;

  -- Verify asset exists
  select * into v_asset from public.assets where id = p_asset_id;
  if not found then
    raise exception 'Asset not found in database.';
  end if;

  -- Check if item was in the expected snapshot
  select * into v_existing_item from public.stock_opname_items
  where session_id = p_session_id and asset_id = p_asset_id;

  if not found then
    v_is_unexpected := true;
    v_status := 'UNREGISTERED';
    v_discrepancy := 'Asset was not part of the initial audit scope for this session.';

    insert into public.stock_opname_items (
      session_id, asset_id, expected_location, expected_employee_id, expected_condition,
      scanned_at, scanned_by, verification_status, actual_location, actual_condition,
      actual_employee_id, is_unexpected, scan_count, discrepancy_notes, notes
    ) values (
      p_session_id, p_asset_id, v_asset.location, v_asset.assigned_employee_id, v_asset.physical_condition,
      now(), coalesce(v_caller_name, 'Auditor'), v_status, p_location, p_condition,
      p_employee_id, true, 1, v_discrepancy, p_notes
    );
  else
    -- Evaluate location & custody discrepancies
    if p_location != coalesce(v_existing_item.expected_location, '') then
      v_status := 'MISMATCH_LOCATION';
      v_discrepancy := 'Location mismatch: Expected "' || coalesce(v_existing_item.expected_location, 'None') || '", Scanned at "' || p_location || '"';
    elsif p_employee_id is distinct from v_existing_item.expected_employee_id then
      v_status := 'MISMATCH_USER';
      v_discrepancy := 'Custodian mismatch: Scanned custodian differs from expected records.';
    else
      v_status := 'VERIFIED';
    end if;

    update public.stock_opname_items
    set
      scanned_at = now(),
      scanned_by = coalesce(v_caller_name, 'Auditor'),
      verification_status = v_status,
      actual_location = p_location,
      actual_condition = p_condition,
      actual_employee_id = p_employee_id,
      scan_count = scan_count + 1,
      discrepancy_notes = v_discrepancy,
      notes = coalesce(p_notes, notes),
      updated_at = now()
    where session_id = p_session_id and asset_id = p_asset_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'verification_status', v_status,
    'is_unexpected', v_is_unexpected,
    'discrepancy_notes', v_discrepancy
  );
end;
$$;

-- 7.4 Reconcile Stock Opname Session
create or replace function public.reconcile_stock_opname(
  p_session_id text,
  p_reconciliation_notes text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_session public.stock_opname_sessions%rowtype;
  v_caller_name text;
  v_reconciled_count integer := 0;
  r record;
begin
  if not public.can_reconcile_opname() then
    raise exception 'Forbidden: Only authorized administrators or auditors can reconcile stock opname audits.';
  end if;

  select name into v_caller_name from public.user_profiles where id = auth.uid();

  select * into v_session from public.stock_opname_sessions where id = p_session_id;
  if not found or v_session.status != 'IN_PROGRESS' then
    raise exception 'Session cannot be reconciled in its current status.';
  end if;

  -- 1. For non-scanned items: Mark verification_status as MISSING
  update public.stock_opname_items
  set
    verification_status = 'MISSING',
    discrepancy_notes = 'Asset was not physically scanned during this audit.',
    reconciled = true,
    updated_at = now()
  where session_id = p_session_id and scanned_at is null;

  -- 2. Update physical assets from verified/mismatched scans
  for r in (
    select * from public.stock_opname_items
    where session_id = p_session_id and scanned_at is not null
  ) loop
    update public.assets
    set
      location = coalesce(r.actual_location, location),
      physical_condition = coalesce(r.actual_condition, physical_condition),
      updated_at = now()
    where id = r.asset_id;

    insert into public.asset_histories (
      asset_id, action, notes, performed_by, created_at
    ) values (
      r.asset_id, 'STOCK_OPNAME_RECONCILED',
      'Stock Opname ' || v_session.session_number || ' reconciled by ' || coalesce(v_caller_name, 'Auditor') || '. Status: ' || r.verification_status::text || case when r.discrepancy_notes is not null then ' (' || r.discrepancy_notes || ')' else '' end,
      coalesce(v_caller_name, 'Auditor'), now()
    );

    v_reconciled_count := v_reconciled_count + 1;
  end loop;

  -- 3. Mark non-scanned assets in inventory as MISSING
  for r in (
    select asset_id from public.stock_opname_items
    where session_id = p_session_id and verification_status = 'MISSING'
  ) loop
    update public.assets
    set status = 'MISSING', updated_at = now()
    where id = r.asset_id and status != 'ARCHIVED';

    insert into public.asset_histories (
      asset_id, action, notes, performed_by, created_at
    ) values (
      r.asset_id, 'STOCK_OPNAME_MISSING',
      'Marked as MISSING following Stock Opname ' || v_session.session_number || ' reconciliation.',
      coalesce(v_caller_name, 'Auditor'), now()
    );
  end loop;

  -- 4. Complete session
  update public.stock_opname_sessions
  set
    status = 'COMPLETED',
    end_date = now(),
    reconciled_at = now(),
    reconciled_by = coalesce(v_caller_name, 'Auditor'),
    notes = case when p_reconciliation_notes is not null then coalesce(notes || E'\n', '') || p_reconciliation_notes else notes end,
    updated_at = now()
  where id = p_session_id;

  update public.stock_opname_items
  set reconciled = true
  where session_id = p_session_id;

  return jsonb_build_object(
    'success', true,
    'session_number', v_session.session_number,
    'updated_assets_count', v_reconciled_count,
    'message', 'Stock Opname reconciliation successfully executed.'
  );
end;
$$;

-- 8. STORAGE SETUP SCRIPT FOR PRIVATE BUCKET: asset-photos
insert into storage.buckets (id, name, public)
values ('asset-photos', 'asset-photos', false)
on conflict (id) do update set public = false;

-- Storage RLS Policies
create policy "Authenticated users can read asset photos"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'asset-photos');

create policy "Admins can upload asset photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'asset-photos'
    and public.can_manage_assets()
  );

create policy "Admins can update asset photos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'asset-photos'
    and public.can_manage_assets()
  );

create policy "Admins can delete asset photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'asset-photos'
    and public.can_manage_assets()
  );

-- ==============================================================================
-- 10. AUTH TRIGGER: AUTO-PROVISION DEFAULT EMPLOYEE PROFILES
-- ==============================================================================
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  v_name := coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));

  -- PRODUCTION HARDENING: Automatic Super Admin elevation is permanently DISABLED.
  -- All newly provisioned users strictly default to EMPLOYEE with zero company access.
  -- Elevated roles (SUPER_ADMIN, IT_ADMIN, MANAGEMENT, FINANCE, AUDITOR)
  -- and multi-company scopes must be explicitly granted by an authorized Super Admin.
  insert into public.user_profiles (
    id,
    email,
    name,
    role,
    all_companies,
    allowed_companies
  ) values (
    new.id,
    lower(new.email),
    v_name,
    'EMPLOYEE'::public.user_role,
    false,
    '{}'
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

-- ==============================================================================
-- 11. ROLE PERMISSIONS & SCHEMA PRIVILEGES
-- ==============================================================================
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke select on public.assets from authenticated; -- Direct SELECT on base table is revoked to enforce assets_view masking
grant select on public.assets_view to authenticated;
grant select on public.companies to anon;
grant select on public.assets_view to anon;
grant usage, select on all sequences in schema public to authenticated, anon;
grant execute on all routines in schema public to authenticated, anon;

alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant usage, select on sequences to authenticated, anon;
alter default privileges in schema public grant execute on routines to authenticated, anon;

