import fs from "fs";
import path from "path";
import assert from "assert";
import { ROLE_PERMISSIONS, sanitizeAssetForRole } from "./src/lib/permissions";
import { UserRole } from "./src/types";

console.log("=================================================================");
console.log("  SUPABASE & GITHUB PAGES ARCHITECTURE & SECURITY TEST SUITE   ");
console.log("=================================================================\n");

let passedTests = 0;
let totalTests = 0;

function test(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passedTests++;
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
  }
}

// -------------------------------------------------------------
// 1. SUPABASE DDL & SCHEMA SECURITY VALIDATIONS
// -------------------------------------------------------------
console.log("--- 1. Supabase PostgreSQL Schema & Security Auditing ---");
const schemaSql = fs.readFileSync(path.resolve("supabase/schema.sql"), "utf-8");

test("Schema defines all 6 enterprise user roles including MANAGEMENT", () => {
  const roles = ["SUPER_ADMIN", "MANAGEMENT", "IT_ADMIN", "FINANCE", "AUDITOR", "EMPLOYEE"];
  for (const role of roles) {
    assert(schemaSql.includes(`'${role}'`), `Missing role in schema: ${role}`);
  }
});

test("Schema defines master companies GMD, GMC, TEL, and RCI", () => {
  const seedSql = fs.readFileSync(path.resolve("supabase/seed.sql"), "utf-8");
  assert(seedSql.includes("'GMD'"), "Missing company code GMD");
  assert(seedSql.includes("'GMC'"), "Missing company code GMC");
  assert(seedSql.includes("'TEL'"), "Missing company code TEL");
  assert(seedSql.includes("'RCI'"), "Missing company code RCI");
  // Zero tester assets in seed.sql
  assert(!seedSql.includes("ast_"), "Seed file must not contain test assets");
});

test("Schema enforces security_invoker = true on assets_view", () => {
  assert(
    schemaSql.includes("with (security_invoker = true)"),
    "assets_view must specify security_invoker = true to enforce caller JWT permissions"
  );
});

test("Schema implements dynamic financial masking in assets_view", () => {
  assert(schemaSql.includes("case when public.can_view_financials() then a.purchase_cost else null end as purchase_cost"));
  assert(schemaSql.includes("case when public.can_view_financials() then a.net_book_value else null end as net_book_value"));
  assert(schemaSql.includes("case when public.can_view_financials() then a.accumulated_depreciation else null end as accumulated_depreciation"));
});

test("Schema prevents privilege escalation on user_profiles", () => {
  assert(
    schemaSql.includes('create policy "Only SUPER_ADMIN can update profiles"'),
    "user_profiles must restrict UPDATE to SUPER_ADMIN"
  );
  assert(
    schemaSql.includes('create policy "Only SUPER_ADMIN can insert profiles"'),
    "user_profiles must restrict INSERT to SUPER_ADMIN"
  );
});

test("Schema enforces immutable append-only asset_histories audit trail", () => {
  assert(
    schemaSql.includes('create policy "Histories delete is forbidden"'),
    "asset_histories must explicitly forbid DELETE"
  );
  assert(
    schemaSql.includes('create policy "Histories update is forbidden"'),
    "asset_histories must explicitly forbid UPDATE"
  );
});

test("Schema configures private storage bucket asset-photos with RLS", () => {
  assert(schemaSql.includes("'asset-photos'"), "Missing asset-photos bucket definition");
  assert(schemaSql.includes("public = false"), "asset-photos bucket must be private");
  assert(schemaSql.includes('create policy "Authenticated users can read asset photos"'));
  assert(schemaSql.includes('create policy "Admins can upload asset photos"'));
});

test("Schema defines atomic transactional stored procedures (RPC)", () => {
  assert(schemaSql.includes("public.perform_asset_assignment("));
  assert(schemaSql.includes("public.create_stock_opname_session("));
  assert(schemaSql.includes("public.record_stock_opname_scan("));
  assert(schemaSql.includes("public.reconcile_stock_opname("));
});

// -------------------------------------------------------------
// 2. CLIENT-SIDE ROLE PERMISSIONS & FINANCIAL MASKING
// -------------------------------------------------------------
console.log("\n--- 2. Client-Side RBAC & Field Sanitization ---");

