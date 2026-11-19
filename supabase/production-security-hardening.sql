-- ==============================================================================
-- IT Asset Management System - Production Security Hardening Script (Rev 4)
-- Architecture: Zero-Trust Deny-by-Default, Cross-Company Isolation,
-- Immutable Audit Trail, Database-Enforced Financial Protection, Least-Privilege
-- Target: Supabase PostgreSQL (Free Tier, $0/month)
-- ==============================================================================

begin;

-- ------------------------------------------------------------------------------
-- 0. SCHEMA PREREQUISITES & ACCOUNT ACTIVATION STATUS
-- ------------------------------------------------------------------------------
alter table public.user_profiles add column if not exists is_active boolean not null default true;
alter table public.companies add column if not exists is_active boolean not null default true;

-- ------------------------------------------------------------------------------
-- 1. HARDEN SECURITY DEFINER HELPER FUNCTIONS
-- Strict Deny-by-Default: No Implicit Roles, Explicit search_path = public, pg_temp
-- ------------------------------------------------------------------------------

-- 1.1 Resolve active user profile
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

-- 1.2 Resolve active user role (Returns NULL for unauthenticated, unprofiled, or deactivated users)
create or replace function public.get_current_role()
returns public.user_role
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select case 
    when auth.uid() is null then null
    else (select role from public.user_profiles where id = auth.uid() and is_active = true)
  end;
$$;

-- 1.3 Validate multi-company access (Strict: Returns FALSE for null auth.uid(), null company, or deactivated account)
create or replace function public.can_access_company(target_company_id text)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select case 
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

-- 1.4 Validate financial data view permissions (SUPER_ADMIN, MANAGEMENT, FINANCE)
create or replace function public.can_view_financials()
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select case 
    when auth.uid() is null then false
    else exists (
      select 1 from public.user_profiles
      where id = auth.uid()
        and is_active = true
        and role in ('SUPER_ADMIN', 'MANAGEMENT', 'FINANCE')
    )
  end;
$$;

-- 1.5 Validate financial data edit permissions (Strictly SUPER_ADMIN and FINANCE only; MANAGEMENT is read-only)
create or replace function public.can_edit_financials()
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select case 
    when auth.uid() is null then false
    else exists (
      select 1 from public.user_profiles
      where id = auth.uid()
        and is_active = true
        and role in ('SUPER_ADMIN', 'FINANCE')
    )
  end;
$$;

-- 1.6 Validate hardware asset management permissions (SUPER_ADMIN, IT_ADMIN)
create or replace function public.can_manage_assets()
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select case 
    when auth.uid() is null then false
    else exists (
      select 1 from public.user_profiles
      where id = auth.uid()
        and is_active = true
        and role in ('SUPER_ADMIN', 'IT_ADMIN')
    )
  end;
$$;

-- 1.7 Validate Stock Opname physical audit & reconciliation permissions (SUPER_ADMIN, IT_ADMIN, AUDITOR)
create or replace function public.can_reconcile_opname()
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select case 
    when auth.uid() is null then false
    else exists (
      select 1 from public.user_profiles
      where id = auth.uid()
        and is_active = true
        and role in ('SUPER_ADMIN', 'IT_ADMIN', 'AUDITOR')
    )
  end;
$$;

-- 1.8 Resolve current employee ID
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
-- 2. DATABASE-LEVEL FINANCIAL DATA PROTECTION TRIGGER
-- MANAGEMENT has read-only access. Direct modifications are stripped or preserved.
-- ------------------------------------------------------------------------------

create or replace function public.enforce_asset_financial_permissions()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- If user lacks financial edit permissions (including MANAGEMENT, IT_ADMIN, AUDITOR, EMPLOYEE)
  if not public.can_edit_financials() then
    if tg_op = 'INSERT' then
      new.purchase_cost := null;
      new.useful_life_months := null;
      new.depreciation_method := 'STRAIGHT_LINE'::public.depreciation_method;
      new.accumulated_depreciation := 0;
      new.net_book_value := null;
      new.depreciation_start_date := null;
    elsif tg_op = 'UPDATE' then
      new.purchase_cost := old.purchase_cost;
      new.useful_life_months := old.useful_life_months;
      new.depreciation_method := old.depreciation_method;
      new.accumulated_depreciation := old.accumulated_depreciation;
      new.net_book_value := old.net_book_value;
      new.depreciation_start_date := old.depreciation_start_date;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_asset_financials on public.assets;
create trigger trg_enforce_asset_financials
  before insert or update on public.assets
  for each row execute function public.enforce_asset_financial_permissions();

-- ------------------------------------------------------------------------------
-- 3. AUDIT TRAIL PROTECTION & AUTOMATED LIFECYCLE AUDITING
-- Protects asset_histories from direct API tampering, fabrication, or truncation
-- ------------------------------------------------------------------------------

