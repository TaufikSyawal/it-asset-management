// Comprehensive Automated Test Suite for Asset Photo Documentation
import sharp from "sharp";
import fs from "fs/promises";
import path from "path";

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

async function createTestImageBuffer(format = "jpeg", width = 800, height = 600, label = "Test Image") {
  // Create an SVG text canvas and render to requested format via sharp
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#1e293b"/>
      <circle cx="${width / 2}" cy="${height / 2}" r="${Math.min(width, height) / 3}" fill="#3b82f6"/>
      <text x="50%" y="50%" font-size="28" font-family="sans-serif" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">
        ${label}
      </text>
    </svg>
  `;

  let instance = sharp(Buffer.from(svg));
  if (format === "jpeg") {
    return await instance.jpeg({ quality: 90 }).toBuffer();
  } else if (format === "png") {
    return await instance.png().toBuffer();
  } else if (format === "webp") {
    return await instance.webp({ quality: 90 }).toBuffer();
  }
  return await instance.png().toBuffer();
}

async function runTests() {
  console.log("🚀 Starting Automated Test Suite for Asset Photo Documentation...\n");

  // -----------------------------------------------------------
  // 1. Fetch Assets to Pick a Target Asset
  // -----------------------------------------------------------
  console.log("👉 Test 1: Fetching asset inventory as IT_ADMIN...");
  const assetsRes = await fetch(`${BASE_URL}/api/assets?limit=5`, {
    headers: { Cookie: "itams_active_role=IT_ADMIN" },
  });
  assert(assetsRes.status === 200, "Assets endpoint returned HTTP 200");
  const assetsData = await assetsRes.json();
  assert(Array.isArray(assetsData.assets) && assetsData.assets.length > 0, `Fetched ${assetsData.assets.length} assets`);

  const targetAsset = assetsData.assets[0];
  console.log(`   Target Asset: ${targetAsset.assetTag} - ${targetAsset.assetName} (ID: ${targetAsset.id})`);

  // -----------------------------------------------------------
  // 2. Role-Based Access Control (RBAC) Enforcement
  // -----------------------------------------------------------
  console.log("\n👉 Test 2: Testing RBAC enforcement on photo upload...");
  const dummyJpeg = await createTestImageBuffer("jpeg", 400, 300, "RBAC Check");

  // Employee attempt -> Forbidden (403)
  const employeeForm = new FormData();
  employeeForm.append("file", new Blob([dummyJpeg], { type: "image/jpeg" }), "unauthorized.jpg");
  employeeForm.append("category", "MAIN_PHOTO");

  const empRes = await fetch(`${BASE_URL}/api/assets/${targetAsset.id}/photos`, {
    method: "POST",
    headers: { Cookie: "itams_active_role=EMPLOYEE" },
    body: employeeForm,
  });
  assert(empRes.status === 403, "EMPLOYEE role is forbidden from uploading photos (HTTP 403)");

  // -----------------------------------------------------------
  // 3. Security: Magic Byte Validation & File Integrity
  // -----------------------------------------------------------
  console.log("\n👉 Test 3: Testing binary magic byte verification against spoofed files...");
  // Attempt uploading a text/script payload disguised as .jpg
  const fakeForm = new FormData();
  const fakePayload = Buffer.from("console.log('malicious script pretending to be image');");
  fakeForm.append("file", new Blob([fakePayload], { type: "image/jpeg" }), "exploit.jpg");
  fakeForm.append("category", "MAIN_PHOTO");

  const fakeRes = await fetch(`${BASE_URL}/api/assets/${targetAsset.id}/photos`, {
    method: "POST",
    headers: { Cookie: "itams_active_role=IT_ADMIN" },
    body: fakeForm,
  });
  assert(fakeRes.status === 400, "Spoofed image with invalid magic bytes rejected (HTTP 400)");
  const fakeJson = await fakeRes.json();
  assert(fakeJson.error && fakeJson.error.includes("not a valid image format"), `Rejection reason: "${fakeJson.error}"`);

  // -----------------------------------------------------------
  // 4. Valid Multi-Photo Upload with Category & Primary Flag
  // -----------------------------------------------------------
  console.log("\n👉 Test 4: Uploading genuine JPEG and PNG photos with metadata...");
  const mainPhotoBuffer = await createTestImageBuffer("jpeg", 1200, 800, "MacBook Pro Main Front");
  const serialPhotoBuffer = await createTestImageBuffer("png", 600, 400, "Serial Tag C02F876QMD6T");

  // Upload Photo 1: Main photo set as primary
  const uploadForm1 = new FormData();
  uploadForm1.append("file", new Blob([mainPhotoBuffer], { type: "image/jpeg" }), "macbook_front.jpg");
  uploadForm1.append("category", "MAIN_PHOTO");
  uploadForm1.append("description", "Physical overview of laptop in excellent cosmetic condition");
  uploadForm1.append("isPrimary", "true");

  const uploadRes1 = await fetch(`${BASE_URL}/api/assets/${targetAsset.id}/photos`, {
    method: "POST",
    headers: { Cookie: "itams_active_role=IT_ADMIN" },
    body: uploadForm1,
  });
  assert(uploadRes1.status === 201, "Main photo uploaded successfully (HTTP 201)");
  const uploadData1 = await uploadRes1.json();
  assert(uploadData1.photos.length === 1, "Returned 1 created photo record");
  const photo1 = uploadData1.photos[0];
  assert(photo1.isPrimary === true, "Photo 1 flagged as isPrimary: true");
  assert(photo1.category === "MAIN_PHOTO", "Photo 1 category is MAIN_PHOTO");
  assert(photo1.url && photo1.thumbnailUrl, "Photo 1 has relative streaming URLs");

  // Upload Photo 2: Serial Number Photo
  const uploadForm2 = new FormData();
  uploadForm2.append("file", new Blob([serialPhotoBuffer], { type: "image/png" }), "serial_tag.png");
  uploadForm2.append("category", "SERIAL_NUMBER");
  uploadForm2.append("description", "Underside chassis engraving clearly showing serial number");

  const uploadRes2 = await fetch(`${BASE_URL}/api/assets/${targetAsset.id}/photos`, {
    method: "POST",
    headers: { Cookie: "itams_active_role=IT_ADMIN" },
    body: uploadForm2,
  });
  assert(uploadRes2.status === 201, "Serial number photo uploaded successfully (HTTP 201)");
  const uploadData2 = await uploadRes2.json();
  const photo2 = uploadData2.photos[0];
  assert(photo2.isPrimary === false, "Photo 2 isPrimary is false");
  assert(photo2.category === "SERIAL_NUMBER", "Photo 2 category is SERIAL_NUMBER");

  // -----------------------------------------------------------
  // 5. Verify Photo List Endpoint & Asset Integration
  // -----------------------------------------------------------
  console.log("\n👉 Test 5: Verifying /api/assets/[id]/photos and /api/assets/[id] data...");
  const listPhotosRes = await fetch(`${BASE_URL}/api/assets/${targetAsset.id}/photos`, {
    headers: { Cookie: "itams_active_role=IT_ADMIN" },
  });
  assert(listPhotosRes.status === 200, "GET /api/assets/[id]/photos returned HTTP 200");
  const listPhotosData = await listPhotosRes.json();
  assert(listPhotosData.photos.length >= 2, `Retrieved ${listPhotosData.photos.length} photos for asset`);

  // Verify Asset Details include photo metadata and primaryPhoto
  const assetDetailRes = await fetch(`${BASE_URL}/api/assets/${targetAsset.id}`, {
    headers: { Cookie: "itams_active_role=IT_ADMIN" },
  });
  const assetDetailData = await assetDetailRes.json();
  assert(assetDetailData.asset.photos && assetDetailData.asset.photos.length >= 2, "Asset detail contains photos array");
  assert(assetDetailData.asset.primaryPhoto !== null, "Asset detail contains primaryPhoto object");
  assert(assetDetailData.asset.primaryPhoto.id === photo1.id, `primaryPhoto points to photo1 (${photo1.id})`);

  // -----------------------------------------------------------
  // 6. Test Photo Streaming and Thumbnail Serving
  // -----------------------------------------------------------
  console.log("\n👉 Test 6: Testing private photo streaming and thumbnail generation...");
  // Main photo stream
  const streamRes = await fetch(`${BASE_URL}${photo1.url}`, {
    headers: { Cookie: "itams_active_role=IT_ADMIN" },
  });
  assert(streamRes.status === 200, "Main photo streaming returned HTTP 200");
  assert(streamRes.headers.get("content-type") === "image/webp", "Image converted & served as image/webp");
  const streamBuffer = Buffer.from(await streamRes.arrayBuffer());
  assert(streamBuffer.length > 0, `Streamed ${streamBuffer.length} bytes`);

  // Thumbnail stream (?thumb=true)
  const thumbRes = await fetch(`${BASE_URL}${photo1.thumbnailUrl}`, {
    headers: { Cookie: "itams_active_role=IT_ADMIN" },
  });
  assert(thumbRes.status === 200, "Thumbnail streaming returned HTTP 200");
  assert(thumbRes.headers.get("content-type") === "image/webp", "Thumbnail served as image/webp");
  const thumbBuffer = Buffer.from(await thumbRes.arrayBuffer());
  assert(thumbBuffer.length > 0 && thumbBuffer.length < streamBuffer.length, `Thumbnail size (${thumbBuffer.length} bytes) is optimized`);

  // Verify thumbnail resolution with sharp
  const thumbMeta = await sharp(thumbBuffer).metadata();
  assert(thumbMeta.width === 300 && thumbMeta.height === 300, `Thumbnail dimensions verified: ${thumbMeta.width}x${thumbMeta.height} px`);

  // -----------------------------------------------------------
  // 7. Test Updating Photo Metadata & Switching Primary Flag
  // -----------------------------------------------------------
  console.log("\n👉 Test 7: Updating photo metadata and switching primary photo...");
  const patchRes = await fetch(`${BASE_URL}/api/assets/${targetAsset.id}/photos/${photo2.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: "itams_active_role=IT_ADMIN",
    },
    body: JSON.stringify({
      isPrimary: true,
      description: "Updated serial number photo description",
    }),
  });
  assert(patchRes.status === 200, "PATCH photo returned HTTP 200");
  const patchData = await patchRes.json();
  assert(patchData.photo.isPrimary === true, "Photo 2 is now marked as isPrimary: true");

  // Verify Photo 1 is no longer primary
  const checkAssetRes = await fetch(`${BASE_URL}/api/assets/${targetAsset.id}`, {
    headers: { Cookie: "itams_active_role=IT_ADMIN" },
  });
  const checkAssetData = await checkAssetRes.json();
  assert(checkAssetData.asset.primaryPhoto.id === photo2.id, `primaryPhoto now switched to Photo 2 (${photo2.id})`);
  const oldPhoto1 = checkAssetData.asset.photos.find((p) => p.id === photo1.id);
  assert(oldPhoto1.isPrimary === false, "Photo 1 was successfully demoted to isPrimary: false");

  // -----------------------------------------------------------
  // 8. Test Photo Attachment during Asset Handover
  // -----------------------------------------------------------
  console.log("\n👉 Test 8: Testing condition photo capture during asset assignment...");
  // Fetch an employee to assign
  const empListRes = await fetch(`${BASE_URL}/api/employees`);
  const empListData = await empListRes.json();
  const testEmployee = empListData.employees[0];

  const handoverDoc = "BAST/PHOTO/2026/001";
  const assignRes = await fetch(`${BASE_URL}/api/assets/${targetAsset.id}/assign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: "itams_active_role=IT_ADMIN",
    },
    body: JSON.stringify({
      actionType: "ASSIGN",
      employeeId: testEmployee.id,
      conditionAtAction: "GOOD",
      handoverDocRef: handoverDoc,
      notes: "Handover with verified physical condition photo",
    }),
  });
  assert(assignRes.status === 200, "Assignment completed successfully (HTTP 200)");
  const assignData = await assignRes.json();
  assert(assignData.assignmentId !== undefined, `Assignment record ID returned: ${assignData.assignmentId}`);

  // Upload handover condition photo linked to this assignment
  const handoverPhotoBuffer = await createTestImageBuffer("jpeg", 800, 600, "Handover Condition Clean");
  const handoverForm = new FormData();
  handoverForm.append("file", new Blob([handoverPhotoBuffer], { type: "image/jpeg" }), "handover_condition.jpg");
  handoverForm.append("category", "HANDOVER");
  handoverForm.append("description", `Signed handover inspection: ${handoverDoc}`);
  handoverForm.append("assignmentId", assignData.assignmentId);

  const handoverUploadRes = await fetch(`${BASE_URL}/api/assets/${targetAsset.id}/photos`, {
    method: "POST",
    headers: { Cookie: "itams_active_role=IT_ADMIN" },
    body: handoverForm,
  });
  assert(handoverUploadRes.status === 201, "Handover photo uploaded successfully (HTTP 201)");
  const handoverUploadData = await handoverUploadRes.json();
  const handoverPhoto = handoverUploadData.photos[0];
  assert(handoverPhoto.category === "HANDOVER", "Photo category is HANDOVER");
  assert(handoverPhoto.assignmentId === assignData.assignmentId, `Photo linked to assignment record ${assignData.assignmentId}`);

  // -----------------------------------------------------------
  // 9. Test Deleting a Photo and File Cleanup
  // -----------------------------------------------------------
  console.log("\n👉 Test 9: Testing photo deletion and physical storage cleanup...");
  const deleteRes = await fetch(`${BASE_URL}/api/assets/${targetAsset.id}/photos/${handoverPhoto.id}`, {
    method: "DELETE",
    headers: { Cookie: "itams_active_role=IT_ADMIN" },
  });
  assert(deleteRes.status === 200, "DELETE photo returned HTTP 200");

  // Verify photo cannot be streamed anymore
  const deletedStreamRes = await fetch(`${BASE_URL}${handoverPhoto.url}`, {
    headers: { Cookie: "itams_active_role=IT_ADMIN" },
  });
  assert(deletedStreamRes.status === 404, "Deleted photo URL returns HTTP 404 Not Found");

  // Verify audit log recorded in AssetHistory
  const historyRes = await fetch(`${BASE_URL}/api/assets/${targetAsset.id}`, {
    headers: { Cookie: "itams_active_role=IT_ADMIN" },
  });
  const historyData = await historyRes.json();
  const deleteLog = historyData.asset.historyLogs?.find((l) => l.action === "PHOTO_DELETED");
  assert(deleteLog !== undefined, `PHOTO_DELETED action logged in asset history: "${deleteLog?.notes}"`);

  // Cleanup: return targetAsset back to available pool
  await fetch(`${BASE_URL}/api/assets/${targetAsset.id}/assign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: "itams_active_role=IT_ADMIN",
    },
    body: JSON.stringify({
      actionType: "RETURN",
      conditionAtAction: "GOOD",
      notes: "Post-test cleanup returning asset to storage pool",
    }),
  });

  // -----------------------------------------------------------
  // Test Results Summary
  // -----------------------------------------------------------
  console.log("\n" + "=".repeat(60));
  console.log(`📊 Asset Photo Documentation Test Summary:`);
  console.log(`   Passed: ${testPassed}`);
  console.log(`   Failed: ${testFailed}`);
  console.log("=".repeat(60));

  if (testFailed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("❌ Test suite encountered unhandled exception:", err);
  process.exit(1);
});

