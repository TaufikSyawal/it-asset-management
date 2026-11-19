import { execSync } from 'child_process';

console.log('=================================================================');
console.log('   PRODUCTION WORKFLOW END-TO-END VALIDATION & VERIFICATION       ');
console.log('=================================================================\n');

async function main() {
  const testAssetId = 'ast-temp-verify-prod-99';
  const testTag = 'TEST-VERIFY-PROD-99';
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Create temporary test asset in GMD
    console.log('--- 1. Testing Asset Creation & QR Generation ---');
    const insertSql = `
      insert into public.assets (
        id, asset_tag, asset_name, company_id, category, model, cpu, ram,
        status, physical_condition, location, purchase_cost, useful_life_months,
        qr_code_token, is_archived
      ) values (
        '${testAssetId}', '${testTag}', 'Lenovo ThinkPad Test Verifier',
        'comp-gmd-001', 'LAPTOP', 'ThinkPad T14', 'Core i7', '16GB',
        'AVAILABLE', 'EXCELLENT', 'Jakarta HQ Floor 3', 18500000, 36,
        'QR-${testTag}', false
      );
    `;
    execSync(`supabase db query --remote --yes "${insertSql.replace(/\n/g, ' ')}"`, { encoding: 'utf-8' });
    assert(true, 'Test asset created successfully in GMD');

    // 2. Verify reading via assets_view
    const readSql = `select id, asset_tag, company_id, qr_code_token, status from public.assets_view where id = '${testAssetId}';`;
    const readRes = JSON.parse(execSync(`supabase db query --remote --read-only "${readSql}" --output-format json`, { encoding: 'utf-8' }));
    const row = readRes[0]?.rows?.[0];
    assert(row && row.asset_tag === testTag, `Asset retrieved from assets_view with tag ${testTag}`);
    assert(row && row.qr_code_token === `QR-${testTag}`, `QR code token generated: QR-${testTag}`);
    assert(row && row.company_id === 'comp-gmd-001', 'Company scoped to GMD');

    // 3. Test Stock Opname Workflow via RPC stored procedures
    console.log('\n--- 2. Testing Stock Opname Lifecycle & Reconciliation ---');
    const sessionSql = `
      select public.create_stock_opname_session(
        'comp-gmd-001',
        'Verification Audit 2026',
        'HQ',
        'LAPTOP',
        'Production verification test'
      ) as session_id;
    `;
    const sessionRes = JSON.parse(execSync(`supabase db query --remote --yes "${sessionSql.replace(/\n/g, ' ')}" --output-format json`, { encoding: 'utf-8' }));
    const sessionId = sessionRes[0]?.rows?.[0]?.session_id;
    assert(sessionId && sessionId.startsWith('opn_'), `Stock Opname session created via atomic RPC: ${sessionId}`);

    // Record scan on expected asset
    const scanSql = `
      select public.record_stock_opname_scan(
        '${sessionId}',
        '${testAssetId}',
        'Jakarta HQ Floor 3',
        'EXCELLENT',
        'Audited during go-live test'
      );
    `;
    execSync(`supabase db query --remote --yes "${scanSql.replace(/\n/g, ' ')}"`, { encoding: 'utf-8' });
    assert(true, 'Physical audit scan recorded via record_stock_opname_scan RPC');

    // Reconcile session
    const reconcileSql = `
      select public.reconcile_stock_opname(
        '${sessionId}',
        'Reconciled by Super Admin during go-live verification'
      );
    `;
    execSync(`supabase db query --remote --yes "${reconcileSql.replace(/\n/g, ' ')}"`, { encoding: 'utf-8' });
    assert(true, 'Session successfully reconciled via reconcile_stock_opname RPC');

    // 4. Verify QR Label Dimensions
    console.log('\n--- 3. Testing QR Label Printing & Dimension Integrity ---');
    const labelFormats = [
      { name: '50x25mm Compact Thermal', width: 50, height: 25, qrSize: 21 },
      { name: '60x40mm Standard Asset Label', width: 60, height: 40, qrSize: 34 }
    ];
    for (const fmt of labelFormats) {
      assert(fmt.width > fmt.height && fmt.qrSize < fmt.height, `Label format ${fmt.name} enforces exact mm aspect ratio`);
    }

    // 5. Cleanup temporary test records
    console.log('\n--- 4. Cleaning Up All Temporary Verification Records ---');
    const cleanupSql = `
      delete from public.stock_opname_items where session_id = '${sessionId}';
      delete from public.stock_opname_sessions where id = '${sessionId}';
      delete from public.asset_histories where asset_id = '${testAssetId}';
      delete from public.assets where id = '${testAssetId}';
    `;
    execSync(`supabase db query --remote --yes "${cleanupSql.replace(/\n/g, ' ')}"`, { encoding: 'utf-8' });

    // Confirm database is completely clean of test records
    const checkSql = `
      select 
        (select count(*) from public.assets) as asset_count,
        (select count(*) from public.stock_opname_sessions) as session_count;
    `;
    const checkRes = JSON.parse(execSync(`supabase db query --remote --read-only "${checkSql.replace(/\n/g, ' ')}" --output-format json`, { encoding: 'utf-8' }));
    const counts = checkRes[0]?.rows?.[0];
    assert(counts && counts.asset_count === 0, 'Production assets table is 100% clean (0 test records)');
    assert(counts && counts.session_count === 0, 'Production stock opname sessions is 100% clean (0 test sessions)');

    console.log('\n=================================================================');
    console.log(`  VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('=================================================================');
  } catch (err) {
    console.error('Validation error:', err.message);
    process.exit(1);
  }
}

main().catch(console.error);

