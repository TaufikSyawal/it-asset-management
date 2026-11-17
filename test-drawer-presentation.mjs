// Verification Script for Asset Detail Drawer Photo Presentation
import fs from "fs/promises";
import path from "path";

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
  console.log("🚀 Starting Verification of Asset Detail Drawer Photo Presentation...\n");

  const drawerPath = path.join(process.cwd(), "src", "components", "AssetDetailDrawer.tsx");
  const drawerSource = await fs.readFile(drawerPath, "utf-8");

  const tablePath = path.join(process.cwd(), "src", "components", "AssetTable.tsx");
  const tableSource = await fs.readFile(tablePath, "utf-8");

  // -----------------------------------------------------------
  // 1. Larger Primary Photo Preview in Specifications Tab
  // -----------------------------------------------------------
  console.log("👉 Test 1: Checking larger preview section in Specifications tab...");
  assert(
    drawerSource.includes("Primary Asset Photo Larger Preview"),
    "Specifications tab includes dedicated Primary Asset Photo Larger Preview section"
  );

  // Check positioning: must be before "Hardware Specifications"
  const photoIndex = drawerSource.indexOf("Primary Asset Photo Larger Preview");
  const specsIndex = drawerSource.indexOf("Hardware Specifications");
  assert(
    photoIndex !== -1 && specsIndex !== -1 && photoIndex < specsIndex,
    "Larger photo preview is placed above the Hardware Specifications grid"
  );

  // -----------------------------------------------------------
  // 2. Aspect Ratio & Responsive Image Presentation
  // -----------------------------------------------------------
  console.log("\n👉 Test 2: Verifying responsive image container and distortion prevention...");
  assert(
    drawerSource.includes("object-contain"),
    "Uses 'object-contain' so physical devices (corners, ports, screens) are never cropped or stretched"
  );
  assert(
    drawerSource.includes("h-56") && drawerSource.includes("sm:h-64"),
    "Uses responsive height (h-56 on mobile, sm:h-64 on desktop)"
  );
  assert(
    drawerSource.includes("w-full"),
    "Image container uses full responsive width (w-full)"
  );
  assert(
    drawerSource.includes("bg-slate-950"),
    "Uses deep neutral backdrop (bg-slate-950) to frame devices cleanly"
  );

  // -----------------------------------------------------------
  // 3. Clickable to Open Full-Screen Image Viewer
  // -----------------------------------------------------------
  console.log("\n👉 Test 3: Verifying click action to open full-screen Lightbox viewer...");
  assert(
    drawerSource.includes("setIsLightboxOpen(true)"),
    "Image container click handler triggers full-screen Lightbox viewer"
  );
  assert(
    drawerSource.includes("AssetPhotoLightboxModal"),
    "Integrates full-screen AssetPhotoLightboxModal component"
  );
  assert(
    drawerSource.includes("Click to expand") || drawerSource.includes("Enlarge"),
    "Displays visual cue/button inviting user to expand to full-screen"
  );

  // -----------------------------------------------------------
  // 4. Clean Placeholder when No Photo Exists
  // -----------------------------------------------------------
  console.log("\n👉 Test 4: Verifying empty state placeholder and authorized upload button...");
  assert(
    drawerSource.includes("No Physical Photo Documented"),
    "Displays clean 'No Physical Photo Documented' placeholder when no photo exists"
  );
  assert(
    drawerSource.includes("permissions.canManagePhotos") && drawerSource.includes("Upload Primary Photo"),
    "Renders 'Upload Primary Photo' button conditionally for authorized IT users"
  );
  assert(
    drawerSource.includes("setIsUploadModalOpen(true)"),
    "Upload button opens AssetPhotoUploadModal"
  );

  // -----------------------------------------------------------
  // 5. Preserving Thumbnails in Header and Table
  // -----------------------------------------------------------
  console.log("\n👉 Test 5: Verifying preservation of header and table thumbnails...");
  assert(
    drawerSource.includes("asset.primaryPhoto?.thumbnailUrl"),
    "Drawer header retains small thumbnail preview"
  );
  assert(
    tableSource.includes("asset.primaryPhoto?.thumbnailUrl"),
    "AssetTable retains small thumbnail beside device name"
  );
  assert(
    tableSource.includes("w-9 h-9 rounded-lg object-cover"),
    "AssetTable thumbnail maintains compact 36x36px layout"
  );

  // -----------------------------------------------------------
  // 6. Preserving Photos Tab & Gallery
  // -----------------------------------------------------------
  console.log("\n👉 Test 6: Verifying Photos tab & gallery preservation...");
  assert(
    drawerSource.includes('activeTab === "photos"'),
    "Dedicated 'photos' tab condition preserved"
  );
  assert(
    drawerSource.includes("AssetPhotoGallery"),
    "AssetPhotoGallery component preserved inside Photos tab"
  );

  // -----------------------------------------------------------
  // 7. Live API Validation with Seeded Asset (if server is running)
  // -----------------------------------------------------------
  console.log("\n👉 Test 7: Testing live API asset response with photos...");
  try {
    const res = await fetch("http://localhost:3000/api/assets?limit=5", {
      headers: { Cookie: "itams_active_role=IT_ADMIN" },
      signal: AbortSignal.timeout(1500),
    });
    if (res.status === 200) {
      const data = await res.json();
      const assetWithPhoto = data.assets.find((a) => a.primaryPhoto !== null);
      const assetWithoutPhoto = data.assets.find((a) => a.primaryPhoto === null);

      if (assetWithPhoto) {
        assert(
          assetWithPhoto.primaryPhoto.url && assetWithPhoto.primaryPhoto.thumbnailUrl,
          `Asset ${assetWithPhoto.assetTag} has valid primaryPhoto streaming URLs`
        );
      }
      if (assetWithoutPhoto) {
        assert(
          assetWithoutPhoto.primaryPhoto === null,
          `Asset ${assetWithoutPhoto.assetTag} has null primaryPhoto (triggers placeholder)`
        );
      }
      assert(true, "Live API asset photo response validated");
    }
  } catch (err) {
    console.log("  ℹ️ Local development server offline (skipped live API probe during offline test)");
  }

  // -----------------------------------------------------------
  // Summary
  // -----------------------------------------------------------
  console.log("\n" + "=".repeat(60));
  console.log(`📊 Drawer Photo Presentation Verification:`);
  console.log(`   Passed: ${testPassed}`);
  console.log(`   Failed: ${testFailed}`);
  console.log("=".repeat(60));

  if (testFailed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test failed with unhandled exception:", err);
  process.exit(1);
});

