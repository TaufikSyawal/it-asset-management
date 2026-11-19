import fs from "fs";
import path from "path";
import assert from "assert";
import { ROLE_PERMISSIONS } from "./src/lib/permissions";
import { UserRole } from "./src/types";

console.log("=================================================================");
console.log("    CENTRALIZED USER MANAGEMENT & RBAC GOVERNANCE TEST SUITE    ");
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
// 1. ROLE DEFINITIONS & ROLE-BASED ACCESS CONTROL (RBAC)
// -------------------------------------------------------------
console.log("--- 1. Role Definitions & Permissions Matrix ---");

const EXPECTED_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "MANAGEMENT",
  "IT_ADMIN",
  "FINANCE",
  "AUDITOR",
  "EMPLOYEE",
];

test("All 6 canonical user roles exist in the permissions matrix", () => {
  for (const role of EXPECTED_ROLES) {
    assert(ROLE_PERMISSIONS[role], `Missing role permission definition for: ${role}`);
  }
});

test("Super Admin has unrestricted permissions across all operational areas", () => {
  const sa = ROLE_PERMISSIONS["SUPER_ADMIN"];
  assert.strictEqual(sa.canManageUsers, true, "Super Admin must manage users");
  assert.strictEqual(sa.canManageCompanies, true, "Super Admin must manage companies");
  assert.strictEqual(sa.canCreateAssets, true, "Super Admin must create assets");
  assert.strictEqual(sa.canEditAssets, true, "Super Admin must edit assets");
  assert.strictEqual(sa.canArchiveAssets, true, "Super Admin must archive assets");
  assert.strictEqual(sa.canViewFinancials, true, "Super Admin must view financials");
  assert.strictEqual(sa.canAssignAssets, true, "Super Admin must assign assets");
  assert.strictEqual(sa.canManageStockOpname, true, "Super Admin must manage stock opnames");
  assert.strictEqual(sa.canReconcileStockOpname, true, "Super Admin must reconcile stock opnames");
});

test("Management has read-only executive visibility and cannot edit assets or manage users", () => {
  const mgmt = ROLE_PERMISSIONS["MANAGEMENT"];
  assert.strictEqual(mgmt.canManageUsers, false, "Management cannot manage users");
  assert.strictEqual(mgmt.canManageCompanies, false, "Management cannot manage companies");
  assert.strictEqual(mgmt.canCreateAssets, false, "Management cannot create assets");
  assert.strictEqual(mgmt.canEditAssets, false, "Management cannot edit assets");
  assert.strictEqual(mgmt.canArchiveAssets, false, "Management cannot archive assets");
  assert.strictEqual(mgmt.canViewFinancials, true, "Management has financial visibility");
});

test("Finance has read-only financial access and cannot alter IT asset state or manage users", () => {
  const fin = ROLE_PERMISSIONS["FINANCE"];
  assert.strictEqual(fin.canManageUsers, false, "Finance cannot manage users");
  assert.strictEqual(fin.canViewFinancials, true, "Finance has financial visibility");
  assert.strictEqual(fin.canCreateAssets, false, "Finance cannot create assets");
  assert.strictEqual(fin.canArchiveAssets, false, "Finance cannot archive assets");
  assert.strictEqual(fin.canManageCompanies, false, "Finance cannot manage companies");
});

test("IT Admin can manage physical assets and stock opnames but cannot view financials or manage users", () => {
  const it = ROLE_PERMISSIONS["IT_ADMIN"];
  assert.strictEqual(it.canManageUsers, false, "IT Admin cannot manage users");
  assert.strictEqual(it.canCreateAssets, true, "IT Admin can create assets");
  assert.strictEqual(it.canEditAssets, true, "IT Admin can edit assets");
  assert.strictEqual(it.canViewFinancials, false, "IT Admin must not view raw financials");
  assert.strictEqual(it.canManageCompanies, false, "IT Admin cannot manage company records");
});

test("Auditor has read-only audit visibility with masked financial values", () => {
  const aud = ROLE_PERMISSIONS["AUDITOR"];
  assert.strictEqual(aud.canManageUsers, false, "Auditor cannot manage users");
  assert.strictEqual(aud.canViewFinancials, false, "Auditor must not view financials");
  assert.strictEqual(aud.canManageStockOpname, true, "Auditor can execute stock opnames");
  assert.strictEqual(aud.canCreateAssets, false, "Auditor cannot create assets");
});

