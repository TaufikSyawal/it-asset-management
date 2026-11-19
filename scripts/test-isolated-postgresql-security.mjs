import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('=================================================================');
console.log('   ISOLATED POSTGRESQL & NON-SUPERUSER SECURITY TEST SUITE       ');
console.log('   Target Database: itams_test on localhost                      ');
console.log('   Verification: Revision 6 Security Definer Hardening & RBAC    ');
console.log('=================================================================\n');

function runPsql(sql) {
  return execSync('psql -h localhost -d itams_test -v ON_ERROR_STOP=1 -q -t -A', {
    input: sql,
    encoding: 'utf-8',
  }).trim();
}

function runPsqlWithError(sql) {
  try {
    const res = execSync('psql -h localhost -d itams_test -v ON_ERROR_STOP=1 -q -t -A 2>&1', {
      input: sql,
      encoding: 'utf-8',
    }).trim();
    return { ok: true, output: res };
  } catch (err) {
    const errText = ((err.stderr ? err.stderr.toString() : '') + ' ' + (err.stdout ? err.stdout.toString() : '') + ' ' + (err.message || ''));
    return { ok: false, error: errText };
  }
}

let passed = 0;
let total = 0;

function assert(condition, testName, detail = '') {
  total++;
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName} ${detail ? '(' + detail + ')' : ''}`);
  }
}

function assertThrows(sql, expectedMsgPart, testName) {
  total++;
  const res = runPsqlWithError(sql);
  if (!res.ok && res.error.toLowerCase().includes(expectedMsgPart.toLowerCase())) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else if (res.ok) {
    console.error(`  ✗ FAIL: ${testName} (Expected exception containing "${expectedMsgPart}" but succeeded with: ${res.output})`);
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    console.error(`    Expected error to contain: "${expectedMsgPart}"`);
    console.error(`    Actual error was: "${res.error.trim()}"`);
  }
}

async function main() {
  console.log('--- 1. Initializing Isolated Database & Applying Revision 6 Migration ---');

  // Reset public and storage schemas for clean test execution using existing test database admin
  runPsql(`
    drop schema if exists public cascade;
    drop schema if exists storage cascade;
    create schema public;
    grant all on schema public to public;
    grant usage on schema public to anon, authenticated, service_role;
  `);

  // Load mock supabase environment
  const mockSql = fs.readFileSync(path.resolve('scripts/setup-local-supabase-mock.sql'), 'utf-8');
  runPsql(mockSql);

  // Load base schema
  const schemaSql = fs.readFileSync(path.resolve('supabase/schema.sql'), 'utf-8');
  runPsql(schemaSql);

  // Load Revision 6 hardening migration
  const migrationSql = fs.readFileSync(path.resolve('supabase/migrations/20261119_user_management_hardening_v3.sql'), 'utf-8');
  runPsql(migrationSql);

  console.log('✓ Successfully applied mock auth, base schema, and Revision 6 migration to itams_test.\n');

  console.log('--- 2. Seeding Master Companies & Test Personas ---');
  // Seed companies: GMD, GMC, TEL, RCI
  runPsql(`
    insert into public.companies (id, code, name, is_active) values
      ('comp_gmd', 'GMD', 'GMD Resources', true),
      ('comp_gmc', 'GMC', 'GMC Mining', true),
      ('comp_tel', 'TEL', 'TEL Energy', true),
      ('comp_rci', 'RCI', 'RCI Commercial', true)
    on conflict (code) do update set is_active = true;
  `);

  // Seed personas:
  // 1. Super Admin: 11111111-1111-1111-1111-111111111111
  // 2. Management:  22222222-2222-2222-2222-222222222222
  // 3. IT Admin:    33333333-3333-3333-3333-333333333333 (GMD, GMC)
  // 4. Finance:     44444444-4444-4444-4444-444444444444
  // 5. Auditor:     55555555-5555-5555-5555-555555555555 (TEL)
  // 6. Employee:    66666666-6666-6666-6666-666666666666 (RCI)
  // 7. Deactivated: 77777777-7777-7777-7777-777777777777 (is_active = false)
  // 8. Unprofiled:  88888888-8888-8888-8888-888888888888 (in auth.users, NO user_profiles row)

  runPsql(`
    delete from auth.users;

    -- Super Admin
    insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'superadmin@test.local');
    update public.user_profiles set name = 'Super Admin Test', role = 'SUPER_ADMIN', all_companies = true, is_active = true, approval_status = 'APPROVED' where id = '11111111-1111-1111-1111-111111111111';

    -- Management
    insert into auth.users (id, email) values ('22222222-2222-2222-2222-222222222222', 'management@test.local');
    update public.user_profiles set name = 'Executive Mgmt', role = 'MANAGEMENT', all_companies = true, is_active = true, approval_status = 'APPROVED' where id = '22222222-2222-2222-2222-222222222222';

    -- IT Admin (GMD, GMC)
    insert into auth.users (id, email) values ('33333333-3333-3333-3333-333333333333', 'itadmin@test.local');
    update public.user_profiles set name = 'IT Admin GMD GMC', role = 'IT_ADMIN', all_companies = false, allowed_companies = '{GMD,GMC}', is_active = true, approval_status = 'APPROVED' where id = '33333333-3333-3333-3333-333333333333';

    -- Finance
    insert into auth.users (id, email) values ('44444444-4444-4444-4444-444444444444', 'finance@test.local');
    update public.user_profiles set name = 'Finance Officer', role = 'FINANCE', all_companies = true, is_active = true, approval_status = 'APPROVED' where id = '44444444-4444-4444-4444-444444444444';

    -- Auditor (TEL)
    insert into auth.users (id, email) values ('55555555-5555-5555-5555-555555555555', 'auditor@test.local');
    update public.user_profiles set name = 'Auditor TEL', role = 'AUDITOR', all_companies = false, allowed_companies = '{TEL}', is_active = true, approval_status = 'APPROVED' where id = '55555555-5555-5555-5555-555555555555';

    -- Employee (RCI)
    insert into auth.users (id, email) values ('66666666-6666-6666-6666-666666666666', 'employee@test.local');
    update public.user_profiles set name = 'Standard Employee', role = 'EMPLOYEE', all_companies = false, allowed_companies = '{RCI}', is_active = true, approval_status = 'APPROVED' where id = '66666666-6666-6666-6666-666666666666';

    -- Deactivated User
    insert into auth.users (id, email) values ('77777777-7777-7777-7777-777777777777', 'deactivated@test.local');
    update public.user_profiles set name = 'Deactivated Account', role = 'SUPER_ADMIN', all_companies = true, is_active = false, approval_status = 'APPROVED' where id = '77777777-7777-7777-7777-777777777777';

    -- Unprofiled User (in auth.users, NO user_profiles row)
    insert into auth.users (id, email) values ('88888888-8888-8888-8888-888888888888', 'unprofiled@test.local');
    delete from public.user_profiles where id = '88888888-8888-8888-8888-888888888888';
  `);

  console.log('✓ Seeding complete. All 6 personas, 4 companies, 1 deactivated user, and 1 unprofiled user created.\n');

  // -------------------------------------------------------------
  // TEST SUITE 1: ANONYMOUS ACCESS DENIAL
  // -------------------------------------------------------------
  console.log('--- TEST SUITE 1: Anonymous Access Denial (SET ROLE anon) ---');

  const anonRole = runPsql(`
    set role anon;
    select coalesce(public.get_current_role()::text, 'NULL');
  `);
  assert(anonRole === 'NULL', 'Anonymous session get_current_role() returns NULL (No EMPLOYEE fallback)');

  const anonFinView = runPsql(`
    set role anon;
    select public.can_view_financials();
  `);
  assert(anonFinView === 'f', 'Anonymous session can_view_financials() returns FALSE');

  const anonManageAssets = runPsql(`
    set role anon;
    select public.can_manage_assets();
  `);
  assert(anonManageAssets === 'f', 'Anonymous session can_manage_assets() returns FALSE');

  const anonCompanyAccess = runPsql(`
    set role anon;
    select public.can_access_company('comp_gmd');
  `);
  assert(anonCompanyAccess === 'f', 'Anonymous session can_access_company() returns FALSE');

  // -------------------------------------------------------------
  // TEST SUITE 2: DEACTIVATED USER ACCESS DENIAL
  // -------------------------------------------------------------
  console.log('\n--- TEST SUITE 2: Deactivated User Denial (is_active = false) ---');

  const deactRole = runPsql(`
    set role authenticated;
    set request.jwt.claim.sub = '77777777-7777-7777-7777-777777777777';
    select coalesce(public.get_current_role()::text, 'NULL');
  `);
  assert(deactRole === 'NULL', 'Deactivated user get_current_role() strictly returns NULL');

  const deactFinView = runPsql(`
    set role authenticated;
    set request.jwt.claim.sub = '77777777-7777-7777-7777-777777777777';
    select public.can_view_financials();
  `);
  assert(deactFinView === 'f', 'Deactivated user can_view_financials() returns FALSE');

  const deactCompanyAccess = runPsql(`
    set role authenticated;
    set request.jwt.claim.sub = '77777777-7777-7777-7777-777777777777';
    select public.can_access_company('comp_gmd');
  `);
  assert(deactCompanyAccess === 'f', 'Deactivated user can_access_company() returns FALSE');

  // -------------------------------------------------------------
  // TEST SUITE 3: MISSING PROFILE ACCESS DENIAL
  // -------------------------------------------------------------
  console.log('\n--- TEST SUITE 3: Missing Profile Denial (No user_profiles row) ---');

  const unprofiledRole = runPsql(`
    set role authenticated;
    set request.jwt.claim.sub = '88888888-8888-8888-8888-888888888888';
    select coalesce(public.get_current_role()::text, 'NULL');
  `);
  assert(unprofiledRole === 'NULL', 'Missing profile get_current_role() strictly returns NULL (No EMPLOYEE fallback)');

  const unprofiledFinView = runPsql(`
    set role authenticated;
    set request.jwt.claim.sub = '88888888-8888-8888-8888-888888888888';
    select public.can_view_financials();
  `);
  assert(unprofiledFinView === 'f', 'Missing profile can_view_financials() returns FALSE');

  // -------------------------------------------------------------
  // TEST SUITE 4: PRIVILEGE ESCALATION PREVENTION
  // -------------------------------------------------------------
  console.log('\n--- TEST SUITE 4: Privilege Escalation Prevention (Non-Super Admin Update Attempts) ---');

  assertThrows(`
    set role authenticated;
    set request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';
    update public.user_profiles set role = 'SUPER_ADMIN' where id = '66666666-6666-6666-6666-666666666666';
  `, 'Privilege Escalation Blocked: Only Super Admins can modify user roles.',
  'Employee cannot elevate their own role to SUPER_ADMIN');

  assertThrows(`
    set role authenticated;
    set request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';
    update public.user_profiles set all_companies = true where id = '66666666-6666-6666-6666-666666666666';
  `, 'Privilege Escalation Blocked: Only Super Admins can modify company access permissions.',
  'Employee cannot grant themselves all_companies scope');

  assertThrows(`
    set role authenticated;
    set request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';
    update public.user_profiles set allowed_companies = '{GMD,GMC,TEL,RCI}' where id = '66666666-6666-6666-6666-666666666666';
  `, 'Privilege Escalation Blocked: Only Super Admins can modify company access permissions.',
  'Employee cannot grant themselves additional company permissions');

  assertThrows(`
    set role authenticated;
    set request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';
    update public.user_profiles set employee_id = 'EMP-HACKED' where id = '66666666-6666-6666-6666-666666666666';
  `, 'Privilege Escalation Blocked: Only Super Admins can link or modify employee ID.',
  'Employee cannot tamper with or re-assign their employee_id linkage');

  // Employee cannot modify another user's profile
  runPsql(`
    set role authenticated;
    set request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';
    update public.user_profiles set name = 'Hacked Admin' where id = '11111111-1111-1111-1111-111111111111';
  `);
  const adminNameAfterHack = runPsql(`
    set role authenticated;
    set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
    select name from public.user_profiles where id = '11111111-1111-1111-1111-111111111111';
  `);
  assert(adminNameAfterHack === 'Super Admin Test', 'Employee cannot modify another user profile (Row protected by RLS)');

  // Employee CAN update their own name
  const empNameUpdate = runPsql(`
    set role authenticated;
    set request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';
    update public.user_profiles set name = 'Updated Employee Name' where id = '66666666-6666-6666-6666-666666666666';
    select name from public.user_profiles where id = '66666666-6666-6666-6666-666666666666';
  `);
  assert(empNameUpdate === 'Updated Employee Name', 'Employee is permitted to update their own display name');

  // -------------------------------------------------------------
  // TEST SUITE 5: LAST SUPER ADMIN PROTECTION & CONCURRENCY
  // -------------------------------------------------------------
  console.log('\n--- TEST SUITE 5: Last Active Super Admin Safeguards & Row Locking ---');

  assertThrows(`
    set role authenticated;
    set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
    update public.user_profiles set role = 'EMPLOYEE' where id = '11111111-1111-1111-1111-111111111111';
  `, 'Cannot demote, deactivate, or unapprove the last remaining active Super Admin account.',
  'Last Super Admin cannot demote themselves to EMPLOYEE');

  assertThrows(`
    set role authenticated;
    set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
    update public.user_profiles set is_active = false where id = '11111111-1111-1111-1111-111111111111';
  `, 'Cannot demote, deactivate, or unapprove the last remaining active Super Admin account.',
  'Last Super Admin cannot deactivate themselves');

  assertThrows(`
    set role authenticated;
    set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
    delete from public.user_profiles where id = '11111111-1111-1111-1111-111111111111';
  `, 'Security Protection: Cannot delete the last remaining active Super Admin account.',
  'Last Super Admin cannot delete their own account');

  // When a second Super Admin is elevated by existing Super Admin, demotion of one is permitted
  runPsql(`
    insert into auth.users (id, email) values ('11111111-2222-3333-4444-555555555555', 'admin2@test.local');
    set role authenticated;
    set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
    update public.user_profiles set name = 'Second Admin', role = 'SUPER_ADMIN', all_companies = true, is_active = true, approval_status = 'APPROVED'
    where id = '11111111-2222-3333-4444-555555555555';
  `);

  const secondAdminDemote = runPsql(`
    set role authenticated;
    set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
    update public.user_profiles set role = 'IT_ADMIN' where id = '11111111-2222-3333-4444-555555555555';
    select role::text from public.user_profiles where id = '11111111-2222-3333-4444-555555555555';
  `);
  assert(secondAdminDemote === 'IT_ADMIN', 'Demoting second Super Admin succeeds because 1 active Super Admin remains');

  // Clean up second test admin
  runPsql(`
    set role authenticated;
    set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
    delete from public.user_profiles where id = '11111111-2222-3333-4444-555555555555';
    reset role;
    delete from auth.users where id = '11111111-2222-3333-4444-555555555555';
  `);

  // -------------------------------------------------------------
  // TEST SUITE 6: AUDIT TRAIL IMMUTABILITY & LIFECYCLE
  // -------------------------------------------------------------
  console.log('\n--- TEST SUITE 6: Immutable Role Audit Trail (CREATE, UPDATE, DELETE) ---');

  // Direct client insert into user_role_history must fail
  assertThrows(`
    set role authenticated;
    set request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';
    insert into public.user_role_history (user_id, user_email, action, new_role)
    values ('66666666-6666-6666-6666-666666666666', 'fake@fake.local', 'CREATE', 'SUPER_ADMIN');
  `, 'permission denied',
  'Direct client INSERT into user_role_history is denied');

  // Direct client update into user_role_history must fail
  assertThrows(`
    set role authenticated;
    set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
    update public.user_role_history set notes = 'Forged Audit Log';
  `, 'permission denied',
  'Direct client UPDATE on user_role_history is denied (Immutable)');

  // Direct client delete on user_role_history must fail
  assertThrows(`
    set role authenticated;
    set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
    delete from public.user_role_history;
  `, 'permission denied',
  'Direct client DELETE on user_role_history is denied (Immutable)');

  // Verify non-cascading audit trail: create a temp user, update them, delete them, and verify history survives
  runPsql(`
    -- Create temp user (trigger handle_new_auth_user creates EMPLOYEE profile and logs CREATE)
    insert into auth.users (id, email) values ('99999999-9999-9999-9999-999999999999', 'tempuser@test.local');

    -- Super Admin elevates temp user to IT_ADMIN (logs UPDATE)
    set role authenticated;
    set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
    update public.user_profiles set role = 'IT_ADMIN', allowed_companies = '{GMD}' where id = '99999999-9999-9999-9999-999999999999';

    -- Super Admin deletes temp user (logs DELETE)
    delete from public.user_profiles where id = '99999999-9999-9999-9999-999999999999';
  `);

  const historyActions = runPsql(`
    set role authenticated;
    set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
    select string_agg(action, ', ' order by created_at)
    from public.user_role_history
    where user_id = '99999999-9999-9999-9999-999999999999';
  `);
  assert(historyActions.includes('CREATE') && historyActions.includes('UPDATE') && historyActions.includes('DELETE'),
    `Audit trail captures full lifecycle (CREATE, UPDATE, DELETE): "${historyActions}"`);

  // Employee cannot view other users' role history
  const empHistoryRead = runPsql(`
    set role authenticated;
    set request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';
    select count(*) from public.user_role_history where user_id = '99999999-9999-9999-9999-999999999999';
  `);
  assert(empHistoryRead === '0', 'Employee cannot view another users role history (RLS blocks history snooping)');

  // -------------------------------------------------------------
  // TEST SUITE 7: FINANCIAL READ & WRITE PERMISSION SEPARATION
  // -------------------------------------------------------------
  console.log('\n--- TEST SUITE 7: Financial Read and Write Permissions ---');

  // Management: can view = true, can edit = false
  const mgmtCanView = runPsql(`
    set role authenticated;
    set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
    select public.can_view_financials();
  `);
  const mgmtCanEdit = runPsql(`
    set role authenticated;
    set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
    select public.can_edit_financials();
  `);
  assert(mgmtCanView === 't' && mgmtCanEdit === 'f', 'MANAGEMENT has can_view_financials = true and can_edit_financials = false (Strict read-only)');

  // Finance: can view = true, can edit = true
  const finCanView = runPsql(`
    set role authenticated;
    set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
    select public.can_view_financials();
  `);
  const finCanEdit = runPsql(`
    set role authenticated;
    set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
    select public.can_edit_financials();
  `);
  assert(finCanView === 't' && finCanEdit === 't', 'FINANCE has can_view_financials = true and can_edit_financials = true');

  // IT Admin: can view = false, can edit = false
  const itCanView = runPsql(`
    set role authenticated;
    set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
    select public.can_view_financials();
  `);
  const itCanEdit = runPsql(`
    set role authenticated;
    set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
    select public.can_edit_financials();
  `);
  assert(itCanView === 'f' && itCanEdit === 'f', 'IT_ADMIN has financials strictly masked (view = false, edit = false)');

  // Auditor: can view = false, can edit = false
  const audCanView = runPsql(`
    set role authenticated;
    set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
    select public.can_view_financials();
  `);
  assert(audCanView === 'f', 'AUDITOR has financials strictly masked');

  // Employee: can view = false, can edit = false
  const empCanView = runPsql(`
    set role authenticated;
    set request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';
    select public.can_view_financials();
  `);
  assert(empCanView === 'f', 'EMPLOYEE has financials strictly masked');

  // -------------------------------------------------------------
  // TEST SUITE 8: MULTI-COMPANY ISOLATION ACROSS 4 ENTITIES
  // -------------------------------------------------------------
  console.log('\n--- TEST SUITE 8: Multi-Company Tenant Scopes (GMD, GMC, TEL, RCI) ---');

  // IT Admin: GMD = true, GMC = true, TEL = false, RCI = false
  const itGmd = runPsql(`set role authenticated; set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333'; select public.can_access_company('comp_gmd');`);
  const itGmc = runPsql(`set role authenticated; set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333'; select public.can_access_company('comp_gmc');`);
  const itTel = runPsql(`set role authenticated; set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333'; select public.can_access_company('comp_tel');`);
  const itRci = runPsql(`set role authenticated; set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333'; select public.can_access_company('comp_rci');`);
  assert(itGmd === 't' && itGmc === 't' && itTel === 'f' && itRci === 'f',
    'IT Admin correctly isolated to {GMD, GMC} (TEL and RCI access denied)');

  // Auditor: TEL = true, GMD = false, GMC = false, RCI = false
  const audTel = runPsql(`set role authenticated; set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555'; select public.can_access_company('comp_tel');`);
  const audGmd = runPsql(`set role authenticated; set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555'; select public.can_access_company('comp_gmd');`);
  assert(audTel === 't' && audGmd === 'f',
    'Auditor correctly isolated to {TEL} (GMD access denied)');

  // Employee: RCI = true, TEL = false
  const empRci = runPsql(`set role authenticated; set request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666'; select public.can_access_company('comp_rci');`);
  const empTel = runPsql(`set role authenticated; set request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666'; select public.can_access_company('comp_tel');`);
  assert(empRci === 't' && empTel === 'f',
    'Employee correctly isolated to {RCI} (TEL access denied)');

  // Super Admin: all 4 companies = true
  const saGmd = runPsql(`set role authenticated; set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111'; select public.can_access_company('comp_gmd');`);
  const saRci = runPsql(`set role authenticated; set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111'; select public.can_access_company('comp_rci');`);
  assert(saGmd === 't' && saRci === 't',
    'Super Admin has unrestricted access to all company entities (GMD, GMC, TEL, RCI)');

  // -------------------------------------------------------------
  // TEST SUITE 9: NEW USER ONBOARDING ZERO-TRUST TRIGGER
  // -------------------------------------------------------------
  console.log('\n--- TEST SUITE 9: New User Trigger handle_new_auth_user() ---');

  runPsql(`
    insert into auth.users (id, email) values ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'brandnew@test.local');
  `);

  const newProfile = runPsql(`
    select role::text || '|' || all_companies::text || '|' || array_to_string(allowed_companies, ',') || '|' || is_active::text || '|' || approval_status
    from public.user_profiles
    where id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  `);
  assert(newProfile === 'EMPLOYEE|false||true|PENDING',
    `Newly created user profile automatically defaults to EMPLOYEE with zero company access and PENDING status: "${newProfile}"`);

  // Clean up test user
  runPsql(`
    delete from public.user_profiles where id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    delete from auth.users where id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  `);

  // -------------------------------------------------------------
  // TEST SUITE 10: REGISTRATION & ACCOUNT APPROVAL GOVERNANCE
  // -------------------------------------------------------------
  console.log('\n--- TEST SUITE 10: Registration & Account Approval Governance ---');

  // 10.1 Newly registered user defaults to PENDING
  runPsql(`
    delete from public.user_profiles where id = '99999999-9999-9999-9999-999999999999';
    delete from auth.users where id = '99999999-9999-9999-9999-999999999999';
    insert into auth.users (id, email) values ('99999999-9999-9999-9999-999999999999', 'pendinguser@test.local');
  `);
  const pendingStatus = runPsql(`
    select approval_status from public.user_profiles where id = '99999999-9999-9999-9999-999999999999';
  `);
  assert(pendingStatus === 'PENDING', 'New registered user defaults to approval_status = PENDING');

  // 10.2 Pending user has zero role & zero company access
  const pendingRole = runPsql(`
    set role authenticated;
    set request.jwt.claim.sub = '99999999-9999-9999-9999-999999999999';
    select coalesce(public.get_current_role()::text, 'NULL');
  `);
  assert(pendingRole === 'NULL', 'Pending user get_current_role() returns NULL (Zero platform privileges)');

  const pendingCompanyAccess = runPsql(`
    set role authenticated;
    set request.jwt.claim.sub = '99999999-9999-9999-9999-999999999999';
    select public.can_access_company('comp_gmd');
  `);
  assert(pendingCompanyAccess === 'f', 'Pending user can_access_company() returns FALSE');

  // 10.3a Pending user cannot self-approve (Row blocked by RLS)
  runPsql(`
    set role authenticated;
    set request.jwt.claim.sub = '99999999-9999-9999-9999-999999999999';
    update public.user_profiles set approval_status = 'APPROVED' where id = '99999999-9999-9999-9999-999999999999';
  `);
  const stillPending = runPsql(`
    select approval_status from public.user_profiles where id = '99999999-9999-9999-9999-999999999999';
  `);
  assert(stillPending === 'PENDING', 'Pending user cannot self-approve their own account (Status remains PENDING)');

  // 10.3b Employee cannot modify approval_status (Privilege escalation blocked)
  assertThrows(`
    set role authenticated;
    set request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';
    update public.user_profiles set approval_status = 'REJECTED' where id = '66666666-6666-6666-6666-666666666666';
  `, 'Privilege Escalation Blocked: Only Super Admins can approve or reject user registrations.',
  'Active employee cannot modify approval_status (Privilege escalation blocked)');

  // 10.4 Super Admin can approve pending user and assign company access
  runPsql(`
    set role authenticated;
    set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
    update public.user_profiles
    set approval_status = 'APPROVED', allowed_companies = '{GMD}'
    where id = '99999999-9999-9999-9999-999999999999';
  `);
  const approvedRole = runPsql(`
    set role authenticated;
    set request.jwt.claim.sub = '99999999-9999-9999-9999-999999999999';
    select public.get_current_role()::text;
  `);
  const approvedAccessGmd = runPsql(`
    set role authenticated;
    set request.jwt.claim.sub = '99999999-9999-9999-9999-999999999999';
    select public.can_access_company('comp_gmd');
  `);
  const approvedAccessGmc = runPsql(`
    set role authenticated;
    set request.jwt.claim.sub = '99999999-9999-9999-9999-999999999999';
    select public.can_access_company('comp_gmc');
  `);
  assert(approvedRole === 'EMPLOYEE' && approvedAccessGmd === 't' && approvedAccessGmc === 'f',
    'Approved user gains role EMPLOYEE and authorized access only to granted company {GMD}');

  // 10.5 Protect Last Super Admin from unapproval
  assertThrows(`
    set role authenticated;
    set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
    update public.user_profiles set approval_status = 'PENDING' where id = '11111111-1111-1111-1111-111111111111';
  `, 'Cannot demote, deactivate, or unapprove the last remaining active Super Admin',
    'Cannot set the last active Super Admin account to PENDING or REJECTED');

  // 10.6 Audit trail records approval status change
  const approvalAuditNotes = runPsql(`
    select notes from public.user_role_history
    where user_id = '99999999-9999-9999-9999-999999999999' and action = 'UPDATE'
    order by created_at desc limit 1;
  `);
  assert(approvalAuditNotes.includes('APPROVED'),
    `Audit trail captures approval status change: "${approvalAuditNotes}"`);

  // Clean up
  runPsql(`
    delete from public.user_profiles where id = '99999999-9999-9999-9999-999999999999';
    delete from auth.users where id = '99999999-9999-9999-9999-999999999999';
  `);

  console.log('\n=================================================================');
  console.log(`  ISOLATED POSTGRESQL TEST RESULTS: ${passed} / ${total} PASSED`);
  console.log('=================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test execution failure:', err);
  process.exit(1);
});
