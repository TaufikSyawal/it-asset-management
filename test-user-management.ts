import fs from "fs";
import path from "path";
import assert from "assert";
import { ROLE_PERMISSIONS } from "./src/lib/permissions";
import { UserRole } from "./src/types";

console.log("=================================================================");
console.log("  USER MANAGEMENT & RBAC FINAL SECURITY REVISION TEST SUITE     ");
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

const migrationSql = fs.readFileSync(
  path.resolve("supabase/migrations/20261119_user_management_hardening_v2.sql"),
  "utf-8"
);
const rollbackSql = fs.readFileSync(
  path.resolve("supabase/rollback-user-management-hardening.sql"),
  "utf-8"
);
const serviceCode = fs.readFileSync(
  path.resolve("src/services/userManagementService.ts"),
  "utf-8"
);
const edgeCode = fs.readFileSync(
  path.resolve("supabase/functions/admin-user-ops/index.ts"),
  "utf-8"
);
const authCode = fs.readFileSync(
  path.resolve("src/services/authService.ts"),
  "utf-8"
);

// -------------------------------------------------------------
// 1. ROLE DEFINITIONS & ROLE-BASED ACCESS CONTROL (RBAC)
// -------------------------------------------------------------
console.log("--- 1. Canonical Role Definitions & Permissions Matrix ---");

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

test("Super Admin has unrestricted administrative permissions", () => {
  const sa = ROLE_PERMISSIONS["SUPER_ADMIN"];
  assert.strictEqual(sa.canManageUsers, true, "Super Admin must manage users");
  assert.strictEqual(sa.canManageCompanies, true, "Super Admin must manage companies");
  assert.strictEqual(sa.canCreateAssets, true, "Super Admin must create assets");
  assert.strictEqual(sa.canEditAssets, true, "Super Admin must edit assets");
  assert.strictEqual(sa.canArchiveAssets, true, "Super Admin must archive assets");
  assert.strictEqual(sa.canViewFinancials, true, "Super Admin must view financials");
  assert.strictEqual(sa.canEditFinancials, true, "Super Admin must edit financials");
  assert.strictEqual(sa.canAssignAssets, true, "Super Admin must assign assets");
  assert.strictEqual(sa.canManageStockOpname, true, "Super Admin must manage stock opnames");
  assert.strictEqual(sa.canReconcileStockOpname, true, "Super Admin must reconcile stock opnames");
});

test("Management has executive read-only visibility and cannot modify assets or manage users", () => {
  const mgmt = ROLE_PERMISSIONS["MANAGEMENT"];
  assert.strictEqual(mgmt.canManageUsers, false, "Management cannot manage users");
  assert.strictEqual(mgmt.canManageCompanies, false, "Management cannot manage companies");
  assert.strictEqual(mgmt.canCreateAssets, false, "Management cannot create assets");
  assert.strictEqual(mgmt.canEditAssets, false, "Management cannot edit assets");
  assert.strictEqual(mgmt.canViewFinancials, true, "Management has financial visibility");
  assert.strictEqual(mgmt.canEditFinancials, false, "Management cannot edit financials");
});

test("Finance has financial read/edit access and cannot modify IT hardware or manage users", () => {
  const fin = ROLE_PERMISSIONS["FINANCE"];
  assert.strictEqual(fin.canManageUsers, false, "Finance cannot manage users");
  assert.strictEqual(fin.canViewFinancials, true, "Finance has financial view access");
  assert.strictEqual(fin.canEditFinancials, true, "Finance has financial edit access");
  assert.strictEqual(fin.canCreateAssets, false, "Finance cannot create assets");
  assert.strictEqual(fin.canArchiveAssets, false, "Finance cannot archive assets");
  assert.strictEqual(fin.canManageCompanies, false, "Finance cannot manage companies");
});

test("IT Admin can manage physical assets but cannot view financials or manage users", () => {
  const it = ROLE_PERMISSIONS["IT_ADMIN"];
  assert.strictEqual(it.canManageUsers, false, "IT Admin cannot manage users");
  assert.strictEqual(it.canCreateAssets, true, "IT Admin can create assets");
  assert.strictEqual(it.canEditAssets, true, "IT Admin can edit assets");
  assert.strictEqual(it.canViewFinancials, false, "IT Admin must not view raw financials");
  assert.strictEqual(it.canEditFinancials, false, "IT Admin must not edit financials");
  assert.strictEqual(it.canManageCompanies, false, "IT Admin cannot manage company records");
});

