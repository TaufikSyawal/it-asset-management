// Comprehensive Automated E2E Test Suite for IT Asset Management System
import * as XLSX from "xlsx";

const BASE_URL = "http://localhost:3000";

let testPassed = 0;
let testFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    testPassed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    testFailed++;
  }
}

async function runTests() {
  console.log("🚀 Starting E2E Verification of IT Asset Management System...\n");

  // -----------------------------------------------------------
  // 1. Health & Database Connectivity
  // -----------------------------------------------------------
  console.log("👉 Test 1: Checking /api/health endpoint and PostgreSQL connection...");
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  assert(healthRes.status === 200, "Health endpoint returned HTTP 200");
  const healthData = await healthRes.json();
  assert(healthData.connected === true, "PostgreSQL connected: true");
  assert(healthData.tablesReady === true, "Schema tables ready: true");
  assert(healthData.counts.companies >= 3, `Companies seeded: ${healthData.counts.companies}`);
  assert(healthData.counts.employees >= 4, `Employees seeded: ${healthData.counts.employees}`);
  assert(healthData.counts.assets >= 6, `Assets seeded: ${healthData.counts.assets}`);

  // -----------------------------------------------------------
  // 2. Multi-Company Support (GMD, GMC, TEL)
  // -----------------------------------------------------------
  console.log("\n👉 Test 2: Checking /api/companies (GMD, GMC, TEL)...");
  const compRes = await fetch(`${BASE_URL}/api/companies`);
  assert(compRes.status === 200, "Companies endpoint returned HTTP 200");
  const compData = await compRes.json();
  const codes = compData.companies.map((c) => c.code);
  assert(codes.includes("GMD"), "Company GMD exists");
  assert(codes.includes("GMC"), "Company GMC exists");
  assert(codes.includes("TEL"), "Company TEL exists");

  const gmdCompany = compData.companies.find((c) => c.code === "GMD");
  const gmcCompany = compData.companies.find((c) => c.code === "GMC");

  // -----------------------------------------------------------
  // 3. Employee Directory
  // -----------------------------------------------------------
  console.log("\n👉 Test 3: Checking /api/employees directory...");
  const empRes = await fetch(`${BASE_URL}/api/employees`);
  assert(empRes.status === 200, "Employees endpoint returned HTTP 200");
  const empData = await empRes.json();
  assert(empData.employees.length >= 4, `Found ${empData.employees.length} employees`);
  const emp1 = empData.employees[0];
  const emp2 = empData.employees[1];
  assert(emp1 && emp1.name, `Sample employee verified: ${emp1?.name}`);

  // -----------------------------------------------------------
  // 4. Asset Listing & Dashboard Stats
  // -----------------------------------------------------------
  console.log("\n👉 Test 4: Checking /api/assets and dashboard metrics...");
  const assetRes = await fetch(`${BASE_URL}/api/assets`);
  assert(assetRes.status === 200, "Assets listing returned HTTP 200");
  const assetData = await assetRes.json();
  assert(assetData.assets.length > 0, `Returned ${assetData.assets.length} assets`);
  assert(assetData.stats !== null, "Stats object is populated");
  assert(assetData.stats.total >= 6, `Stats total: ${assetData.stats.total}`);
  assert(assetData.stats.inUse >= 1, `Stats inUse: ${assetData.stats.inUse}`);
  assert(assetData.stats.available >= 0, `Stats available: ${assetData.stats.available}`);
  assert(assetData.stats.duplicateTags >= 1, `Stats duplicateTags detected: ${assetData.stats.duplicateTags}`);

  // -----------------------------------------------------------
  // 5. CRUD: Create New Asset (with all 19+ fields, optional serial)
  // -----------------------------------------------------------
  console.log("\n👉 Test 5: Testing POST /api/assets (Asset Creation)...");
  const testAssetTag = `TEST-LPT-${Date.now().toString().slice(-4)}`;
  const createPayload = {
    assetTag: testAssetTag,
    assetName: "Dell Precision 5570 Workstation",
    companyId: gmdCompany.id,
    category: "LAPTOP",
    model: "Precision 5570",
    cpu: "Intel Core i7-12800H",
    ram: "32 GB DDR5",
    serialNumber: `SN-${Date.now().toString().slice(-6)}`,
    macAddress: "00:1B:44:11:3A:B7",
    status: "AVAILABLE",
    physicalCondition: "EXCELLENT",
    assignedEmployeeId: null,
    location: "IT Storage Room B",
    purchaseDate: "2024-05-10",
    purchaseCost: 28000000,
    usefulLifeMonths: 48,
    depreciationMethod: "STRAIGHT_LINE",
    laptopCode: "GMD-WKS-99",
    laptopAccount: "DEV-ADMIN",
    username: null,
    notes: "High performance development rig",
  };

  const createRes = await fetch(`${BASE_URL}/api/assets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(createPayload),
  });

  assert(createRes.status === 201, "Asset created with HTTP 201");
  const createdJson = await createRes.json();
  const createdAsset = createdJson.asset;
  assert(createdAsset.assetTag === testAssetTag, `Asset Tag matches: ${createdAsset.assetTag}`);
  assert(createdAsset.isDuplicateTag === false, "isDuplicateTag is initially false");
  assert(createdAsset.qrCodeToken.startsWith("QR-"), `QR Token generated: ${createdAsset.qrCodeToken}`);

  // -----------------------------------------------------------
  // 6. Duplicate Tag Preservation Test
  // -----------------------------------------------------------
  console.log("\n👉 Test 6: Testing Duplicate Asset Tag Preservation & Audit Flagging...");
  const duplicatePayload = {
    ...createPayload,
    serialNumber: `SN-DUP-${Date.now().toString().slice(-4)}`,
    assetName: "Second Device With Same Legacy Tag",
  };

  const dupRes = await fetch(`${BASE_URL}/api/assets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(duplicatePayload),
  });

  assert(dupRes.status === 201, "Duplicate tag asset accepted without error");
  const dupJson = await dupRes.json();
  assert(dupJson.asset.isDuplicateTag === true, "Newly inserted duplicate is flagged isDuplicateTag: true");
  assert(dupJson.duplicateNotice !== null, "Duplicate notice warning returned");

  // -----------------------------------------------------------
  // 7. Immutable Handover / Assignment Tracking
  // -----------------------------------------------------------
  console.log("\n👉 Test 7: Testing Handover Lifecycle & Immutable History...");
  // Step 7a: Assign to Employee 1
  const assignRes1 = await fetch(`${BASE_URL}/api/assets/${createdAsset.id}/assign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      actionType: "ASSIGN",
      employeeId: emp1.id,
      conditionAtAction: "EXCELLENT",
      handoverDocRef: "BAST-TEST-001",
      notes: "First handover to employee",
    }),
  });
  assert(assignRes1.status === 200, "First assignment completed");
  const assigned1Json = await assignRes1.json();
  assert(assigned1Json.asset.status === "IN_USE", "Asset status updated to IN_USE");
  assert(assigned1Json.asset.assignedEmployeeId === emp1.id, `Assigned to ${emp1.name}`);

  // Step 7b: Transfer to Employee 2
  const assignRes2 = await fetch(`${BASE_URL}/api/assets/${createdAsset.id}/assign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      actionType: "TRANSFER",
      employeeId: emp2.id,
      conditionAtAction: "GOOD",
      handoverDocRef: "BAST-TEST-002",
      notes: "Transferred to second employee",
    }),
  });
  assert(assignRes2.status === 200, "Transfer completed");
  const assigned2Json = await assignRes2.json();
  assert(assigned2Json.asset.assignedEmployeeId === emp2.id, `Transferred to ${emp2.name}`);

  // Step 7c: Return to storage
  const returnRes = await fetch(`${BASE_URL}/api/assets/${createdAsset.id}/assign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      actionType: "RETURN",
      conditionAtAction: "GOOD",
      handoverDocRef: "BAST-TEST-003",
      notes: "Returned to pool",
    }),
  });
  assert(returnRes.status === 200, "Return to storage completed");
  const returnedJson = await returnRes.json();
  assert(returnedJson.asset.status === "AVAILABLE", "Status is AVAILABLE after return");
  assert(returnedJson.asset.assignedEmployeeId === null, "Assigned employee cleared after return");

  // Step 7d: Verify complete immutable assignment history in GET /api/assets/[id]
  const detailRes = await fetch(`${BASE_URL}/api/assets/${createdAsset.id}`);
  assert(detailRes.status === 200, "Asset detail retrieved");
  const detailJson = await detailRes.json();
  const assignments = detailJson.asset.assignments || [];
  assert(assignments.length === 2, `History preserved: found ${assignments.length} assignments (expected 2)`);
  assert(assignments[0].returnedAt !== null, "Prior assignment has non-null returnedAt timestamp");
  assert(detailJson.asset.historyLogs.length >= 4, `Audit trail logs: ${detailJson.asset.historyLogs.length}`);

  // -----------------------------------------------------------
  // 8. CRUD: Edit Asset
  // -----------------------------------------------------------
  console.log("\n👉 Test 8: Testing PUT /api/assets/[id] (Edit Asset)...");
  const editRes = await fetch(`${BASE_URL}/api/assets/${createdAsset.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "HQ Floor 4 - Executive Suite",
      ram: "64 GB DDR5",
    }),
  });
  assert(editRes.status === 200, "Asset edit returned HTTP 200");
  const editedJson = await editRes.json();
  assert(editedJson.asset.location === "HQ Floor 4 - Executive Suite", "Location updated");
  assert(editedJson.asset.ram === "64 GB DDR5", "RAM updated");

  // -----------------------------------------------------------
  // 9. RBAC & Financial Data Masking
  // -----------------------------------------------------------
  console.log("\n👉 Test 9: Testing RBAC & Role-Based Field Masking...");
  // Switch to IT_ADMIN (Financials should be masked)
  await fetch(`${BASE_URL}/api/auth/role`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "IT_ADMIN" }),
  });

  const itAdminAssetRes = await fetch(`${BASE_URL}/api/assets`, {
    headers: { Cookie: "itams_active_role=IT_ADMIN" },
  });
  const itAdminAssetJson = await itAdminAssetRes.json();
  const firstAsset = itAdminAssetJson.assets[0];
  assert(firstAsset.purchaseCost === undefined, "purchaseCost is masked for IT_ADMIN role");
  assert(firstAsset.netBookValue === undefined, "netBookValue is masked for IT_ADMIN role");
  assert(itAdminAssetJson.stats.totalPurchaseCost === null, "Total financial stats are null for IT_ADMIN");

  // Switch back to SUPER_ADMIN (Financials should be visible)
  await fetch(`${BASE_URL}/api/auth/role`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "SUPER_ADMIN" }),
  });

  const superAdminAssetRes = await fetch(`${BASE_URL}/api/assets`, {
    headers: { Cookie: "itams_active_role=SUPER_ADMIN" },
  });
  const superAdminAssetJson = await superAdminAssetRes.json();
  const superAdminAsset = superAdminAssetJson.assets[0];
  assert(superAdminAsset.purchaseCost !== undefined, "purchaseCost is visible for SUPER_ADMIN role");
  assert(superAdminAssetJson.stats.totalPurchaseCost > 0, "Financial totals populated for SUPER_ADMIN");

  // -----------------------------------------------------------
  // 10. CRUD: Soft Archive Asset
  // -----------------------------------------------------------
  console.log("\n👉 Test 10: Testing DELETE /api/assets/[id] (Soft Archive)...");
  const deleteRes = await fetch(`${BASE_URL}/api/assets/${createdAsset.id}`, {
    method: "DELETE",
  });
  assert(deleteRes.status === 200, "Archive returned HTTP 200");
  const deleteJson = await deleteRes.json();
  assert(deleteJson.success === true, "Archive success: true");

  // -----------------------------------------------------------
  // 11. Excel Import Dry-Run & Schema Parsing
  // -----------------------------------------------------------
  console.log("\n👉 Test 11: Testing Excel Import Processing...");
  const sampleExcelRows = [
    {
      "Asset Tag": `IMP-TAG-${Date.now().toString().slice(-4)}`,
      "Asset Name": "HP EliteBook 840 G10",
      "Company": "GMC",
      "Model": "EliteBook 840",
      "CPU": "Intel Core i7-1355U",
      "RAM": "16 GB DDR5",
      "Serial Number": `SN-IMP-${Date.now().toString().slice(-4)}`,
      "Location": "GMC Branch Jakarta",
    },
  ];
  const ws = XLSX.utils.json_to_sheet(sampleExcelRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Inventory");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const formData = new FormData();
  formData.append("file", new Blob([buffer]), "test_inventory.xlsx");
  formData.append("dryRun", "true");

  const importRes = await fetch(`${BASE_URL}/api/import`, {
    method: "POST",
    body: formData,
  });
  assert(importRes.status === 200, "Import dry-run returned HTTP 200");
  const importJson = await importRes.json();
  assert(importJson.validRows === 1, "Parsed 1 valid row from Excel");
  assert(importJson.preview[0].companyCode === "GMC", "Parsed companyCode correctly as GMC");

  // -----------------------------------------------------------
  // 12. Frontend UI Render
  // -----------------------------------------------------------
  console.log("\n👉 Test 12: Checking Frontend UI HTML Render...");
  const pageRes = await fetch(`${BASE_URL}/`);
  assert(pageRes.status === 200, "Frontend page returned HTTP 200");
  const pageHtml = await pageRes.text();
  assert(pageHtml.includes("IT Asset Inventory"), "Page contains title 'IT Asset Inventory'");
  assert(pageHtml.includes("GMD"), "Page contains company GMD");
  assert(pageHtml.includes("GMC"), "Page contains company GMC");
  assert(pageHtml.includes("TEL"), "Page contains company TEL");

  // -----------------------------------------------------------
  // Summary
  // -----------------------------------------------------------
  console.log("\n==================================================");
  console.log(`🏁 Total Tests Passed: ${testPassed}`);
  console.log(`❌ Total Tests Failed: ${testFailed}`);
  console.log("==================================================");

  if (testFailed > 0) {
    process.exit(1);
  } else {
    console.log("🎉 ALL TESTS PASSED! System is fully verified.");
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