test("Employee has baseline restricted self-service access", () => {
  const emp = ROLE_PERMISSIONS["EMPLOYEE"];
  assert.strictEqual(emp.canManageUsers, false, "Employee cannot manage users");
  assert.strictEqual(emp.canViewFinancials, false, "Employee must not view financials");
  assert.strictEqual(emp.canCreateAssets, false, "Employee cannot create assets");
  assert.strictEqual(emp.canEditAssets, false, "Employee cannot edit assets");
  assert.strictEqual(emp.canArchiveAssets, false, "Employee cannot archive assets");
  assert.strictEqual(emp.canAssignAssets, false, "Employee cannot assign assets");
  assert.strictEqual(emp.canManageStockOpname, false, "Employee cannot manage stock opnames");
});

// -------------------------------------------------------------
// 2. DEFAULT USER PROVISIONING & LEAST PRIVILEGE
// -------------------------------------------------------------
console.log("\n--- 2. Default User Provisioning Rules ---");

const migrationSql = fs.readFileSync(
  path.resolve("supabase/migrations/20261119_user_management_hardening.sql"),
  "utf-8"
);

test("Database schema sets default role to EMPLOYEE for new profiles", () => {
  const schemaSql = fs.readFileSync(path.resolve("supabase/schema.sql"), "utf-8");
  assert(
    schemaSql.includes("role public.user_role not null default 'EMPLOYEE'"),
    "Default user_profiles.role must be 'EMPLOYEE'"
  );
});

test("Database trigger handle_new_auth_user() defaults all_companies to false", () => {
  const schemaSql = fs.readFileSync(path.resolve("supabase/schema.sql"), "utf-8");
  assert(
    schemaSql.includes("handle_new_auth_user") &&
    schemaSql.includes("'EMPLOYEE'::public.user_role") &&
    schemaSql.includes("false,") &&
    schemaSql.includes("all_companies"),
    "handle_new_auth_user() must default all_companies to false"
  );
});

test("Database trigger handle_new_auth_user() defaults allowed_companies to empty array", () => {
  const schemaSql = fs.readFileSync(path.resolve("supabase/schema.sql"), "utf-8");
  assert(
    schemaSql.includes("handle_new_auth_user") &&
    schemaSql.includes("'{}'") &&
    schemaSql.includes("allowed_companies"),
    "handle_new_auth_user() must default allowed_companies to '{}'"
  );
});

// -------------------------------------------------------------
// 3. SUPER ADMIN SAFEGUARD & LAST ADMIN PROTECTION
// -------------------------------------------------------------
console.log("\n--- 3. Last Active Super Admin Safeguards ---");

test("Migration contains protect_last_super_admin() database trigger", () => {
  assert(
    migrationSql.includes("create or replace function public.protect_last_super_admin()"),
    "protect_last_super_admin trigger function must exist"
  );
  assert(
    migrationSql.includes("create trigger trg_protect_last_super_admin"),
    "trg_protect_last_super_admin trigger must be attached to user_profiles"
  );
});

test("protect_last_super_admin() checks that other active Super Admins exist before demoting or deactivating", () => {
  assert(
    migrationSql.includes("role = 'SUPER_ADMIN'"),
    "Must verify Super Admin role"
  );
  assert(
    migrationSql.includes("is_active = true"),
    "Must verify active status of other Super Admins"
  );
  assert(
    migrationSql.includes("raise exception"),
    "Must raise database exception to abort the transaction"
  );
});

test("Frontend userManagementService enforces last Super Admin check client-side as well", () => {
  const serviceCode = fs.readFileSync(
    path.resolve("src/services/userManagementService.ts"),
    "utf-8"
  );
  assert(
    serviceCode.includes("Cannot demote the last remaining Super Admin account"),
    "userManagementService must prevent demoting last Super Admin"
  );
  assert(
    serviceCode.includes("Cannot deactivate the last remaining Super Admin account"),
    "userManagementService must prevent deactivating last Super Admin"
  );
});

// -------------------------------------------------------------
// 4. DEACTIVATED USER RESTRICTIONS & SESSION REVOCATION
// -------------------------------------------------------------
console.log("\n--- 4. Deactivated User Immediate Revocation ---");