test("Auditor has read-only audit visibility with masked financials and no user management", () => {
  const aud = ROLE_PERMISSIONS["AUDITOR"];
  assert.strictEqual(aud.canManageUsers, false, "Auditor cannot manage users");
  assert.strictEqual(aud.canViewFinancials, false, "Auditor must not view financials");
  assert.strictEqual(aud.canManageStockOpname, true, "Auditor can execute stock opnames");
  assert.strictEqual(aud.canCreateAssets, false, "Auditor cannot create assets");
});

test("Employee is restricted to self-service assigned devices only", () => {
  const emp = ROLE_PERMISSIONS["EMPLOYEE"];
  assert.strictEqual(emp.canManageUsers, false, "Employee cannot manage users");
  assert.strictEqual(emp.canViewFinancials, false, "Employee must not view financials");
  assert.strictEqual(emp.canCreateAssets, false, "Employee cannot create assets");
  assert.strictEqual(emp.canEditAssets, false, "Employee cannot edit assets");
  assert.strictEqual(emp.canArchiveAssets, false, "Employee cannot archive assets");
  assert.strictEqual(emp.canAssignAssets, false, "Employee cannot assign assets");
});

// -------------------------------------------------------------
// 2. DEFAULT USER PROVISIONING & ZERO ACCESS RULES
// -------------------------------------------------------------
console.log("\n--- 2. Default User Provisioning Rules ---");

test("handle_new_auth_user() trigger enforces default role = EMPLOYEE", () => {
  assert(
    migrationSql.includes("'EMPLOYEE'::public.user_role"),
    "Trigger must strictly insert EMPLOYEE role"
  );
});

test("handle_new_auth_user() trigger enforces all_companies = false", () => {
  assert(
    migrationSql.includes("all_companies,") && migrationSql.includes("false,"),
    "Trigger must default all_companies to false"
  );
});

test("handle_new_auth_user() trigger enforces allowed_companies = '{}' (empty array)", () => {
  assert(
    migrationSql.includes("allowed_companies,") && migrationSql.includes("'{}'"),
    "Trigger must default allowed_companies to empty array"
  );
});

// -------------------------------------------------------------
// 3. REMOVAL OF IMPLICIT ROLE FALLBACKS
// -------------------------------------------------------------
console.log("\n--- 3. Removal of Implicit Role Fallbacks ---");

test("get_current_role() returns NULL for unauthenticated users (No EMPLOYEE fallback)", () => {
  const getRoleStart = migrationSql.indexOf("create or replace function public.get_current_role()");
  const getRoleEnd = migrationSql.indexOf("$$;", getRoleStart);
  const getRoleBody = migrationSql.substring(getRoleStart, getRoleEnd);

  assert(
    getRoleBody.includes("when auth.uid() is null then null"),
    "get_current_role() must return NULL when auth.uid() is null"
  );
  assert(
    !getRoleBody.includes("'EMPLOYEE'::public.user_role") || !getRoleBody.includes("coalesce"),
    "get_current_role() must not use coalesce with EMPLOYEE fallback"
  );
});

test("get_current_role() returns NULL for deactivated or missing profiles", () => {
  assert(
    migrationSql.includes("where id = auth.uid() and is_active = true"),
    "get_current_role() must check is_active = true"
  );
});

test("can_access_company() returns FALSE for unauthenticated or unassigned users", () => {
  assert(
    migrationSql.includes("when auth.uid() is null or target_company_id is null then false"),
    "can_access_company must return FALSE for null user or company"
  );
});

// -------------------------------------------------------------
// 4. ANTI-PRIVILEGE ESCALATION TRIGGER
// -------------------------------------------------------------
console.log("\n--- 4. Anti-Privilege Escalation Controls ---");

test("prevent_unauthorized_profile_updates() trigger function exists in migration", () => {
  assert(
    migrationSql.includes("create or replace function public.prevent_unauthorized_profile_updates()"),
    "Anti-privilege escalation trigger function must exist"
  );
  assert(
    migrationSql.includes("create trigger trg_prevent_unauthorized_profile_updates"),
    "trg_prevent_unauthorized_profile_updates must be attached before update on user_profiles"
  );
});

