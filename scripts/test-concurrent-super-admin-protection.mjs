#!/usr/bin/env node
import { spawn } from 'child_process';

console.log('=================================================================');
console.log('   CONCURRENT TRANSACTION & RACE CONDITION SECURITY TEST SUITE   ');
console.log('   Target Database: itams_test on localhost                      ');
console.log('   Verification: Concurrency-Safe Row Locking (FOR UPDATE)       ');
console.log('=================================================================\n');

function runPsqlAsync(sql) {
  return new Promise((resolve) => {
    const proc = spawn('psql', ['-h', 'localhost', '-d', 'itams_test', '-v', 'ON_ERROR_STOP=1', '-q', '-t', '-A'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      resolve({
        ok: code === 0,
        code,
        output: stdout.trim(),
        error: stderr.trim(),
      });
    });

    proc.stdin.write(sql);
    proc.stdin.end();
  });
}

async function runPsqlSync(sql) {
  const res = await runPsqlAsync(sql);
  if (!res.ok) {
    throw new Error(res.error || `psql failed with exit code ${res.code}`);
  }
  return res.output;
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

async function main() {
  const ADMIN_A = 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa';
  const ADMIN_B = 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb';

  // Helper to reset test admins so that ONLY Admin A and Admin B are active Super Admins
  async function resetTestAdmins() {
    await runPsqlSync(`
      -- Ensure ADMIN_A and ADMIN_B exist in auth.users
      insert into auth.users (id, email) values
        ('${ADMIN_A}', 'admin_a@test.local'),
        ('${ADMIN_B}', 'admin_b@test.local')
      on conflict (id) do nothing;

      -- Ensure ADMIN_A and ADMIN_B are active SUPER_ADMIN
      insert into public.user_profiles (id, email, name, role, all_companies, is_active, approval_status)
      values
        ('${ADMIN_A}', 'admin_a@test.local', 'Admin A', 'SUPER_ADMIN', true, true, 'APPROVED'),
        ('${ADMIN_B}', 'admin_b@test.local', 'Admin B', 'SUPER_ADMIN', true, true, 'APPROVED')
      on conflict (id) do update set
        role = 'SUPER_ADMIN', all_companies = true, is_active = true, approval_status = 'APPROVED';

      -- Clean history for test admins
      delete from public.user_role_history where user_id in ('${ADMIN_A}', '${ADMIN_B}');

      -- Deactivate any other Super Admins so ONLY Admin A and Admin B are active
      update public.user_profiles
      set is_active = false
      where role = 'SUPER_ADMIN' and id not in ('${ADMIN_A}', '${ADMIN_B}');
    `);
  }

  // --------------------------------------------------------------------------
  // TEST 1: CONCURRENT SUPER ADMIN DEMOTIONS (Admin A & Admin B demote simultaneously)
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: Concurrent Simultaneous Demotions (Admin A vs Admin B) ---');
  await resetTestAdmins();

  const tx1Sql = `
    begin;
    set role authenticated;
    set request.jwt.claim.sub = '${ADMIN_A}';
    select pg_sleep(0.05);
    update public.user_profiles set role = 'EMPLOYEE' where id = '${ADMIN_A}';
    commit;
  `;

  const tx2Sql = `
    begin;
    set role authenticated;
    set request.jwt.claim.sub = '${ADMIN_B}';
    select pg_sleep(0.05);
    update public.user_profiles set role = 'EMPLOYEE' where id = '${ADMIN_B}';
    commit;
  `;

  const [t1Res, t2Res] = await Promise.all([
    runPsqlAsync(tx1Sql),
    runPsqlAsync(tx2Sql),
  ]);

  const oneDemoteSucceeded = (t1Res.ok && !t2Res.ok) || (!t1Res.ok && t2Res.ok);
  const failureReason = t1Res.error || t2Res.error;
  assert(
    oneDemoteSucceeded,
    'Exactly one of the concurrent demotion transactions succeeded, preventing dual demotion'
  );
  assert(
    failureReason && failureReason.includes('Cannot demote, deactivate, or unapprove the last remaining active Super Admin account'),
    `Aborted transaction threw last Super Admin protection error: "${failureReason}"`
  );

  const activeCountRes = await runPsqlSync(`
    select count(*) from public.user_profiles
    where id in ('${ADMIN_A}', '${ADMIN_B}') and role = 'SUPER_ADMIN' and is_active = true;
  `);
  assert(
    parseInt(activeCountRes, 10) === 1,
    'Database integrity verified: Exactly 1 active Super Admin survived the concurrent demotion race'
  );

  // --------------------------------------------------------------------------
  // TEST 2: CONCURRENT SUPER ADMIN DELETIONS (Admin A & Admin B delete simultaneously)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 2: Concurrent Simultaneous Deletions (Admin A vs Admin B) ---');
  await resetTestAdmins();

  const tx3Sql = `
    begin;
    set role authenticated;
    set request.jwt.claim.sub = '${ADMIN_A}';
    select pg_sleep(0.05);
    delete from public.user_profiles where id = '${ADMIN_A}';
    commit;
  `;

  const tx4Sql = `
    begin;
    set role authenticated;
    set request.jwt.claim.sub = '${ADMIN_B}';
    select pg_sleep(0.05);
    delete from public.user_profiles where id = '${ADMIN_B}';
    commit;
  `;

  const [t3Res, t4Res] = await Promise.all([
    runPsqlAsync(tx3Sql),
    runPsqlAsync(tx4Sql),
  ]);

  const deleteOneSucceeded = (t3Res.ok && !t4Res.ok) || (!t3Res.ok && t4Res.ok);
  const deleteFailureReason = t3Res.error || t4Res.error;
  assert(
    deleteOneSucceeded,
    'Exactly one of the concurrent deletion transactions succeeded, preventing dual deletion'
  );
  assert(
    deleteFailureReason && deleteFailureReason.includes('Cannot delete the last remaining active Super Admin account'),
    `Aborted transaction threw last Super Admin protection error: "${deleteFailureReason}"`
  );

  const activeDeleteCountRes = await runPsqlSync(`
    select count(*) from public.user_profiles
    where id in ('${ADMIN_A}', '${ADMIN_B}') and role = 'SUPER_ADMIN' and is_active = true;
  `);
  assert(
    parseInt(activeDeleteCountRes, 10) === 1,
    'Database integrity verified: Exactly 1 active Super Admin survived concurrent deletion race'
  );

  // --------------------------------------------------------------------------
  // TEST 3: CONCURRENT DEACTIVATIONS (Admin A & Admin B deactivate simultaneously)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 3: Concurrent Simultaneous Deactivations (Admin A vs Admin B) ---');
  await resetTestAdmins();

  const tx5Sql = `
    begin;
    set role authenticated;
    set request.jwt.claim.sub = '${ADMIN_A}';
    select pg_sleep(0.05);
    update public.user_profiles set is_active = false where id = '${ADMIN_A}';
    commit;
  `;

  const tx6Sql = `
    begin;
    set role authenticated;
    set request.jwt.claim.sub = '${ADMIN_B}';
    select pg_sleep(0.05);
    update public.user_profiles set is_active = false where id = '${ADMIN_B}';
    commit;
  `;

  const [t5Res, t6Res] = await Promise.all([
    runPsqlAsync(tx5Sql),
    runPsqlAsync(tx6Sql),
  ]);

  const deactOneSucceeded = (t5Res.ok && !t6Res.ok) || (!t5Res.ok && t6Res.ok);
  const deactFailureReason = t5Res.error || t6Res.error;
  assert(
    deactOneSucceeded,
    'Exactly one of the concurrent deactivation transactions succeeded, preventing dual deactivation'
  );
  assert(
    deactFailureReason && deactFailureReason.includes('Cannot demote, deactivate, or unapprove the last remaining active Super Admin account'),
    `Aborted transaction threw last Super Admin protection error: "${deactFailureReason}"`
  );

  const activeDeactCountRes = await runPsqlSync(`
    select count(*) from public.user_profiles
    where id in ('${ADMIN_A}', '${ADMIN_B}') and role = 'SUPER_ADMIN' and is_active = true;
  `);
  assert(
    parseInt(activeDeactCountRes, 10) === 1,
    'Database integrity verified: Exactly 1 active Super Admin survived concurrent deactivation race'
  );

  // Clean up test admins: First re-activate standard test super admin, then delete test admins
  await runPsqlSync(`
    update public.user_profiles set is_active = true where id = '11111111-1111-1111-1111-111111111111';
    delete from public.user_role_history where user_id in ('${ADMIN_A}', '${ADMIN_B}');
    delete from public.user_profiles where id in ('${ADMIN_A}', '${ADMIN_B}');
    delete from auth.users where id in ('${ADMIN_A}', '${ADMIN_B}');
  `);

  console.log('\n=================================================================');
  console.log(`  CONCURRENT TRANSACTION TEST RESULTS: ${passed} / ${total} PASSED`);
  console.log('=================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal concurrent test execution error:', err);
  process.exit(1);
});