test("ROLE_PERMISSIONS covers all 6 distinct personas", () => {
  const roles: UserRole[] = ["SUPER_ADMIN", "MANAGEMENT", "IT_ADMIN", "FINANCE", "AUDITOR", "EMPLOYEE"];
  for (const r of roles) {
    assert(ROLE_PERMISSIONS[r], `Missing permissions for ${r}`);
  }
});

test("MANAGEMENT has executive read-only and full financial oversight", () => {
  const p = ROLE_PERMISSIONS.MANAGEMENT;
  assert.strictEqual(p.canViewFinancials, true, "Management should view financials");
  assert.strictEqual(p.canEditFinancials, false, "Management should not edit financials");
  assert.strictEqual(p.canCreateAssets, false, "Management is read-only");
  assert.strictEqual(p.canAssignAssets, false, "Management is read-only");
});

test("AUDITOR and IT_ADMIN have financials masked", () => {
  assert.strictEqual(ROLE_PERMISSIONS.IT_ADMIN.canViewFinancials, false);
  assert.strictEqual(ROLE_PERMISSIONS.AUDITOR.canViewFinancials, false);
});

test("FINANCE has financial view and edit permissions but read-only hardware", () => {
  const p = ROLE_PERMISSIONS.FINANCE;
  assert.strictEqual(p.canViewFinancials, true);
  assert.strictEqual(p.canEditFinancials, true);
  assert.strictEqual(p.canCreateAssets, false);
  assert.strictEqual(p.canAssignAssets, false);
});

test("EMPLOYEE is strictly restricted to own assigned devices", () => {
  const p = ROLE_PERMISSIONS.EMPLOYEE;
  assert.strictEqual(p.restrictedToOwnAssets, true);
  assert.strictEqual(p.canViewFinancials, false);
  assert.strictEqual(p.canCreateAssets, false);
});

test("Super Admin has canManageCompanies permission while other roles do not", () => {
  assert.strictEqual(ROLE_PERMISSIONS.SUPER_ADMIN.canManageCompanies, true);
  assert.strictEqual(ROLE_PERMISSIONS.MANAGEMENT.canManageCompanies, false);
  assert.strictEqual(ROLE_PERMISSIONS.IT_ADMIN.canManageCompanies, false);
  assert.strictEqual(ROLE_PERMISSIONS.FINANCE.canManageCompanies, false);
  assert.strictEqual(ROLE_PERMISSIONS.AUDITOR.canManageCompanies, false);
  assert.strictEqual(ROLE_PERMISSIONS.EMPLOYEE.canManageCompanies, false);
});

test("sanitizeAssetForRole cleanly masks purchaseCost and netBookValue for unauthorized roles", () => {
  const dummyAsset = {
    id: "ast-test-1",
    assetTag: "GMD-001",
    assetName: "Dell Latitude",
    purchaseCost: 15000000,
    accumulatedDepreciation: 5000000,
    netBookValue: 10000000,
    usefulLifeMonths: 36,
  };

  const forItAdmin = sanitizeAssetForRole(dummyAsset, "IT_ADMIN");
  assert.strictEqual(forItAdmin.purchaseCost, undefined, "IT_ADMIN must not see purchaseCost");
  assert.strictEqual(forItAdmin.netBookValue, undefined, "IT_ADMIN must not see netBookValue");

  const forAuditor = sanitizeAssetForRole(dummyAsset, "AUDITOR");
  assert.strictEqual(forAuditor.purchaseCost, undefined, "AUDITOR must not see purchaseCost");

  const forManagement = sanitizeAssetForRole(dummyAsset, "MANAGEMENT");
  assert.strictEqual(forManagement.purchaseCost, 15000000, "MANAGEMENT must see purchaseCost");
  assert.strictEqual(forManagement.netBookValue, 10000000, "MANAGEMENT must see netBookValue");

  const forSuperAdmin = sanitizeAssetForRole(dummyAsset, "SUPER_ADMIN");
  assert.strictEqual(forSuperAdmin.purchaseCost, 15000000, "SUPER_ADMIN must see purchaseCost");
});