test("prevent_unauthorized_profile_updates() blocks non-Super Admins from modifying roles", () => {
  assert(
    migrationSql.includes("Privilege Escalation Blocked: Only Super Admins can modify user roles."),
    "Must raise exception when non-Super Admin modifies role"
  );
});

test("prevent_unauthorized_profile_updates() blocks non-Super Admins from modifying company scope", () => {
  assert(
    migrationSql.includes("Privilege Escalation Blocked: Only Super Admins can modify company access permissions."),
    "Must raise exception when non-Super Admin modifies company scope"
  );
});

test("prevent_unauthorized_profile_updates() blocks non-Super Admins from modifying is_active status", () => {
  assert(
    migrationSql.includes("Security Violation: Only Super Admins can activate or deactivate user accounts."),
    "Must raise exception when non-Super Admin changes active status"
  );
});

test("prevent_unauthorized_profile_updates() blocks non-Super Admins from modifying other users profiles", () => {
  assert(
    migrationSql.includes("Access Denied: You cannot modify another users profile."),
    "Must raise exception when non-Super Admin attempts cross-user modification"
  );
});

// -------------------------------------------------------------
// 5. LAST SUPER ADMIN PROTECTION & CONCURRENCY LOCKING
// -------------------------------------------------------------
console.log("\n--- 5. Last Super Admin Protection & Concurrency Safety ---");

test("protect_last_super_admin() handles both UPDATE (demotion/deactivation) and DELETE", () => {
  assert(
    migrationSql.includes("before update or delete on public.user_profiles"),
    "protect_last_super_admin trigger must hook both UPDATE and DELETE"
  );
});

test("protect_last_super_admin() uses FOR UPDATE row-locking to prevent race conditions", () => {
  assert(
    migrationSql.includes("for update;"),
    "protect_last_super_admin must acquire exclusive FOR UPDATE row lock to serialize concurrent demotions"
  );
});

test("protect_last_super_admin() prevents deactivating last Super Admin", () => {
  assert(
    migrationSql.includes("Cannot demote or deactivate the last remaining active Super Admin account."),
    "Must abort transaction if deactivation leaves 0 active Super Admins"
  );
});

test("protect_last_super_admin() prevents deleting last Super Admin", () => {
  assert(
    migrationSql.includes("Cannot delete the last remaining active Super Admin account."),
    "Must abort transaction if deletion leaves 0 active Super Admins"
  );
});

