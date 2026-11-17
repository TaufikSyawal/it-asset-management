/**
 * Verification Script for QR Label Print Layout & PDF Export
 */

import fs from "fs";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

console.log("🚀 Verifying QR Asset Label Print CSS & Layout Specifications...\n");

const qrModalSource = fs.readFileSync("./src/components/QRLabelModal.tsx", "utf-8");

// 1. Verify Print Media Portal Isolation
console.log("👉 Test 1: Verifying DOM Print Portal Isolation...");
assert(
  qrModalSource.includes("#it-asset-print-portal"),
  "Dedicated #it-asset-print-portal exists"
);
assert(
  qrModalSource.includes("body > *:not(#it-asset-print-portal)") &&
  qrModalSource.includes("display: none !important"),
  "Hides all non-print elements (modals, nav, headers) on body via display: none"
);
assert(
  qrModalSource.includes("createPortal"),
  "Uses React createPortal to render print elements directly at document.body"
);

// 2. Verify 50x25mm Dimensions & Flex-Shrink Prevention
console.log("\n👉 Test 2: Verifying 50 × 25 mm Physical Label Sizing...");
assert(
  qrModalSource.includes("width: 50mm !important") &&
  qrModalSource.includes("height: 25mm !important"),
  "50 × 25 mm exact physical width and height specified in mm"
);
assert(
  qrModalSource.includes("flex-shrink: 0 !important"),
  "flex-shrink: 0 prevents vertical strip compression"
);
assert(
  qrModalSource.includes("box-sizing: border-box !important"),
  "box-sizing: border-box avoids padding margin overflow"
);

// 3. Verify 60x40mm Dimensions
console.log("\n👉 Test 3: Verifying 60 × 40 mm Physical Label Sizing...");
assert(
  qrModalSource.includes("width: 60mm !important") &&
  qrModalSource.includes("height: 40mm !important"),
  "60 × 40 mm exact physical width and height specified in mm"
);

// 4. Verify 1:1 Square QR Code Aspect Ratio
console.log("\n👉 Test 4: Verifying 1:1 Square QR Code Rendering...");
assert(
  qrModalSource.includes("aspect-ratio: 1 / 1 !important"),
  "aspect-ratio: 1 / 1 enforced on QR container and image"
);
assert(
  qrModalSource.includes("width: 21mm !important") &&
  qrModalSource.includes("height: 21mm !important"),
  "QR code sized to exact 21 × 21 mm for 50x25 format"
);
assert(
  qrModalSource.includes("width: 34mm !important") &&
  qrModalSource.includes("height: 34mm !important"),
  "QR code sized to exact 34 × 34 mm for 60x40 format"
);
assert(
  qrModalSource.includes("object-fit: contain !important"),
  "object-fit: contain ensures no image stretching"
);

// 5. Verify Thermal Roll vs A4 Sheet Printing Configurations
console.log("\n👉 Test 5: Verifying Thermal Printer & A4 Sheet Modes...");
assert(
  qrModalSource.includes("@page {") && qrModalSource.includes("50mm 25mm"),
  "Thermal roll @page rule sets physical 50mm 25mm page size"
);
assert(
  qrModalSource.includes("size: A4 portrait !important"),
  "A4 sheet mode sets @page size to A4 portrait"
);
assert(
  qrModalSource.includes("break-after: page !important") ||
  qrModalSource.includes("page-break-after: always !important"),
  "Thermal mode forces exactly 1 label per page"
);
assert(
  qrModalSource.includes("break-inside: avoid !important"),
  "A4 mode prevents labels from splitting across page breaks"
);

// 6. Verify Content Cleanliness (No CPU, RAM, Location, Serial in physical label)
console.log("\n👉 Test 6: Verifying Clean Content (No CPU, RAM, Serial, Location)...");
// Check the rendered label content function body specifically
const renderLabelSection = qrModalSource.slice(
  qrModalSource.indexOf("const renderLabelContent ="),
  qrModalSource.indexOf("const printPortal =")
);

const hasCPU = renderLabelSection.includes("asset.cpu");
const hasRAM = renderLabelSection.includes("asset.ram");
const hasLocation = renderLabelSection.includes("asset.location");
const hasSerial = renderLabelSection.includes("asset.serialNumber");

assert(!hasCPU, "CPU excluded from physical label content");
assert(!hasRAM, "RAM excluded from physical label content");
assert(!hasLocation, "Location excluded from physical label content");
assert(!hasSerial, "Full Serial Number excluded from physical label content");
assert(renderLabelSection.includes("asset.assetTag"), "Asset Tag prominently displayed");
assert(renderLabelSection.includes("asset.company?.code"), "Company Code badge displayed");
assert(renderLabelSection.includes("asset.assetName"), "Short Asset Name displayed");

console.log("\n==================================================");
console.log(`🏁 Total Print Layout Checks Passed: ${passed}`);
console.log(`❌ Total Print Layout Checks Failed: ${failed}`);
console.log("==================================================");

if (failed > 0) {
  process.exit(1);
} else {
  console.log("🎉 ALL PRINT LAYOUT & PDF CHECKS PASSED!");
}
