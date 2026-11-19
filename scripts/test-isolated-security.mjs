import { execSync } from 'child_process';

console.log('=================================================================');
console.log('   ISOLATED SECURITY & FUNCTIONAL TEST SUITE (LOCAL POSTGRES)   ');
console.log('   Testing All 13 Requirements, 6 Roles, 4 Companies, DB Triggers');
console.log('=================================================================\n');

function runPsql(sql) {
  return execSync('/opt/homebrew/bin/psql -h localhost -d itams_test -v ON_ERROR_STOP=1 -q -t -A', {
    input: sql,
    encoding: 'utf-8',
  }).trim();
}

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    failed++;
  }
}

function assertThrows(fn, expectedMsgPart, testName) {
  try {
    fn();
    console.error(`  ✗ FAIL: ${testName} (Expected exception but succeeded)`);
    failed++;
  } catch (err) {
    const errText = ((err.stderr ? err.stderr.toString() : '') + ' ' + (err.stdout ? err.stdout.toString() : '') + ' ' + (err.message || '')).toLowerCase();
    if (errText.includes(expectedMsgPart.toLowerCase())) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName}`);
      console.error(`    Expected error containing: "${expectedMsgPart}"`);
      console.error(`    Actual error: "${errText}"`);
      failed++;
    }
  }
}

async function main() {
  console.log('--- 1. Setting Up Test Master Entities & Test Personas ---');

  // Insert mock users into auth.users and user_profiles
  runPsql(`
    -- Clean previous test users
    delete from public.user_profiles where email like '%@test-corp.com';
    delete from auth.users where email like '%@test-corp.com';

    -- 1. Super Admin
    insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000001', 'superadmin@test-corp.com')
    on conflict (id) do nothing;
    insert into public.user_profiles (id, email, name, role, all_companies, allowed_companies, is_active)
    values ('00000000-0000-0000-0000-000000000001', 'superadmin@test-corp.com', 'Super Admin', 'SUPER_ADMIN', true, '{}', true)
    on conflict (id) do update set role = excluded.role, all_companies = excluded.all_companies, allowed_companies = excluded.allowed_companies, is_active = excluded.is_active;

    -- 2. Management
    insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000002', 'management@test-corp.com')
    on conflict (id) do nothing;
    insert into public.user_profiles (id, email, name, role, all_companies, allowed_companies, is_active)
    values ('00000000-0000-0000-0000-000000000002', 'management@test-corp.com', 'Executive Director', 'MANAGEMENT', true, '{}', true)
    on conflict (id) do update set role = excluded.role, all_companies = excluded.all_companies, allowed_companies = excluded.allowed_companies, is_active = excluded.is_active;

    -- 3. IT Admin (GMD only)
    insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000003', 'itadmin@test-corp.com')
    on conflict (id) do nothing;
    insert into public.user_profiles (id, email, name, role, all_companies, allowed_companies, is_active)
    values ('00000000-0000-0000-0000-000000000003', 'itadmin@test-corp.com', 'IT Admin GMD', 'IT_ADMIN', false, '{GMD}', true)
    on conflict (id) do update set role = excluded.role, all_companies = excluded.all_companies, allowed_companies = excluded.allowed_companies, is_active = excluded.is_active;

    -- 4. Finance
    insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000004', 'finance@test-corp.com')
    on conflict (id) do nothing;
    insert into public.user_profiles (id, email, name, role, all_companies, allowed_companies, is_active)
    values ('00000000-0000-0000-0000-000000000004', 'finance@test-corp.com', 'Finance Officer', 'FINANCE', true, '{}', true)
    on conflict (id) do update set role = excluded.role, all_companies = excluded.all_companies, allowed_companies = excluded.allowed_companies, is_active = excluded.is_active;

    -- 5. Auditor (GMC only)
    insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000005', 'auditor@test-corp.com')
    on conflict (id) do nothing;
    insert into public.user_profiles (id, email, name, role, all_companies, allowed_companies, is_active)
    values ('00000000-0000-0000-0000-000000000005', 'auditor@test-corp.com', 'Auditor GMC', 'AUDITOR', false, '{GMC}', true)
    on conflict (id) do update set role = excluded.role, all_companies = excluded.all_companies, allowed_companies = excluded.allowed_companies, is_active = excluded.is_active;

    -- 6. Employee (TEL only)
    insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000006', 'employee@test-corp.com')
    on conflict (id) do nothing;
    insert into public.user_profiles (id, email, name, role, all_companies, allowed_companies, is_active)
    values ('00000000-0000-0000-0000-000000000006', 'employee@test-corp.com', 'Standard Employee', 'EMPLOYEE', false, '{TEL}', true)
    on conflict (id) do update set role = excluded.role, all_companies = excluded.all_companies, allowed_companies = excluded.allowed_companies, is_active = excluded.is_active;

    -- 7. Deactivated IT Admin
    insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000007', 'deactivated@test-corp.com')
    on conflict (id) do nothing;
    insert into public.user_profiles (id, email, name, role, all_companies, allowed_companies, is_active)
    values ('00000000-0000-0000-0000-000000000007', 'deactivated@test-corp.com', 'Former Staff', 'IT_ADMIN', true, '{}', false)
    on conflict (id) do update set role = excluded.role, all_companies = excluded.all_companies, allowed_companies = excluded.allowed_companies, is_active = excluded.is_active;

    -- Clean test employees and assets
    delete from public.asset_histories where notes like '%Test%';
    delete from public.stock_opname_items where notes like '%Test%';
    delete from public.stock_opname_sessions where title like '%Test%';
    delete from public.asset_assignments where notes like '%Test%';
    delete from public.assets where asset_tag like 'TEST-%';
    delete from public.employees where email like '%@test-corp.com';

    -- Test Employees
    insert into public.employees (id, employee_id, name, email, department, company_id, status) values
      ('emp-gmd-01', 'EMP-GMD-001', 'Budi Santoso', 'budi@test-corp.com', 'Engineering', 'comp-gmd-001', 'ACTIVE'),
      ('emp-gmc-02', 'EMP-GMC-002', 'Citra Dewi', 'citra@test-corp.com', 'Operations', 'comp-gmc-002', 'ACTIVE'),
      ('emp-tel-03', 'EMP-TEL-003', 'Doni Pratama', 'doni@test-corp.com', 'Logistics', 'comp-tel-003', 'ACTIVE');

    -- Link employee 6
    update public.user_profiles set employee_id = 'emp-tel-03' where id = '00000000-0000-0000-0000-000000000006';

    -- Test Assets
    insert into public.assets (
      id, asset_tag, asset_name, company_id, category, model, cpu, ram,
      status, physical_condition, location, purchase_cost, net_book_value,
      useful_life_months, qr_code_token, serial_number, assigned_employee_id
    ) values
      ('ast-gmd-01', 'TEST-GMD-01', 'ThinkPad GMD 1', 'comp-gmd-001', 'LAPTOP', 'T14s', 'i7', '16GB', 'AVAILABLE', 'GOOD', 'JKT-HQ', 20000000, 15000000, 36, 'QR-TEST-GMD-01', 'SN-GMD-001', null),
      ('ast-gmc-02', 'TEST-GMC-02', 'MacBook GMC 2', 'comp-gmc-002', 'LAPTOP', 'M3 Pro', 'M3', '18GB', 'AVAILABLE', 'EXCELLENT', 'SBY-Office', 30000000, 25000000, 36, 'QR-TEST-GMC-02', 'SN-GMC-002', null),
      ('ast-tel-03', 'TEST-TEL-03', 'Dell Latitude TEL 3', 'comp-tel-003', 'LAPTOP', '5420', 'i5', '16GB', 'IN_USE', 'GOOD', 'BDG-Hub', 15000000, 10000000, 36, 'QR-TEST-TEL-03', 'SN-TEL-003', 'emp-tel-03'),
      ('ast-rci-04', 'TEST-RCI-04', 'HP EliteBook RCI 4', 'comp-rci-004', 'LAPTOP', '840 G9', 'i7', '32GB', 'AVAILABLE', 'GOOD', 'MDN-Branch', 22000000, 18000000, 36, 'QR-TEST-RCI-04', 'SN-RCI-004', null);
  `);
  assert(true, 'Test master companies, personas, employees, and assets initialized');

  // ----------------------------------------------------------------------------
  console.log('\n--- 2. Testing Requirement 1 & 2: Financial Protection & Role Separation ---');

  // Test 2.1: can_view_financials() and can_edit_financials() distinction
  const mgmtCanView = runPsql(`set role authenticated; set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002'; select public.can_view_financials();`);
  assert(mgmtCanView === 't', 'MANAGEMENT can view financials (can_view_financials = true)');

  const mgmtCanEdit = runPsql(`set role authenticated; set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002'; select public.can_edit_financials();`);
  assert(mgmtCanEdit === 'f', 'MANAGEMENT has READ-ONLY financial access (can_edit_financials = false)');

  const finCanEdit = runPsql(`set role authenticated; set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004'; select public.can_edit_financials();`);
  assert(finCanEdit === 't', 'FINANCE has financial edit permissions (can_edit_financials = true)');

  const itCanView = runPsql(`set role authenticated; set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000003'; select public.can_view_financials();`);
  assert(itCanView === 'f', 'IT_ADMIN has financial view permissions denied (can_view_financials = false)');

  // Test 2.2: Database Trigger Enforcing Financial Permissions on Direct Writes
  // As IT_ADMIN, attempt to insert asset with financial cost:
  runPsql(`
    set role authenticated;
    set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000003';
    insert into public.assets (
      id, asset_tag, asset_name, company_id, category, model, cpu, ram,
      status, physical_condition, location, purchase_cost, net_book_value
    ) values (
      'ast-test-unauth-fin', 'TEST-UNAUTH-01', 'Hacked Laptop', 'comp-gmd-001', 'LAPTOP', 'X1', 'i7', '16GB',
      'AVAILABLE', 'GOOD', 'JKT-HQ', 99999999, 99999999
    );
  `);
  const insertedCost = runPsql(`select purchase_cost from public.assets where id = 'ast-test-unauth-fin';`);
  assert(insertedCost === '', 'Direct INSERT of financial metrics by IT_ADMIN was stripped to NULL by trigger');

  // As MANAGEMENT, attempt to UPDATE financial cost directly:
  runPsql(`
    set role authenticated;
    set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';
    update public.assets set purchase_cost = 77777777 where id = 'ast-gmd-01';
  `);
  const mgmtCostAfter = runPsql(`select purchase_cost from public.assets where id = 'ast-gmd-01';`);
  assert(mgmtCostAfter === '20000000.00', 'Direct UPDATE of purchase_cost by MANAGEMENT was rejected/preserved by trigger');

  // As FINANCE, UPDATE financial cost directly (authorized):
  runPsql(`
    set role authenticated;
    set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';
    update public.assets set purchase_cost = 25000000, net_book_value = 20000000 where id = 'ast-gmd-01';
  `);
  const finCostAfter = runPsql(`select purchase_cost from public.assets where id = 'ast-gmd-01';`);
  assert(finCostAfter === '25000000.00', 'Direct UPDATE of purchase_cost by FINANCE succeeded');

  // Test 2.3: Direct API Column Privileges on public.assets
  assertThrows(() => {
    runPsql(`set role authenticated; set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000003'; select purchase_cost from public.assets;`);
  }, 'permission denied', 'Direct SELECT on purchase_cost from public.assets is rejected by PostgreSQL column permissions');

  assertThrows(() => {
    runPsql(`set role authenticated; set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000003'; select * from public.assets;`);
  }, 'permission denied', 'Direct SELECT * from public.assets is rejected due to revoked financial columns');

  const allowedColsSelect = runPsql(`set role authenticated; set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000003'; select asset_tag from public.assets where id = 'ast-gmd-01';`);
  assert(allowedColsSelect === 'TEST-GMD-01', 'Direct SELECT on non-financial columns (asset_tag) from public.assets is permitted');

  // Test 2.4: Dynamic Financial Masking via assets_view
  const viewMgmtCost = runPsql(`set role authenticated; set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002'; select purchase_cost from public.assets_view where id = 'ast-gmd-01';`);
  assert(viewMgmtCost === '25000000.00', 'assets_view returns unmasked purchase_cost for MANAGEMENT');

  const viewItCost = runPsql(`set role authenticated; set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000003'; select purchase_cost from public.assets_view where id = 'ast-gmd-01';`);
  assert(viewItCost === '', 'assets_view masks purchase_cost to NULL for IT_ADMIN');

  const viewAuditorCost = runPsql(`set role authenticated; set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000005'; select purchase_cost from public.assets_view where id = 'ast-gmc-02';`);
  assert(viewAuditorCost === '', 'assets_view masks purchase_cost to NULL for AUDITOR');

  // Test 2.5: Deactivated Account Rejection
  const deactRole = runPsql(`set role authenticated; set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000007'; select public.get_current_role();`);
  assert(deactRole === '', 'get_current_role() returns NULL for deactivated account (is_active = false)');

  const deactAccess = runPsql(`set role authenticated; set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000007'; select public.can_access_company('comp-gmd-001');`);
  assert(deactAccess === 'f', 'can_access_company() returns FALSE for deactivated account');

  // ----------------------------------------------------------------------------
  console.log('\n--- 3. Testing Requirement 4: Direct Write Bypass Protection ---');

  // Direct table update on assets changing assigned_employee_id
  assertThrows(() => {
    runPsql(`
      set role authenticated;
      set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000003';
      update public.assets set assigned_employee_id = 'emp-gmd-01' where id = 'ast-gmd-01';
    `);
  }, 'Forbidden: Asset assignment and transfer must be executed through public.perform_asset_assignment() RPC', 'Direct UPDATE on assigned_employee_id on public.assets is blocked by trigger');

  // Direct table update on assets changing status to DISPOSED
  assertThrows(() => {
    runPsql(`
      set role authenticated;
      set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000003';
      update public.assets set status = 'DISPOSED' where id = 'ast-gmd-01';
    `);
  }, 'Forbidden: Changing asset status to DISPOSED must be executed through authorized RPC workflows', 'Direct UPDATE on status = DISPOSED on public.assets is blocked by trigger');

  // Direct table writes on asset_assignments revoked
  assertThrows(() => {
    runPsql(`
      set role authenticated;
      set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000003';
      insert into public.asset_assignments (id, asset_id, action_type) values ('asg-fake', 'ast-gmd-01', 'ASSIGN');
    `);
  }, 'permission denied for table asset_assignments', 'Direct INSERT on public.asset_assignments is revoked from authenticated role');

  // Direct table writes on stock_opname_items revoked
  assertThrows(() => {
    runPsql(`
      set role authenticated;
      set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000005';
      insert into public.stock_opname_items (id, session_id, asset_id) values ('itm-fake', 'opn-fake', 'ast-gmc-02');
    `);
  }, 'permission denied for table stock_opname_items', 'Direct INSERT on public.stock_opname_items is revoked from authenticated role');

  // Direct table writes on stock_opname_sessions revoked
  assertThrows(() => {
    runPsql(`
      set role authenticated;
      set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000005';
      insert into public.stock_opname_sessions (id, session_number, title) values ('opn-fake', 'OPN-FAKE', 'Fake Audit');
    `);
  }, 'permission denied for table stock_opname_sessions', 'Direct INSERT on public.stock_opname_sessions is revoked from authenticated role');

  // Direct table writes on asset_histories revoked
  assertThrows(() => {
    runPsql(`
      set role authenticated;
      set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000003';
      insert into public.asset_histories (id, asset_id, action, notes) values ('hst-fake', 'ast-gmd-01', 'HACK', 'Forger');
    `);
  }, 'permission denied for table asset_histories', 'Direct INSERT on public.asset_histories is revoked from authenticated role');

  // ----------------------------------------------------------------------------
  console.log('\n--- 4. Testing Requirements 3, 5, 6, 7: RPC Workflows & Cross-Company Isolation ---');

  // Test 4.1: Asset Assignment via perform_asset_assignment RPC
  // Positive: IT_ADMIN (GMD) assigns GMD asset to GMD employee
  const assignRes = runPsql(`
    set role authenticated;
    set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000003';
    select public.perform_asset_assignment('ast-gmd-01', 'ASSIGN', 'emp-gmd-01', 'GOOD', 'DOC-HANDOVER-01', 'Assigned in Q1');
  `);
  assert(assignRes.includes('"success": true') && assignRes.includes('"new_status": "IN_USE"'), 'Authorized assignment via perform_asset_assignment RPC completed successfully');

  // Verify asset state updated in database
  const assignedEmp = runPsql(`select assigned_employee_id from public.assets where id = 'ast-gmd-01';`);
  assert(assignedEmp === 'emp-gmd-01', 'Asset assigned_employee_id correctly set to emp-gmd-01 in public.assets');

  // Negative: IT_ADMIN (GMD) attempts to assign GMC asset
  assertThrows(() => {
    runPsql(`
      set role authenticated;
      set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000003';
      select public.perform_asset_assignment('ast-gmc-02', 'ASSIGN', 'emp-gmd-01', 'GOOD');
    `);
  }, 'Forbidden: You do not have access to manage assets for this company entity', 'Cross-company asset assignment rejected (IT_ADMIN cannot manage GMC assets)');

  // Negative: IT_ADMIN (GMD) attempts to assign to GMC employee
  assertThrows(() => {
    runPsql(`
      set role authenticated;
      set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000003';
      select public.perform_asset_assignment('ast-gmd-01', 'ASSIGN', 'emp-gmc-02', 'GOOD');
    `);
  }, 'Forbidden: Target employee belongs to an unauthorized company entity', 'Cross-company target employee assignment rejected (Target belongs to GMC)');

  // Negative: IT_ADMIN attempts DISPOSE
  assertThrows(() => {
    runPsql(`
      set role authenticated;
      set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000003';
      select public.perform_asset_assignment('ast-gmd-01', 'DISPOSE');
    `);
  }, 'Forbidden: Asset disposal is strictly restricted to SUPER_ADMIN', 'Asset disposal rejected for IT_ADMIN (strictly restricted to SUPER_ADMIN)');

  // Positive: SUPER_ADMIN executes DISPOSE
  const disposeRes = runPsql(`
    set role authenticated;
    set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
    select public.perform_asset_assignment('ast-gmd-01', 'DISPOSE', null, 'DAMAGED', null, 'End of lifecycle');
  `);
  assert(disposeRes.includes('"success": true') && disposeRes.includes('"new_status": "DISPOSED"'), 'Asset disposal succeeded for SUPER_ADMIN');

  // Negative: Deactivated account attempts assignment
  assertThrows(() => {
    runPsql(`
      set role authenticated;
      set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000007';
      select public.perform_asset_assignment('ast-gmc-02', 'RETURN');
    `);
  }, 'Forbidden: Account is missing, deactivated, or lacks an assigned role', 'Deactivated account rejected from perform_asset_assignment RPC');

  // ----------------------------------------------------------------------------
  console.log('\n--- 5. Testing Stock Opname Lifecycle & Cross-Company Isolation ---');

  // Test 5.1: create_stock_opname_session
  // Negative: AUDITOR (GMC) attempts ALL-company session
  assertThrows(() => {
    runPsql(`
      set role authenticated;
      set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000005';
      select public.create_stock_opname_session('Test Audit ALL', 'ALL');
    `);
  }, 'Forbidden: Company-scoped auditors cannot create ALL-company audit sessions', 'Company-scoped auditor blocked from creating ALL-company session');

  // Negative: AUDITOR (GMC) attempts GMD session
  assertThrows(() => {
    runPsql(`
      set role authenticated;
      set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000005';
      select public.create_stock_opname_session('Test Audit GMD', 'comp-gmd-001');
    `);
  }, 'Forbidden: You do not have access to initiate audits for company ID comp-gmd-001', 'Company-scoped auditor blocked from creating session for unauthorized company');

  // Positive: AUDITOR (GMC) creates GMC session
  const gmcSessionJson = runPsql(`
    set role authenticated;
    set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000005';
    select public.create_stock_opname_session('Test Audit GMC 2026', 'comp-gmc-002');
  `);
  const gmcSession = JSON.parse(gmcSessionJson);
  const gmcSessionId = gmcSession.session_id;
  assert(gmcSession.success && gmcSessionId, `GMC session created by AUDITOR: ${gmcSession.session_number}`);

  // Test 5.2: record_stock_opname_scan
  // Positive: Scan GMC asset in GMC session
  const scanVerified = runPsql(`
    set role authenticated;
    set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000005';
    select public.record_stock_opname_scan('${gmcSessionId}', 'ast-gmc-02', 'SBY-Office', 'EXCELLENT', null, 'Scanned in Surabaya');
  `);
  assert(scanVerified.includes('"success": true') && scanVerified.includes('"status": "VERIFIED"'), 'Stock Opname scan on expected GMC asset returned VERIFIED');

  // Negative: Attempt duplicate scan
  const dupScan = runPsql(`
    set role authenticated;
    set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000005';
    select public.record_stock_opname_scan('${gmcSessionId}', 'ast-gmc-02', 'SBY-Office', 'EXCELLENT');
  `);
  assert(dupScan.includes('"duplicate": true'), 'Duplicate scan in same session detected and rejected');

  // Negative: Cross-company scan mismatch (Scan GMD asset into GMC session)
  assertThrows(() => {
    runPsql(`
      set role authenticated;
      set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000005';
      select public.record_stock_opname_scan('${gmcSessionId}', 'ast-gmd-01', 'JKT-HQ', 'GOOD');
    `);
  }, 'Forbidden: You do not have permission to audit assets belonging to this company entity', 'Cross-company scan rejected (Auditor lacks access to GMD asset)');

  // Ambiguity Test: Insert duplicate asset tag in different scope, scan should reject ambiguous identifier
  runPsql(`
    insert into public.assets (id, asset_tag, asset_name, company_id, category, model, cpu, ram, status, physical_condition, location, is_archived)
    values ('ast-dup-01', 'DUPLICATE-TAG-X', 'Asset A', 'comp-gmc-002', 'LAPTOP', 'T14', 'i5', '8GB', 'AVAILABLE', 'GOOD', 'SBY', false),
           ('ast-dup-02', 'DUPLICATE-TAG-X', 'Asset B', 'comp-gmc-002', 'LAPTOP', 'T14', 'i5', '8GB', 'AVAILABLE', 'GOOD', 'SBY', false);
  `);
  assertThrows(() => {
    runPsql(`
      set role authenticated;
      set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000005';
      select public.record_stock_opname_scan('${gmcSessionId}', 'DUPLICATE-TAG-X', 'SBY-Office', 'GOOD');
    `);
  }, 'Ambiguous identifier "DUPLICATE-TAG-X" matched 2 active assets', 'Ambiguous identifier match is strictly rejected (no arbitrary LIMIT 1)');

  // Clean duplicate assets
  runPsql(`delete from public.assets where asset_tag = 'DUPLICATE-TAG-X';`);

  // Test 5.3: reconcile_stock_opname
  // Positive: Reconcile GMC session by AUDITOR
  const reconcileRes = runPsql(`
    set role authenticated;
    set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000005';
    select public.reconcile_stock_opname('${gmcSessionId}', 'Audited and verified by GMC Auditor');
  `);
  assert(reconcileRes.includes('"success": true'), 'Stock Opname session successfully reconciled');

  // Verify session status is COMPLETED
  const sessionStatus = runPsql(`select status from public.stock_opname_sessions where id = '${gmcSessionId}';`);
  assert(sessionStatus === 'COMPLETED', 'Stock Opname session status updated to COMPLETED');

  // Verify cannot re-reconcile completed session
  assertThrows(() => {
    runPsql(`
      set role authenticated;
      set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000005';
      select public.reconcile_stock_opname('${gmcSessionId}', 'Reconcile again');
    `);
  }, 'Session cannot be reconciled in its current status', 'Re-reconciling a completed session is prevented by exclusive lock & status check');

  // Test 5.4: Reconciling ALL-company session requires enterprise-wide authority
  const allSessionJson = runPsql(`
    set role authenticated;
    set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
    select public.create_stock_opname_session('Enterprise Audit 2026', 'ALL');
  `);
  const allSessionId = JSON.parse(allSessionJson).session_id;

  assertThrows(() => {
    runPsql(`
      set role authenticated;
      set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000005';
      select public.reconcile_stock_opname('${allSessionId}', 'Auditor attempting reconcile');
    `);
  }, 'Forbidden: Reconciling an ALL-company session requires enterprise-wide authorization', 'Company-scoped auditor blocked from reconciling an ALL-company session');

  // Super Admin reconciles ALL-company session
  const allReconcileRes = runPsql(`
    set role authenticated;
    set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
    select public.reconcile_stock_opname('${allSessionId}', 'Super Admin enterprise signoff');
  `);
  assert(allReconcileRes.includes('"success": true'), 'SUPER_ADMIN successfully reconciled ALL-company session');

  // ----------------------------------------------------------------------------
  console.log('\n--- 6. Testing Requirement 8, 11, 12: Audit Trail & Historical Evidence ---');

  // Verify asset_histories contains automatic trigger and RPC records
  const historyActions = runPsql(`select distinct action from public.asset_histories where asset_id in ('ast-gmd-01', 'ast-gmc-02');`);
  assert(historyActions.includes('ASSIGN'), 'asset_histories contains ASSIGN audit record');
  assert(historyActions.includes('DISPOSE'), 'asset_histories contains DISPOSE audit record');
  assert(historyActions.includes('AUDIT'), 'asset_histories contains AUDIT reconciliation record');
  assert(historyActions.includes('FINANCIAL_UPDATE'), 'asset_histories contains FINANCIAL_UPDATE audit record');

  // Verify audit history immutable: no delete, no update
  assertThrows(() => {
    runPsql(`set role authenticated; set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001'; delete from public.asset_histories;`);
  }, 'permission denied for table asset_histories', 'DELETE on public.asset_histories is forbidden');

  assertThrows(() => {
    runPsql(`set role authenticated; set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001'; update public.asset_histories set notes = 'Tampered';`);
  }, 'permission denied for table asset_histories', 'UPDATE on public.asset_histories is forbidden');

  // Verify handover evidence preservation in asset_assignments
  const handoverRecord = runPsql(`select handover_doc_ref from public.asset_assignments where asset_id = 'ast-gmd-01' and action_type = 'ASSIGN';`);
  assert(handoverRecord === 'DOC-HANDOVER-01', 'Historical handover evidence preserved in asset_assignments');

  // ----------------------------------------------------------------------------
  console.log('\n--- 7. Cleanup Test Records ---');
  runPsql(`
    delete from public.stock_opname_items where session_id in ('${gmcSessionId}', '${allSessionId}');
    delete from public.stock_opname_sessions where id in ('${gmcSessionId}', '${allSessionId}');
    delete from public.asset_histories where asset_id in ('ast-gmd-01', 'ast-gmc-02', 'ast-tel-03', 'ast-rci-04', 'ast-test-unauth-fin');
    delete from public.asset_assignments where asset_id in ('ast-gmd-01', 'ast-gmc-02', 'ast-tel-03', 'ast-rci-04');
    delete from public.assets where id in ('ast-gmd-01', 'ast-gmc-02', 'ast-tel-03', 'ast-rci-04', 'ast-test-unauth-fin');
    delete from public.employees where email like '%@test-corp.com';
    delete from public.user_profiles where email like '%@test-corp.com';
    delete from auth.users where email like '%@test-corp.com';
  `);
  assert(true, 'Isolated test records cleanly cleaned up from test database');

  console.log('\n=================================================================');
  console.log(`  FINAL ISOLATED TEST RESULTS: ${passed} / ${passed + failed} PASSED`);
  console.log('=================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
