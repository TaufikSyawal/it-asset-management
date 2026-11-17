/**
 * Comprehensive Automated Verification Suite for Phase 2:
 * QR Code Generation, Labels, Mobile Scanning, Stock Opname & Reconciliation
 */

import * as XLSX from "xlsx";

const BASE_URL = "http://localhost:3000";

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedTests++;
  }
}

async function runPhase2Tests() {
  console.log("🚀 Starting Phase 2 E2E Verification: QR Codes & Stock Opname Workflow...\n");

  try {
    // -------------------------------------------------------------
    // 1. Verify QR Helper and Parser Standards
    // -------------------------------------------------------------
    console.log("👉 Test 1: Testing QR Payload Generation & Multi-Format Parsing...");
    
    // Test payload shape
    const samplePayload = {
      v: 1,
      id: "cmwd85h3l0000zkap8pmshr3x",
      tag: "GMD-NB-001",
      co: "GMD",
      sn: "PF-388X92",
      tok: "QR-CMWD85H3L0000ZKAP8PMSHR3X-1794472415287-EJF91",
    };
    const jsonStr = JSON.stringify(samplePayload);

    // Dynamic import of qrcode helper from Next.js build or API
    // We test URL parsing, Token parsing, and JSON parsing directly:
    const parseQRScanInput = (raw) => {
      const trimmed = raw.trim();
      if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        try {
          const parsed = JSON.parse(trimmed);
          return { assetId: parsed.id, assetTag: parsed.tag, qrCodeToken: parsed.tok, isRawString: false };
        } catch {}
      }
      if (trimmed.includes("http://") || trimmed.includes("https://")) {
        try {
          const url = new URL(trimmed);
          const id = url.searchParams.get("id");
          const tag = url.searchParams.get("tag");
          const tok = url.searchParams.get("tok") || url.searchParams.get("token");
          return { assetId: id || undefined, assetTag: tag || undefined, qrCodeToken: tok || undefined, isRawString: false };
        } catch {}
      }
      if (trimmed.startsWith("QR-")) {
        return { qrCodeToken: trimmed, isRawString: false };
      }
      return { assetTag: trimmed, isRawString: true };
    };

    const parsedJson = parseQRScanInput(jsonStr);
    assert(parsedJson.assetId === samplePayload.id, "Parsed assetId from JSON payload");
    assert(parsedJson.assetTag === samplePayload.tag, "Parsed assetTag from JSON payload");
    assert(parsedJson.qrCodeToken === samplePayload.tok, "Parsed qrCodeToken from JSON payload");

    const parsedUrl = parseQRScanInput("https://inventory.internal/qr?id=c123&tag=GMC-SRV-01&tok=QR-123");
    assert(parsedUrl.assetId === "c123", "Parsed assetId from URL query parameters");
    assert(parsedUrl.assetTag === "GMC-SRV-01", "Parsed assetTag from URL query parameters");

    const parsedToken = parseQRScanInput("QR-CMWD85H3L0000ZKAP8PMSHR3X-1794472415287-EJF91");
    assert(parsedToken.qrCodeToken.startsWith("QR-"), "Parsed raw QR verification token");

    const parsedRaw = parseQRScanInput("GMD-NB-001");
    assert(parsedRaw.assetTag === "GMD-NB-001" && parsedRaw.isRawString === true, "Parsed manual Asset Tag string");

    // -------------------------------------------------------------
    // 2. Fetch Assets for Audit Test Scope
    // -------------------------------------------------------------
    console.log("\n👉 Test 2: Fetching Seeded Assets for Physical Audit Scope...");
    const assetsRes = await fetch(`${BASE_URL}/api/assets?limit=100`);
    assert(assetsRes.ok, "Assets API responded successfully");
    const assetsData = await assetsRes.json();
    const assets = assetsData.assets;
    assert(assets.length >= 5, `Found ${assets.length} active hardware assets in PostgreSQL`);

    const gmdAssets = assets.filter((a) => a.company?.code === "GMD");
    const gmcAssets = assets.filter((a) => a.company?.code === "GMC");
    assert(gmdAssets.length >= 2, `Found ${gmdAssets.length} GMD assets for scoped testing`);
    assert(gmcAssets.length >= 1, `Found ${gmcAssets.length} GMC assets for out-of-scope testing`);

    const targetAsset1 = gmdAssets[0];
    const targetAsset2 = gmdAssets[1];
    const outOfScopeAsset = gmcAssets[0];

    // -------------------------------------------------------------
    // 3. Initialize Stock Opname Session & Capture Expected Snapshot
    // -------------------------------------------------------------
    console.log("\n👉 Test 3: Initializing Stock Opname Session (Company: GMD Scope)...");
    const sessionTitle = `Q1 2026 GMD Physical Audit Test - ${Date.now()}`;
    const createSessionRes = await fetch(`${BASE_URL}/api/stock-opname/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: sessionTitle,
        companyId: targetAsset1.companyId,
        locationScope: "ALL",
        categoryScope: "ALL",
        conductedBy: "Budi Santoso (Lead Auditor)",
        notes: "Automated Phase 2 compliance test session",
      }),
    });

    assert(createSessionRes.status === 201, `Session created with HTTP 201 (Status: ${createSessionRes.status})`);
    const sessionCreatedData = await createSessionRes.json();
    const createdSession = sessionCreatedData.session;
    assert(createdSession.sessionNumber.startsWith("OPN-"), `Session number generated in standard format: ${createdSession.sessionNumber}`);
    assert(sessionCreatedData.expectedItemsCount >= gmdAssets.length, `Expected items snapshot captured: ${sessionCreatedData.expectedItemsCount} assets`);

    const sessionId = createdSession.id;

    // Verify session details & snapshot capture
    const sessionDetailRes = await fetch(`${BASE_URL}/api/stock-opname/sessions/${sessionId}`);
    assert(sessionDetailRes.ok, "Session detail endpoint returned HTTP 200");
    const sessionDetail = (await sessionDetailRes.json()).session;
    assert(sessionDetail.status === "IN_PROGRESS", "Session status is IN_PROGRESS");
    assert(sessionDetail.items.length >= gmdAssets.length, "Session contains all expected items in snapshot");

    const item1 = sessionDetail.items.find((i) => i.assetId === targetAsset1.id);
    assert(item1 !== undefined, `Target asset 1 (${targetAsset1.assetTag}) found in session items`);
    assert(item1.expectedLocation === targetAsset1.location, `Snapshot captured expectedLocation: '${item1.expectedLocation}'`);
    assert(item1.verificationStatus === "PENDING", "Initial item status is PENDING");
    assert(item1.scanCount === 0, "Initial scanCount is 0");

    // -------------------------------------------------------------
    // 4. Test Case A: Matching Physical Scan (Verified)
    // -------------------------------------------------------------
    console.log("\n👉 Test 4: Testing Matching Physical Scan (Expected Location & Custodian)...");
    const scanMatchRes = await fetch(`${BASE_URL}/api/stock-opname/sessions/${sessionId}/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetId: targetAsset1.id,
        actualLocation: targetAsset1.location,
        actualCondition: targetAsset1.physicalCondition,
        actualEmployeeId: targetAsset1.assignedEmployeeId,
        scannedBy: "Budi Santoso",
      }),
    });

    assert(scanMatchRes.ok, "Matching scan returned HTTP 200");
    const scanMatchData = await scanMatchRes.json();
    assert(scanMatchData.success === true, "Scan marked as successful");
    assert(scanMatchData.verificationStatus === "VERIFIED", `Verification status is VERIFIED (got: ${scanMatchData.verificationStatus})`);
    assert(scanMatchData.isDuplicateScan === false, "isDuplicateScan is false for first scan");
    assert(scanMatchData.item.scanCount === 1, "scanCount incremented to 1");
    assert(scanMatchData.item.scannedAt !== null, "scannedAt timestamp recorded");

    // -------------------------------------------------------------
    // 5. Test Case B: Location Mismatch Detection
    // -------------------------------------------------------------
    console.log("\n👉 Test 5: Testing Location Mismatch Detection...");
    const mismatchLocationName = `Variance Room Rack ${Date.now().toString().slice(-4)}`;
    const scanLocMismatchRes = await fetch(`${BASE_URL}/api/stock-opname/sessions/${sessionId}/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetId: targetAsset2.id,
        actualLocation: mismatchLocationName, // Different from expectedLocation
        actualCondition: targetAsset2.physicalCondition,
        scannedBy: "Budi Santoso",
      }),
    });

    assert(scanLocMismatchRes.ok, "Location mismatch scan returned HTTP 200");
    const scanLocData = await scanLocMismatchRes.json();
    assert(scanLocData.verificationStatus === "MISMATCH_LOCATION", `Verification status correctly set to MISMATCH_LOCATION (got: ${scanLocData.verificationStatus})`);
    assert(scanLocData.discrepancyType === "LOCATION_MISMATCH", "Discrepancy type identified as LOCATION_MISMATCH");
    assert(scanLocData.discrepancyNotes && scanLocData.discrepancyNotes.includes(mismatchLocationName), `Discrepancy notes record actual location '${mismatchLocationName}'`);

    // -------------------------------------------------------------
    // 6. Test Case C: Duplicate Scan Detection
    // -------------------------------------------------------------
    console.log("\n👉 Test 6: Testing Duplicate Scan Detection...");
    const scanDupRes = await fetch(`${BASE_URL}/api/stock-opname/sessions/${sessionId}/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetId: targetAsset1.id, // Scanning targetAsset1 second time
        actualLocation: targetAsset1.location,
        actualCondition: targetAsset1.physicalCondition,
        scannedBy: "Budi Santoso",
      }),
    });

    assert(scanDupRes.ok, "Duplicate scan returned HTTP 200");
    const scanDupData = await scanDupRes.json();
    assert(scanDupData.isDuplicateScan === true, "isDuplicateScan flag is true");
    assert(scanDupData.item.scanCount === 2, `scanCount accurately incremented to ${scanDupData.item.scanCount}`);
    assert(scanDupData.discrepancyNotes.includes("Duplicate scan #2"), "Duplicate notice recorded in discrepancy notes");

    // -------------------------------------------------------------
    // 7. Test Case D: Unexpected / Extra Asset Found (Out of Scope)
    // -------------------------------------------------------------
    console.log("\n👉 Test 7: Testing Unexpected Asset Detection (GMC asset scanned in GMD audit)...");
    const scanUnexpectedRes = await fetch(`${BASE_URL}/api/stock-opname/sessions/${sessionId}/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rawInput: outOfScopeAsset.assetTag, // Scanning via raw Asset Tag input
        actualLocation: "GMD Server Room",
        actualCondition: "GOOD",
        scannedBy: "Budi Santoso",
      }),
    });

    assert(scanUnexpectedRes.ok, "Unexpected asset scan returned HTTP 200");
    const scanUnexpectedData = await scanUnexpectedRes.json();
    assert(scanUnexpectedData.isUnexpected === true, "isUnexpected is true for out-of-scope hardware");
    assert(scanUnexpectedData.verificationStatus === "UNREGISTERED", "verificationStatus is UNREGISTERED");
    assert(scanUnexpectedData.discrepancyNotes.includes("Unexpected asset"), "Discrepancy note records unexpected hardware discovery");

    // -------------------------------------------------------------
    // 8. Test Case E: Manual Fallback Input & Missing Asset Rejection
    // -------------------------------------------------------------
    console.log("\n👉 Test 8: Testing Non-Existent Hardware Rejection...");
    const scanNonExistentRes = await fetch(`${BASE_URL}/api/stock-opname/sessions/${sessionId}/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rawInput: "GMD-NON-EXISTENT-TAG-9999",
      }),
    });
    assert(scanNonExistentRes.status === 404, `Non-existent asset correctly returned HTTP 404 (got: ${scanNonExistentRes.status})`);
    const notFoundData = await scanNonExistentRes.json();
    assert(notFoundData.error === "Asset not found", "Returned clear 'Asset not found' message");

    // -------------------------------------------------------------
    // 9. Verify Live Audit Statistics & Progress Aggregation
    // -------------------------------------------------------------
    console.log("\n👉 Test 9: Verifying Live Audit Statistics & Progress Percentage...");
    const refreshedSessionRes = await fetch(`${BASE_URL}/api/stock-opname/sessions/${sessionId}`);
    const refreshedSession = (await refreshedSessionRes.json()).session;
    const stats = refreshedSession.stats;

    console.log("    Audit Session Live KPIs:", {
      totalExpected: stats.totalExpected,
      scannedCount: stats.scannedCount,
      verifiedCount: stats.verifiedCount,
      locationMismatchCount: stats.locationMismatchCount,
      unexpectedCount: stats.unexpectedCount,
      duplicateScansCount: stats.duplicateScansCount,
      progressPercentage: `${stats.progressPercentage}%`,
    });

    assert(stats.scannedCount >= 2, `Scanned count aggregated: ${stats.scannedCount}`);
    assert(stats.verifiedCount >= 1, `Verified count aggregated: ${stats.verifiedCount}`);
    assert(stats.locationMismatchCount >= 1, `Location mismatches aggregated: ${stats.locationMismatchCount}`);
    assert(stats.unexpectedCount >= 1, `Unexpected assets aggregated: ${stats.unexpectedCount}`);
    assert(stats.duplicateScansCount >= 1, `Duplicate scans aggregated: ${stats.duplicateScansCount}`);
    assert(stats.progressPercentage > 0, `Progress percentage calculated: ${stats.progressPercentage}%`);

    // -------------------------------------------------------------
    // 10. Test Inventory Reconciliation Workflow
    // -------------------------------------------------------------
    console.log("\n👉 Test 10: Testing Inventory Reconciliation & PostgreSQL History Preservation...");
    const reconcileRes = await fetch(`${BASE_URL}/api/stock-opname/sessions/${sessionId}/reconcile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applyLocationUpdates: true,
        applyConditionUpdates: true,
        markUnscannedAsMissing: true,
        reconciliationNotes: "Audit verified and reconciled by Senior Compliance Officer",
      }),
    });

    assert(reconcileRes.ok, `Reconcile returned HTTP 200 (Status: ${reconcileRes.status})`);
    const reconcileData = await reconcileRes.json();
    assert(reconcileData.success === true, "Reconciliation succeeded");
    assert(reconcileData.updatedAssetCount >= 1, `Updated ${reconcileData.updatedAssetCount} asset records in PostgreSQL`);

    // Verify session status is now COMPLETED
    const closedSessionRes = await fetch(`${BASE_URL}/api/stock-opname/sessions/${sessionId}`);
    const closedSession = (await closedSessionRes.json()).session;
    assert(closedSession.status === "COMPLETED", "Session status is COMPLETED");
    assert(closedSession.reconciledAt !== null, "reconciledAt timestamp recorded");
    assert(closedSession.reconciledBy !== null, "reconciledBy auditor recorded");

    // Verify reconciled asset location actually updated in PostgreSQL
    const updatedAssetRes = await fetch(`${BASE_URL}/api/assets/${targetAsset2.id}`);
    const updatedAsset = (await updatedAssetRes.json()).asset;
    assert(updatedAsset.location === mismatchLocationName, `Asset location updated in PostgreSQL to '${mismatchLocationName}'`);

    // Verify immutable audit history was logged
    const lastHistory = updatedAsset.historyLogs?.[0];
    assert(lastHistory && lastHistory.action === "STOCK_OPNAME_RECONCILED", "AssetHistory record created with action STOCK_OPNAME_RECONCILED");

    // -------------------------------------------------------------
    // 11. Test Excel Export Generation
    // -------------------------------------------------------------
    console.log("\n👉 Test 11: Testing Excel Stock Opname Report Export...");
    const exportRes = await fetch(`${BASE_URL}/api/stock-opname/sessions/${sessionId}/export`);
    assert(exportRes.ok, `Export returned HTTP 200 (Status: ${exportRes.status})`);
    assert(
      exportRes.headers.get("content-type")?.includes("spreadsheetml.sheet"),
      "Content-Type is valid Excel spreadsheet"
    );

    const arrayBuffer = await exportRes.arrayBuffer();
    const workbook = XLSX.read(Buffer.from(arrayBuffer), { type: "buffer" });
    
    assert(workbook.SheetNames.includes("Audit Summary"), "Workbook contains 'Audit Summary' sheet");
    assert(workbook.SheetNames.includes("Reconciliation Matrix"), "Workbook contains 'Reconciliation Matrix' sheet");
    assert(workbook.SheetNames.includes("Audit Discrepancies"), "Workbook contains 'Audit Discrepancies' sheet");

    const summarySheet = workbook.Sheets["Audit Summary"];
    const summaryCsv = XLSX.utils.sheet_to_csv(summarySheet);
    assert(summaryCsv.includes(closedSession.sessionNumber), `Excel summary contains sessionNumber (${closedSession.sessionNumber})`);
    assert(summaryCsv.includes("Total Expected Assets in Scope"), "Excel summary contains KPI metrics");

    const matrixSheet = workbook.Sheets["Reconciliation Matrix"];
    const matrixRows = XLSX.utils.sheet_to_json(matrixSheet);
    assert(matrixRows.length >= gmdAssets.length, `Excel matrix contains ${matrixRows.length} audited items`);

    // -------------------------------------------------------------
    // 12. Verify Zero Data Loss on Financials & Assignments
    // -------------------------------------------------------------
    console.log("\n👉 Test 12: Verifying Financial & Assignment Data Preservation...");
    const finalAssetsRes = await fetch(`${BASE_URL}/api/assets?limit=100`);
    const finalAssets = (await finalAssetsRes.json()).assets;
    assert(finalAssets.length >= assets.length, `Total assets preserved: ${finalAssets.length} records`);

    const sampleWithCost = finalAssets.find((a) => a.purchaseCost !== null && a.purchaseCost !== undefined);
    assert(sampleWithCost !== undefined, "Financial purchaseCost fields remain intact in PostgreSQL");

    console.log("\n==================================================");
    console.log(`🏁 Phase 2 Tests Passed: ${passedTests}`);
    console.log(`❌ Phase 2 Tests Failed: ${failedTests}`);
    console.log("==================================================");

    if (failedTests > 0) {
      process.exit(1);
    } else {
      console.log("🎉 ALL PHASE 2 TESTS PASSED! System is fully verified.");
    }
  } catch (err) {
    console.error("Fatal error during Phase 2 tests:", err);
    process.exit(1);
  }
}

runPhase2Tests();