test("RLS helper functions check up.is_active = true before granting data access", () => {
  assert(
    migrationSql.includes("where up.id = auth.uid()") && migrationSql.includes("and up.is_active = true"),
    "can_access_company must require up.is_active = true"
  );
  assert(
    migrationSql.includes("where id = auth.uid()") && migrationSql.includes("and is_active = true"),
    "can_manage_assets and can_view_financials must require is_active = true"
  );
});

test("authService immediately logs out user if is_active is false", () => {
  const authCode = fs.readFileSync(path.resolve("src/services/authService.ts"), "utf-8");
  assert(
    authCode.includes("data.is_active === false"),
    "authService must check is_active === false"
  );
  assert(
    authCode.includes("await signOut()"),
    "authService must force signOut if account is inactive"
  );
});

// -------------------------------------------------------------
// 5. IMMUTABLE AUDIT TRAIL FOR ROLES AND PERMISSIONS
// -------------------------------------------------------------
console.log("\n--- 5. Audit Trail & Role Change History ---");

test("user_role_history table records old/new role and old/new company scopes", () => {
  assert(migrationSql.includes("old_role public.user_role"), "Must record old_role");
  assert(migrationSql.includes("new_role public.user_role not null"), "Must record new_role");
  assert(migrationSql.includes("old_all_companies boolean"), "Must record old_all_companies");
  assert(migrationSql.includes("new_all_companies boolean not null"), "Must record new_all_companies");
  assert(migrationSql.includes("old_allowed_companies text[]"), "Must record old_allowed_companies");
  assert(migrationSql.includes("new_allowed_companies text[] not null"), "Must record new_allowed_companies");
  assert(migrationSql.includes("old_is_active boolean"), "Must record old_is_active");
  assert(migrationSql.includes("new_is_active boolean not null"), "Must record new_is_active");
});

test("user_role_history RLS enforces immutability (disallow UPDATE and DELETE)", () => {
  assert(
    migrationSql.includes('create policy "Role history is immutable (no update)"'),
    "Must disallow updates to audit history"
  );
  assert(
    migrationSql.includes('create policy "Role history is immutable (no delete)"'),
    "Must disallow deletes from audit history"
  );
});

test("Database trigger trg_log_user_profile_changes automatically writes audit log on updates", () => {
  assert(
    migrationSql.includes("create or replace function public.log_user_profile_changes()"),
    "log_user_profile_changes trigger function must exist"
  );
  assert(
    migrationSql.includes("insert into public.user_role_history"),
    "Must insert record into user_role_history"
  );
});

// -------------------------------------------------------------
// 6. EDGE FUNCTION & SECURITY ARCHITECTURE
// -------------------------------------------------------------
console.log("\n--- 6. Edge Function & Admin Authentication Security ---");

test("admin-user-ops Edge Function verifies caller JWT and checks for SUPER_ADMIN role", () => {
  const edgeCode = fs.readFileSync(
    path.resolve("supabase/functions/admin-user-ops/index.ts"),
    "utf-8"
  );
  assert(
    edgeCode.includes("callerProfile.role !== \"SUPER_ADMIN\""),
    "Edge function must enforce caller role === SUPER_ADMIN"
  );
  assert(
    edgeCode.includes("callerProfile.is_active === false"),
    "Edge function must reject deactivated Super Admins"
  );
  assert(
    edgeCode.includes("SUPABASE_SERVICE_ROLE_KEY"),
    "Edge function safely accesses service role key exclusively server-side"
  );
});

test("Frontend code does NOT bundle or expose SUPABASE_SERVICE_ROLE_KEY", () => {
  const clientSupabase = fs.readFileSync(path.resolve("src/lib/supabase.ts"), "utf-8");
  assert(
    !clientSupabase.includes("SERVICE_ROLE") && !clientSupabase.includes("service_role"),
    "Client-side supabase.ts must never contain or reference service_role key"
  );
});

// -------------------------------------------------------------
// TEST SUMMARY
// -------------------------------------------------------------
console.log("\n=================================================================");
console.log(`  USER MANAGEMENT & RBAC TEST RESULTS: ${passedTests} / ${totalTests} PASSED`);
console.log("=================================================================\n");

if (passedTests !== totalTests) {
  process.exit(1);
}