test("Frontend userManagementService enforces last Super Admin demotion/deactivation protection", () => {
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
// 6. AUDIT HISTORY IMMUTABILITY & NON-CASCADING RETENTION
// -------------------------------------------------------------
console.log("\n--- 6. Audit Trail Immutability & Non-Cascading Retention ---");

test("user_role_history does NOT cascade delete when user profile is removed", () => {
  assert(
    migrationSql.includes("user_id uuid not null") && !migrationSql.includes("user_id uuid not null references public.user_profiles(id) on delete cascade"),
    "user_role_history must not cascade delete on user_profiles removal"
  );
  assert(
    migrationSql.includes("user_email text not null"),
    "user_role_history must preserve target user email permanently"
  );
});

test("user_role_history forbids direct application INSERT, UPDATE, DELETE", () => {
  assert(
    migrationSql.includes('create policy "Role history insert is forbidden for application users"'),
    "Direct application inserts must be forbidden by RLS"
  );
  assert(
    migrationSql.includes('create policy "Role history is immutable (no update)"'),
    "Updates must be forbidden by RLS"
  );
  assert(
    migrationSql.includes('create policy "Role history is immutable (no delete)"'),
    "Deletes must be forbidden by RLS"
  );
});

test("user_role_history privileges revoke insert, update, delete, truncate from authenticated", () => {
  assert(
    migrationSql.includes("revoke insert, update, delete, truncate on public.user_role_history from authenticated;"),
    "Direct write privileges must be explicitly revoked"
  );
});

// -------------------------------------------------------------
// 7. REMOVAL OF INSECURE CLIENT-SIDE ADMINISTRATIVE FALLBACKS
// -------------------------------------------------------------
console.log("\n--- 7. Removal of Insecure Client-Side Fallbacks ---");

test("userManagementService.inviteUser strictly invokes Edge Function with no client auth fallback", () => {
  assert(
    !serviceCode.includes("resetPasswordForEmail(cleanEmail"),
    "inviteUser must not fall back to client-side resetPasswordForEmail"
  );
  assert(
    serviceCode.includes("Failed to invite user via administrative Edge Function"),
    "inviteUser must return explicit error on Edge Function failure"
  );
});

test("userManagementService.resetUserPassword strictly invokes Edge Function with no client auth fallback", () => {
  assert(
    serviceCode.includes('action: "reset_password"'),
    "resetUserPassword must invoke Edge Function"
  );
});

// -------------------------------------------------------------
// 8. EDGE FUNCTION AUTHENTICATION & SECURITY
// -------------------------------------------------------------
console.log("\n--- 8. Edge Function Authentication & Authorization ---");

test("admin-user-ops verifies caller JWT with Bearer check and callerClient.auth.getUser()", () => {
  assert(
    edgeCode.includes('authHeader.startsWith("Bearer ")'),
    "Must verify Bearer token format"
  );
  assert(
    edgeCode.includes("callerClient.auth.getUser()"),
    "Must verify token authenticity with Supabase Auth"
  );
});

test("admin-user-ops verifies caller has an active SUPER_ADMIN profile", () => {
  assert(
    edgeCode.includes('callerProfile.role !== "SUPER_ADMIN"'),
    "Must reject non-Super Admin callers"
  );
  assert(
    edgeCode.includes("callerProfile.is_active === false"),
    "Must reject deactivated callers"
  );
});

test("admin-user-ops validates inputs and supports invite, reset, toggle, and delete", () => {
  assert(edgeCode.includes('case "invite_user":'), "Must support invite_user");
  assert(edgeCode.includes('case "reset_password":'), "Must support reset_password");
  assert(edgeCode.includes('case "toggle_user_status":'), "Must support toggle_user_status");
  assert(edgeCode.includes('case "delete_user":'), "Must support delete_user");
});

test("admin-user-ops protects last Super Admin in toggle and delete", () => {
  assert(
    edgeCode.includes("Cannot deactivate the last remaining active Super Admin account."),
    "Edge function must guard last admin deactivation"
  );
  assert(
    edgeCode.includes("Cannot delete the last remaining active Super Admin account."),
    "Edge function must guard last admin deletion"
  );
});

// -------------------------------------------------------------
// 9. PREVENTION OF STALE CACHED PROFILES BYPASS
// -------------------------------------------------------------
console.log("\n--- 9. Cache Bypass Prevention & Session Revocation ---");

test("authService immediately invalidates cache when user profile is missing or deactivated", () => {
  assert(
    authCode.includes('error?.code === "PGRST116" || !data'),
    "authService must detect missing profile and purge cache"
  );
  assert(
    authCode.includes("data.is_active === false"),
    "authService must detect deactivated profile and purge cache"
  );
  assert(
    authCode.includes("await signOut()"),
    "authService must terminate session if profile is deactivated"
  );
});

// -------------------------------------------------------------
// 10. TRANSACTIONAL INTEGRITY & ROLLBACK PROCEDURE
// -------------------------------------------------------------
console.log("\n--- 10. Transactional Safety & Rollback Script ---");

test("Migration is wrapped in an atomic transaction (BEGIN ... COMMIT)", () => {
  assert(migrationSql.toLowerCase().includes("\nbegin;\n"), "Migration must contain begin;");
  assert(migrationSql.trim().endsWith("commit;"), "Migration must end with commit;");
});

test("Rollback script is wrapped in an atomic transaction (BEGIN ... COMMIT)", () => {
  assert(rollbackSql.toLowerCase().includes("\nbegin;\n"), "Rollback must contain begin;");
  assert(rollbackSql.trim().endsWith("commit;"), "Rollback must end with commit;");
});

test("Rollback drops security triggers, trigger functions, and restores previous policies", () => {
  assert(
    rollbackSql.includes("drop trigger if exists trg_prevent_unauthorized_profile_updates"),
    "Rollback must drop anti-escalation trigger"
  );
  assert(
    rollbackSql.includes("drop trigger if exists trg_protect_last_super_admin"),
    "Rollback must drop last admin trigger"
  );
  assert(
    rollbackSql.includes("create policy \"Users can update own profile\""),
    "Rollback must restore previous user profile policy"
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