-- 3.1 Automated Asset Lifecycle History Trigger
create or replace function public.log_asset_lifecycle_history()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_name text;
  v_action text;
  v_notes text;
begin
  select coalesce(name, email, 'System Operator') into v_caller_name
  from public.user_profiles
  where id = auth.uid();

  if tg_op = 'INSERT' then
    v_action := 'CREATE';
    v_notes := 'Asset registered by ' || coalesce(v_caller_name, 'Authorized User') || ' (' || new.asset_tag || ')';
    
    insert into public.asset_histories (id, asset_id, action, notes, changes, performed_by)
    values (
      'hst_' || floor(extract(epoch from now()))::text || '_' || substr(md5(random()::text), 1, 6),
      new.id,
      v_action,
      v_notes,
      jsonb_build_object('asset_tag', new.asset_tag, 'model', new.model, 'location', new.location),
      coalesce(v_caller_name, 'System')
    );
  elsif tg_op = 'UPDATE' then
    -- Log financial updates performed by authorized roles
    if (old.purchase_cost is distinct from new.purchase_cost or old.net_book_value is distinct from new.net_book_value)
       and public.can_edit_financials() then
      insert into public.asset_histories (id, asset_id, action, notes, changes, performed_by)
      values (
        'hst_' || floor(extract(epoch from now()))::text || '_' || substr(md5(random()::text), 1, 6),
        new.id,
        'FINANCIAL_UPDATE',
        'Financial valuation updated by ' || coalesce(v_caller_name, 'Finance Officer'),
        jsonb_build_object('old_cost', old.purchase_cost, 'new_cost', new.purchase_cost, 'old_nbv', old.net_book_value, 'new_nbv', new.net_book_value),
        coalesce(v_caller_name, 'System')
      );
    end if;

    -- Log specification and operational changes
    if old.status is distinct from new.status 
       or old.location is distinct from new.location 
       or old.physical_condition is distinct from new.physical_condition 
       or old.is_archived is distinct from new.is_archived
       or old.model is distinct from new.model
       or old.serial_number is distinct from new.serial_number then
      
      v_action := case when new.is_archived and not old.is_archived then 'ARCHIVE' else 'UPDATE' end;
      v_notes := 'Asset specifications updated by ' || coalesce(v_caller_name, 'Authorized User');
      
      insert into public.asset_histories (id, asset_id, action, notes, changes, performed_by)
      values (
        'hst_' || floor(extract(epoch from now()))::text || '_' || substr(md5(random()::text), 1, 6),
        new.id,
        v_action,
        v_notes,
        jsonb_build_object(
          'old_status', old.status, 'new_status', new.status,
          'old_location', old.location, 'new_location', new.location,
          'old_condition', old.physical_condition, 'new_condition', new.physical_condition
        ),
        coalesce(v_caller_name, 'System')
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_asset_history on public.assets;
create trigger trg_log_asset_history
  after insert or update on public.assets
  for each row execute function public.log_asset_lifecycle_history();

-- 3.2 Automated Photo Lifecycle History Trigger
create or replace function public.log_asset_photo_history()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_name text;
begin
  select coalesce(name, email, 'System Operator') into v_caller_name
  from public.user_profiles
  where id = auth.uid();

  if tg_op = 'INSERT' then
    insert into public.asset_histories (id, asset_id, action, notes, performed_by)
    values (
      'hst_' || floor(extract(epoch from now()))::text || '_' || substr(md5(random()::text), 1, 6),
      new.asset_id,
      'PHOTO_UPLOAD',
      'Photo uploaded (' || new.category::text || ') by ' || coalesce(v_caller_name, 'Authorized User'),
      coalesce(v_caller_name, 'System')
    );
  elsif tg_op = 'DELETE' then
    insert into public.asset_histories (id, asset_id, action, notes, performed_by)
    values (
      'hst_' || floor(extract(epoch from now()))::text || '_' || substr(md5(random()::text), 1, 6),
      old.asset_id,
      'PHOTO_DELETE',
      'Photo removed (' || old.category::text || ') by ' || coalesce(v_caller_name, 'Authorized User'),
      coalesce(v_caller_name, 'System')
    );
  end if;
  return null;
end;
$$;

drop trigger if exists trg_log_asset_photo_history on public.asset_photos;
create trigger trg_log_asset_photo_history
  after insert or delete on public.asset_photos
  for each row execute function public.log_asset_photo_history();

-- 3.3 Explicitly forbid direct application INSERT, UPDATE, DELETE into asset_histories
drop policy if exists "Histories insert allowed for system/authenticated" on public.asset_histories;
drop policy if exists "Histories insert is forbidden for application users" on public.asset_histories;
create policy "Histories insert is forbidden for application users"
  on public.asset_histories for insert
  to authenticated
  with check (false);

-- ------------------------------------------------------------------------------
-- 4. DIRECT WRITE BYPASS PROTECTION TRIGGER
-- Enforces that asset assignment, disposal, and status transitions MUST use RPCs
-- ------------------------------------------------------------------------------

create or replace function public.prevent_direct_asset_status_tampering()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_in_assignment text;
  v_in_opname text;
begin
  v_in_assignment := current_setting('app.in_assignment_rpc', true);
  v_in_opname := current_setting('app.in_stock_opname_rpc', true);

  -- If neither authorized RPC flag is active, block direct bypass
  if coalesce(v_in_assignment, 'false') != 'true' and coalesce(v_in_opname, 'false') != 'true' then
    -- Prevent direct employee assignment tampering
    if old.assigned_employee_id is distinct from new.assigned_employee_id then
      raise exception 'Forbidden: Asset assignment and transfer must be executed through public.perform_asset_assignment() RPC.';
    end if;
    -- Prevent direct status tampering to operational statuses
    if old.status is distinct from new.status and new.status in ('IN_USE', 'DISPOSED', 'MAINTENANCE') then
      raise exception 'Forbidden: Changing asset status to % must be executed through authorized RPC workflows.', new.status;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_direct_status_tampering on public.assets;
create trigger trg_prevent_direct_status_tampering
  before update on public.assets
  for each row execute function public.prevent_direct_asset_status_tampering();

-- ------------------------------------------------------------------------------
-- 5. HARDEN TRANSACTIONAL STORED PROCEDURES (CROSS-COMPANY ISOLATION & LOCKING)
-- ------------------------------------------------------------------------------

-- Drop previous overloaded signatures to ensure clean signature updates
drop function if exists public.perform_asset_assignment(text, public.assignment_action, text, public.physical_condition, text, text);
drop function if exists public.perform_asset_assignment(text, text, text, public.physical_condition, text, text);
drop function if exists public.perform_asset_assignment(text, text, text, text, text, text);

create or replace function public.perform_asset_assignment(
  p_asset_id text,
  p_action_type text,
  p_employee_id text default null,
  p_condition public.physical_condition default 'GOOD',
  p_handover_doc_ref text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_profile public.user_profiles%rowtype;
  v_caller_name text;
  v_asset public.assets%rowtype;
  v_employee public.employees%rowtype;
  v_new_status public.asset_status;
  v_new_employee_id text;
  v_assignment_id text;
  v_history_notes text;
  v_upper_action text;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized: Authentication required.';
  end if;

  select * into v_caller_profile from public.user_profiles
  where id = auth.uid() and is_active = true;

  if not found or v_caller_profile.role is null then
    raise exception 'Forbidden: Account is missing, deactivated, or lacks an assigned role.';
  end if;

  if v_caller_profile.role not in ('SUPER_ADMIN', 'IT_ADMIN') then
    raise exception 'Forbidden: You do not have permission to assign or transfer assets.';
  end if;

  v_caller_name := coalesce(v_caller_profile.name, v_caller_profile.email, 'Authorized IT Admin');
  v_upper_action := upper(trim(p_action_type));

  -- Authorize transaction for asset status updates
  perform set_config('app.in_assignment_rpc', 'true', true);

  -- Row-level locking to prevent race conditions during concurrent assignments
  select * into v_asset from public.assets
  where id = p_asset_id
  for no key update;

  if not found then
    raise exception 'Asset with ID % not found.', p_asset_id;
  end if;

  if not public.can_access_company(v_asset.company_id) then
    raise exception 'Forbidden: You do not have access to manage assets for this company entity.';
  end if;

  -- Close existing active assignments
  update public.asset_assignments
  set returned_at = now()
  where asset_id = p_asset_id and returned_at is null;

  if v_upper_action in ('ASSIGN', 'TRANSFER') then
    if p_employee_id is null then
      raise exception 'Target employee ID is required for % action.', v_upper_action;
    end if;

    -- Validate target employee existence and caller company permissions
    select * into v_employee from public.employees where id = p_employee_id;
    if not found or v_employee.status != 'ACTIVE' then
      raise exception 'Employee % not found or is inactive.', p_employee_id;
    end if;

    if not public.can_access_company(v_employee.company_id) then
      raise exception 'Forbidden: Target employee belongs to an unauthorized company entity.';
    end if;

    v_new_status := 'IN_USE';
    v_new_employee_id := p_employee_id;
    v_assignment_id := 'asg_' || floor(extract(epoch from now()))::text || '_' || substr(md5(random()::text), 1, 6);

    insert into public.asset_assignments (
      id, asset_id, employee_id, action_type, condition_at_action, assigned_at,
      performed_by, handover_doc_ref, notes
    ) values (
      v_assignment_id, p_asset_id, p_employee_id, v_upper_action::public.assignment_action, p_condition,
      now(), v_caller_name, p_handover_doc_ref, p_notes
    );

    v_history_notes := case 
      when v_upper_action = 'ASSIGN' then 'Assigned to ' || v_employee.name || ' by ' || v_caller_name
      else 'Transferred to ' || v_employee.name || ' by ' || v_caller_name
    end;

  elsif v_upper_action = 'RETURN' then
    v_new_status := 'AVAILABLE';
    v_new_employee_id := null;
    v_assignment_id := 'asg_' || floor(extract(epoch from now()))::text || '_' || substr(md5(random()::text), 1, 6);

    insert into public.asset_assignments (
      id, asset_id, employee_id, action_type, condition_at_action, assigned_at, returned_at,
      performed_by, handover_doc_ref, notes
    ) values (
      v_assignment_id, p_asset_id, v_asset.assigned_employee_id, 'RETURN'::public.assignment_action, p_condition,
      now(), now(), v_caller_name, p_handover_doc_ref, p_notes
    );

    v_history_notes := 'Returned to pool by ' || v_caller_name;

  elsif v_upper_action in ('REPAIR', 'REPLACEMENT') then
    v_new_status := 'MAINTENANCE';
    v_new_employee_id := null;
    v_history_notes := 'Sent to maintenance bench by ' || v_caller_name;

  elsif v_upper_action = 'DISPOSE' then
    -- Disposal is strictly restricted to SUPER_ADMIN
    if v_caller_profile.role != 'SUPER_ADMIN' then
      raise exception 'Forbidden: Asset disposal is strictly restricted to SUPER_ADMIN.';
    end if;
    v_new_status := 'DISPOSED';
    v_new_employee_id := null;
    v_history_notes := 'Decommissioned and marked for disposal by ' || v_caller_name;

  else
    raise exception 'Invalid action type: %', p_action_type;
  end if;

  if p_notes is not null and length(trim(p_notes)) > 0 then
    v_history_notes := v_history_notes || ' — ' || trim(p_notes);
  end if;

  update public.assets
  set
    status = v_new_status,
    physical_condition = coalesce(p_condition, physical_condition),
    assigned_employee_id = v_new_employee_id,
    updated_at = now()
  where id = p_asset_id;

  insert into public.asset_histories (
    id, asset_id, action, notes, performed_by
  ) values (
    'hst_' || floor(extract(epoch from now()))::text || '_' || substr(md5(random()::text), 1, 6),
    p_asset_id,
    v_upper_action,
    v_history_notes,
    v_caller_name
  );

  return jsonb_build_object(
    'success', true,
    'asset_id', p_asset_id,
    'new_status', v_new_status,
    'assigned_employee_id', v_new_employee_id
  );
end;
$$;

-- 5.2 Stock Opname Session Creation with Strict Company Scope Validation & Serialization
drop function if exists public.create_stock_opname_session(text, text, text, text, text);

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
set search_path = public, pg_temp
as $$
declare
  v_session_id text;
  v_session_number text;
  v_next_seq integer;
  v_year text;
  v_item_count integer := 0;
  v_caller_profile public.user_profiles%rowtype;
  v_caller_name text;
  v_target_company_id text;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized: Authentication required.';
  end if;

  select * into v_caller_profile from public.user_profiles
  where id = auth.uid() and is_active = true;

  if not found or v_caller_profile.role is null then
    raise exception 'Forbidden: Account is missing, deactivated, or lacks an assigned role.';
  end if;

  if not public.can_reconcile_opname() then
    raise exception 'Forbidden: You do not have permission to initiate stock opname audits.';
  end if;

  v_caller_name := coalesce(v_caller_profile.name, v_caller_profile.email, 'IT Auditor');
  v_target_company_id := nullif(trim(p_company_id), '');

  -- Transaction locking: serialize session creation sequence generation
  perform pg_advisory_xact_lock(hashtext('stock_opname_session_creation'));

  -- Enforce ALL-company creation permissions
  if v_target_company_id is null or v_target_company_id = 'ALL' then
    if not (v_caller_profile.role = 'SUPER_ADMIN' or v_caller_profile.all_companies = true) then
      raise exception 'Forbidden: Company-scoped auditors cannot create ALL-company audit sessions. Please select your specific company entity.';
    end if;
    v_target_company_id := null;
  else
    if not public.can_access_company(v_target_company_id) then
      raise exception 'Forbidden: You do not have access to initiate audits for company ID %.', v_target_company_id;
    end if;
  end if;

  v_year := to_char(now(), 'YYYY');

  select count(*) + 1 into v_next_seq from public.stock_opname_sessions
  where to_char(created_at, 'YYYY') = v_year;

  v_session_number := 'OPN-' || v_year || '-' || lpad(v_next_seq::text, 3, '0');

  insert into public.stock_opname_sessions (
    session_number, title, company_id, location_scope, category_scope,
    status, start_date, conducted_by, notes
  ) values (
    v_session_number, p_title, v_target_company_id,
    p_location_scope, p_category_scope,
    'IN_PROGRESS', now(), v_caller_name, p_notes
  ) returning id into v_session_id;

  -- Capture immutable expected snapshot obeying company and category scopes
  insert into public.stock_opname_items (
    id, session_id, asset_id, expected_location, expected_employee_id,
    expected_condition, verification_status
  )
  select
    'itm_' || floor(extract(epoch from now()))::text || '_' || substr(md5(random()::text), 1, 6) || '_' || row_number() over (),
    v_session_id,
    a.id,
    a.location,
    a.assigned_employee_id,
    a.physical_condition,
    'PENDING'::public.verification_status
  from public.assets a
  where a.is_archived = false
    and (v_target_company_id is null or a.company_id = v_target_company_id)
    and (p_location_scope = 'ALL' or a.location = p_location_scope)
    and (p_category_scope = 'ALL' or a.category::text = p_category_scope);

  get diagnostics v_item_count = row_count;

  return jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'session_number', v_session_number,
    'expected_assets_count', v_item_count
  );
end;
$$;

-- 5.3 Stock Opname Scan Recording with Ambiguity Detection & Concurrency Locking
drop function if exists public.record_stock_opname_scan(text, text, text, public.physical_condition, text, text);
drop function if exists public.record_stock_opname_scan(text, text, text, public.physical_condition, text, text, timestamptz);

create or replace function public.record_stock_opname_scan(
  p_session_id text,
  p_asset_id text,
  p_location text default null,
  p_condition public.physical_condition default null,
  p_employee_id text default null,
  p_notes text default null,
  p_scanned_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_profile public.user_profiles%rowtype;
  v_session public.stock_opname_sessions%rowtype;
  v_asset public.assets%rowtype;
  v_item public.stock_opname_items%rowtype;
  v_caller_name text;
  v_match_count integer;
  v_matched_id text;
  v_status public.verification_status;
  v_is_unexpected boolean := false;
  v_location_mismatch boolean := false;
  v_condition_changed boolean := false;
  v_user_mismatch boolean := false;
  v_notes_accum text := '';
  v_scan_time timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized: Authentication required.';
  end if;

  select * into v_caller_profile from public.user_profiles
  where id = auth.uid() and is_active = true;

  if not found or v_caller_profile.role is null then
    raise exception 'Forbidden: Account is missing, deactivated, or lacks an assigned role.';
  end if;

  if not public.can_reconcile_opname() then
    raise exception 'Forbidden: You do not have permission to record audit scans.';
  end if;

  v_caller_name := coalesce(v_caller_profile.name, v_caller_profile.email, 'IT Auditor');
  v_scan_time := coalesce(p_scanned_at, now());

  -- Concurrency control: share lock on session
  select * into v_session from public.stock_opname_sessions
  where id = p_session_id
  for share;

  if not found or v_session.status != 'IN_PROGRESS' then
    raise exception 'Stock Opname session is not active.';
  end if;

  if v_session.company_id is not null and not public.can_access_company(v_session.company_id) then
    raise exception 'Forbidden: You do not have access to this session company scope.';
  end if;

  -- Exact identifier match & ambiguity rejection (No arbitrary LIMIT 1)
  select count(*), max(id) into v_match_count, v_matched_id
  from public.assets
  where is_archived = false
    and (
      id = p_asset_id
      or asset_tag = p_asset_id
      or qr_code_token = p_asset_id
      or (serial_number is not null and length(trim(serial_number)) > 0 and serial_number = p_asset_id)
    );

  if v_match_count = 0 then
    return jsonb_build_object(
      'success', false,
      'error', 'Asset not found matching barcode, QR code, tag, or serial: ' || p_asset_id
    );
  elsif v_match_count > 1 then
    raise exception 'Ambiguous identifier "%" matched % active assets. Please scan unique QR code token or specify exact Asset ID.', p_asset_id, v_match_count;
  end if;

  select * into v_asset from public.assets where id = v_matched_id;

  -- Enforce Cross-Company Isolation
  if not public.can_access_company(v_asset.company_id) then
    raise exception 'Forbidden: You do not have permission to audit assets belonging to this company entity.';
  end if;

  -- Enforce Session Scope Isolation
  if v_session.company_id is not null and v_asset.company_id != v_session.company_id then
    raise exception 'Forbidden: Scanned asset belongs to another company entity (cross-company audit mismatch).';
  end if;

  -- Concurrency lock: lock item if it exists
  select * into v_item from public.stock_opname_items
  where session_id = p_session_id and asset_id = v_asset.id
  for update;

  if found and v_item.scanned_at is not null then
    return jsonb_build_object(
      'success', false,
      'duplicate', true,
      'error', 'Asset ' || v_asset.asset_tag || ' has already been scanned in this session.',
      'item', row_to_json(v_item)
    );
  end if;

  if p_location is not null and v_asset.location is not null and p_location != v_asset.location then
    v_location_mismatch := true;
    v_notes_accum := v_notes_accum || 'Location mismatch (Expected: ' || v_asset.location || ', Found: ' || p_location || '). ';
  end if;

  if p_condition is not null and p_condition != v_asset.physical_condition then
    v_condition_changed := true;
    v_notes_accum := v_notes_accum || 'Condition updated to ' || p_condition::text || '. ';
  end if;

  if p_employee_id is not null and v_asset.assigned_employee_id is distinct from p_employee_id then
    v_user_mismatch := true;
    v_notes_accum := v_notes_accum || 'User assignment discrepancy detected. ';
  end if;

  if p_notes is not null and length(trim(p_notes)) > 0 then
    v_notes_accum := v_notes_accum || trim(p_notes);
  end if;

  if not found then
    v_is_unexpected := true;
    v_status := 'UNREGISTERED'::public.verification_status;
    v_notes_accum := 'Unexpected asset scanned outside initial session scope. ' || v_notes_accum;

    insert into public.stock_opname_items (
      id, session_id, asset_id, expected_location, expected_employee_id,
      expected_condition, actual_location, actual_condition, actual_employee_id,
      scanned_at, scanned_by, verification_status, is_unexpected, scan_count, discrepancy_notes
    ) values (
      'itm_' || floor(extract(epoch from now()))::text || '_' || substr(md5(random()::text), 1, 6),
      p_session_id, v_asset.id, v_asset.location, v_asset.assigned_employee_id,
      v_asset.physical_condition, coalesce(p_location, v_asset.location),
      coalesce(p_condition, v_asset.physical_condition), p_employee_id,
      v_scan_time, v_caller_name, v_status, true, 1, trim(v_notes_accum)
    );
  else
    if v_user_mismatch then
      v_status := 'MISMATCH_USER'::public.verification_status;
    elsif v_location_mismatch then
      v_status := 'MISMATCH_LOCATION'::public.verification_status;
    else
      v_status := 'VERIFIED'::public.verification_status;
    end if;

    update public.stock_opname_items
    set
      actual_location = coalesce(p_location, expected_location),
      actual_condition = coalesce(p_condition, v_asset.physical_condition),
      actual_employee_id = coalesce(p_employee_id, expected_employee_id),
      scanned_at = v_scan_time,
      scanned_by = v_caller_name,
      verification_status = v_status,
      scan_count = coalesce(scan_count, 0) + 1,
      discrepancy_notes = trim(v_notes_accum)
    where id = v_item.id;
  end if;

  return jsonb_build_object(
    'success', true,
    'asset_tag', v_asset.asset_tag,
    'status', v_status::text,
    'location_mismatch', v_location_mismatch,
    'condition_changed', v_condition_changed,
    'user_mismatch', v_user_mismatch
  );
end;
$$;

-- 5.4 Stock Opname Reconciliation with Exclusive Locking & Cross-Company Verification
drop function if exists public.reconcile_stock_opname(text, text);

create or replace function public.reconcile_stock_opname(
  p_session_id text,
  p_reconciliation_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_profile public.user_profiles%rowtype;
  v_session public.stock_opname_sessions%rowtype;
  v_caller_name text;
  v_asset_company_id text;
  v_updated_assets integer := 0;
  v_missing_assets integer := 0;
  v_rec record;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized: Authentication required.';
  end if;

  select * into v_caller_profile from public.user_profiles
  where id = auth.uid() and is_active = true;

  if not found or v_caller_profile.role is null then
    raise exception 'Forbidden: Account is missing, deactivated, or lacks an assigned role.';
  end if;

  if not public.can_reconcile_opname() then
    raise exception 'Forbidden: Only authorized administrators or auditors can reconcile stock opname audits.';
  end if;

  v_caller_name := coalesce(v_caller_profile.name, v_caller_profile.email, 'IT Auditor');

  -- Authorize transaction for asset status updates during reconciliation
  perform set_config('app.in_stock_opname_rpc', 'true', true);

  -- Concurrency control: exclusive lock on the session
  select * into v_session from public.stock_opname_sessions
  where id = p_session_id
  for update;

  if not found or v_session.status != 'IN_PROGRESS' then
    raise exception 'Session cannot be reconciled in its current status (session may already be reconciled).';
  end if;

  -- Reconciling an ALL-company session requires enterprise-wide authority
  if v_session.company_id is null and not (v_caller_profile.role = 'SUPER_ADMIN' or v_caller_profile.all_companies = true) then
    raise exception 'Forbidden: Reconciling an ALL-company session requires enterprise-wide authorization.';
  end if;

  if v_session.company_id is not null and not public.can_access_company(v_session.company_id) then
    raise exception 'Forbidden: You do not have access to reconcile audits for this company entity.';
  end if;

  for v_rec in (
    select * from public.stock_opname_items
    where session_id = p_session_id
      and verification_status in ('VERIFIED', 'MISMATCH_LOCATION', 'MISMATCH_USER', 'UNREGISTERED')
      and scanned_at is not null
  ) loop
    select company_id into v_asset_company_id from public.assets where id = v_rec.asset_id;
    if not public.can_access_company(v_asset_company_id) then
      raise exception 'Forbidden: You do not have permission to reconcile assets belonging to unauthorized company entity.';
    end if;

    update public.assets
    set
      location = coalesce(v_rec.actual_location, location),
      physical_condition = coalesce(v_rec.actual_condition, physical_condition),
      updated_at = now()
    where id = v_rec.asset_id;

    insert into public.asset_histories (
      id, asset_id, action, notes, performed_by
    ) values (
      'hst_' || floor(extract(epoch from now()))::text || '_' || substr(md5(random()::text), 1, 6),
      v_rec.asset_id,
      'AUDIT',
      'Reconciled via Stock Opname session ' || v_session.session_number || ' by ' || v_caller_name,
      v_caller_name
    );

    update public.stock_opname_items
    set reconciled = true
    where id = v_rec.id;

    v_updated_assets := v_updated_assets + 1;
  end loop;

  -- Mark all unverified items as MISSING
  update public.stock_opname_items
  set
    verification_status = 'MISSING'::public.verification_status,
    discrepancy_notes = coalesce(discrepancy_notes, 'Unscanned at session reconciliation close'),
    reconciled = true
  where session_id = p_session_id and verification_status = 'PENDING';

  get diagnostics v_missing_assets = row_count;

  update public.stock_opname_sessions
  set
    status = 'COMPLETED'::public.opname_status,
    end_date = now(),
    reconciled_at = now(),
    reconciled_by = v_caller_name,
    notes = case 
      when p_reconciliation_notes is not null then coalesce(notes, '') || ' | ' || p_reconciliation_notes
      else notes
    end
  where id = p_session_id;

  return jsonb_build_object(
    'success', true,
    'session_id', p_session_id,
    'updated_assets_count', v_updated_assets,
    'missing_assets_count', v_missing_assets
  );
end;
$$;

-- ------------------------------------------------------------------------------
-- 6. SECURE DATABASE ASSETS VIEW
-- Deny-by-default, Multi-Company Isolation, Dynamic Column Financial Masking
-- ------------------------------------------------------------------------------

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
  -- Dynamic Financial Masking at the Database Level
  case when public.can_view_financials() then a.purchase_cost else null end as purchase_cost,
  case when public.can_view_financials() then a.useful_life_months else null end as useful_life_months,
  case when public.can_view_financials() then a.depreciation_method else null end as depreciation_method,
  case when public.can_view_financials() then a.accumulated_depreciation else null end as accumulated_depreciation,
  case when public.can_view_financials() then a.net_book_value else null end as net_book_value,
  case when public.can_view_financials() then a.depreciation_start_date else null end as depreciation_start_date
from public.assets a
where auth.uid() is not null
  and public.can_access_company(a.company_id)
  and (
    public.get_current_role() != 'EMPLOYEE'
    or a.assigned_employee_id = public.get_current_employee_id()
  );

-- ------------------------------------------------------------------------------
-- 7. REVISE RLS POLICIES FOR OPERATIONAL SECURITY
-- ------------------------------------------------------------------------------

-- 7.1 Stock Opname Sessions RLS
drop policy if exists "Opname sessions selectable by company members" on public.stock_opname_sessions;
drop policy if exists "Opname sessions selectable by authorized users" on public.stock_opname_sessions;
create policy "Opname sessions selectable by authorized users"
  on public.stock_opname_sessions for select
  to authenticated
  using (
    case 
      when company_id is null then (
        public.get_current_role() in ('SUPER_ADMIN', 'MANAGEMENT')
        or exists (select 1 from public.user_profiles where id = auth.uid() and is_active = true and all_companies = true)
      )
      else public.can_access_company(company_id)
    end
  );

-- 7.2 Stock Opname Items RLS
drop policy if exists "Opname items selectable by company members" on public.stock_opname_items;
drop policy if exists "Opname items selectable by authorized users" on public.stock_opname_items;
create policy "Opname items selectable by authorized users"
  on public.stock_opname_items for select
  to authenticated
  using (
    exists (
      select 1 from public.stock_opname_sessions s
      where s.id = session_id
        and (
          case 
            when s.company_id is null then (
              public.get_current_role() in ('SUPER_ADMIN', 'MANAGEMENT')
              or exists (select 1 from public.user_profiles where id = auth.uid() and is_active = true and all_companies = true)
              or exists (select 1 from public.assets a where a.id = asset_id and public.can_access_company(a.company_id))
            )
            else public.can_access_company(s.company_id)
          end
        )
    )
  );

-- 7.3 Asset Histories RLS
drop policy if exists "Histories selectable by company members" on public.asset_histories;
create policy "Histories selectable by company members"
  on public.asset_histories for select
  to authenticated
  using (
    exists (
      select 1 from public.assets a
      where a.id = asset_id and public.can_access_company(a.company_id)
    )
  );

-- ------------------------------------------------------------------------------
-- 8. STRICT LEAST-PRIVILEGE GRANTS & REVOCATIONS
-- Explicit Function-Level Grants, No Blanket Routine Access, Protected Financial Columns
-- ------------------------------------------------------------------------------

-- 8.1 Revoke all excessive privileges from PUBLIC and anon
revoke all on all tables in schema public from public, anon;
revoke all on all routines in schema public from public, anon;
revoke all on all sequences in schema public from public, anon;

-- Anon least privilege: only read company abbreviations and names for login UI
grant usage on schema public to anon;
grant select on public.companies to anon;

-- 8.2 Authenticated least privilege
revoke all on all tables in schema public from authenticated;
revoke all on all routines in schema public from authenticated;
revoke all on all sequences in schema public from authenticated;

grant usage on schema public to authenticated;

-- Master data tables (governed strictly by RLS policies)
grant select, insert, update on public.companies to authenticated;
grant select, insert, update, delete on public.employees to authenticated;
grant select, update on public.user_profiles to authenticated;

-- Assets table: Financial columns strictly revoked from SELECT to prevent API bypassing.
-- Only non-financial columns are granted for joins and metadata.
revoke all on public.assets from authenticated, anon, public;
grant insert, update on public.assets to authenticated;
grant select (
  id,
  asset_tag,
  is_duplicate_tag,
  asset_name,
  company_id,
  category,
  model,
  cpu,
  ram,
  serial_number,
  mac_address,
  status,
  physical_condition,
  assigned_employee_id,
  location,
  purchase_date,
  laptop_code,
  laptop_account,
  username,
  notes,
  qr_code_token,
  is_archived,
  created_at,
  updated_at
) on public.assets to authenticated;

-- Assets view: Enforced entry point for reading asset details with dynamic financial masking
grant select on public.assets_view to authenticated;

-- Operational tables (writes strictly governed through RPC stored procedures)
revoke insert, update, delete, truncate on public.asset_assignments from authenticated, anon, public;
grant select on public.asset_assignments to authenticated;

revoke insert, update, delete, truncate on public.stock_opname_sessions from authenticated, anon, public;
grant select on public.stock_opname_sessions to authenticated;

revoke insert, update, delete, truncate on public.stock_opname_items from authenticated, anon, public;
grant select on public.stock_opname_items to authenticated;

-- Asset Photos: direct table access governed by RLS
grant select, insert, update, delete on public.asset_photos to authenticated;

-- Asset Histories: Read-only for authenticated, direct INSERT/UPDATE/DELETE/TRUNCATE strictly revoked
revoke insert, update, delete, truncate on public.asset_histories from authenticated, anon, public;
grant select on public.asset_histories to authenticated;

-- Sequence usage
grant usage, select on all sequences in schema public to authenticated;

-- Explicit function-level EXECUTE grants (Strict Least Privilege, No blanket routines)
grant execute on function public.get_current_profile() to authenticated;
grant execute on function public.get_current_role() to authenticated;
grant execute on function public.can_access_company(text) to authenticated;
grant execute on function public.can_view_financials() to authenticated;
grant execute on function public.can_edit_financials() to authenticated;
grant execute on function public.can_manage_assets() to authenticated;
grant execute on function public.can_reconcile_opname() to authenticated;
grant execute on function public.get_current_employee_id() to authenticated;
grant execute on function public.perform_asset_assignment(text, text, text, public.physical_condition, text, text) to authenticated;
grant execute on function public.create_stock_opname_session(text, text, text, text, text) to authenticated;
grant execute on function public.record_stock_opname_scan(text, text, text, public.physical_condition, text, text, timestamptz) to authenticated;
grant execute on function public.reconcile_stock_opname(text, text) to authenticated;

-- 8.3 Secure Default Privileges for Future Objects
alter default privileges in schema public revoke all on tables from public, anon;
alter default privileges in schema public revoke all on routines from public, anon;
alter default privileges in schema public revoke all on sequences from public, anon;
alter default privileges in schema public revoke all on routines from authenticated;

-- ------------------------------------------------------------------------------
-- 9. SECURE AUTH NEW-USER TRIGGER (PERMANENTLY DISABLE AUTO-ELEVATION)
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

commit;