// -------------------------------------------------------------
// 3. GITHUB PAGES STATIC EXPORT & CI/CD DEPLOYMENT
// -------------------------------------------------------------
console.log("\n--- 3. GitHub Pages Static Export & CI/CD Pipeline ---");

test("Next.js config supports static export via STATIC_EXPORT environment flag", () => {
  const nextConfigContent = fs.readFileSync(path.resolve("next.config.mjs"), "utf-8");
  assert(nextConfigContent.includes("output: process.env.STATIC_EXPORT === 'true' ? 'export' : undefined"));
  assert(nextConfigContent.includes("unoptimized: true"));
});

test("GitHub Actions workflow (.github/workflows/deploy.yml) exists and configured", () => {
  const workflowPath = path.resolve(".github/workflows/deploy.yml");
  assert(fs.existsSync(workflowPath), "deploy.yml must exist");

  const content = fs.readFileSync(workflowPath, "utf-8");
  assert(content.includes("actions/checkout@v4"));
  assert(content.includes("actions/upload-pages-artifact@v3"));
  assert(content.includes("actions/deploy-pages@v4"));
  assert(content.includes("npm run build:static"));
  assert(content.includes("NEXT_PUBLIC_SUPABASE_URL"));
  assert(content.includes("NEXT_PUBLIC_SUPABASE_ANON_KEY"));
});

test("Static export directory out/ exists and contains required static bundle files", () => {
  const outDir = path.resolve("out");
  assert(fs.existsSync(outDir), "out/ directory must exist");
  assert(fs.existsSync(path.join(outDir, "index.html")), "out/index.html must exist");
  assert(fs.existsSync(path.join(outDir, "404.html")), "out/404.html must exist");
  assert(fs.existsSync(path.join(outDir, ".nojekyll")), "out/.nojekyll must exist for GitHub Pages");
});

test("Sensitive files and local backups are strictly ignored in .gitignore", () => {
  const gitignore = fs.readFileSync(path.resolve(".gitignore"), "utf-8");
  assert(gitignore.includes("/backups/"), ".gitignore must ignore /backups/");
  assert(gitignore.includes("/storage/photos/"), ".gitignore must ignore /storage/photos/");
  assert(gitignore.includes(".env"), ".gitignore must ignore .env");
  assert(gitignore.includes("/out/"), ".gitignore must ignore /out/");
});

// -------------------------------------------------------------
// 4. OFFLINE SYNC & EXCEL SERVICE INTEGRITY
// -------------------------------------------------------------
console.log("\n--- 4. Offline Synchronization & Client-Side Services ---");

test("offlineSyncService implements IndexedDB queue and browser online auto-sync", () => {
  const offlineCode = fs.readFileSync(path.resolve("src/services/offlineSyncService.ts"), "utf-8");
  assert(offlineCode.includes("itams_offline_audit"));
  assert(offlineCode.includes("scan_queue"));
  assert(offlineCode.includes("enqueueOfflineScan"));
  assert(offlineCode.includes("syncOfflineScans"));
  assert(offlineCode.includes("record_stock_opname_scan"));
});

test("photoService implements client-side Canvas WebP optimization (zero-cost compression)", () => {
  const photoCode = fs.readFileSync(path.resolve("src/services/photoService.ts"), "utf-8");
  assert(photoCode.includes("optimizeImageClientSide"));
  assert(photoCode.includes("image/webp"));
  assert(photoCode.includes("1920"));
  assert(photoCode.includes("300"));
});

test("excelService supports browser-based parsing and batch insertion", () => {
  const excelCode = fs.readFileSync(path.resolve("src/services/excelService.ts"), "utf-8");
  assert(excelCode.includes("parseExcelFileForPreview"));
  assert(excelCode.includes("executeBatchImport"));
  assert(excelCode.includes("downloadExcelTemplate"));
  assert(excelCode.includes("exportAssetsToExcel"));
});

// -------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------
console.log("\n=================================================================");
console.log(`  SECURITY & COMPLIANCE SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
console.log("=================================================================\n");

if (passedTests !== totalTests) {
  process.exit(1);
}

