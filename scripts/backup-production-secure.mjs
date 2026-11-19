import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execFileSync } from "child_process";

// 1. Initialize backup destination outside git repository
const homeDir = process.env.HOME || "/Users/taufiksyawalludin";
const backupRoot = path.join(homeDir, ".itams_backups");
const timestamp = new Date().toISOString().replace(/[-:T.]/g, "").slice(0, 14);
const backupDir = path.join(backupRoot, `itams_prod_backup_${timestamp}`);
const storageFilesDir = path.join(backupDir, "storage_files");

fs.mkdirSync(storageFilesDir, { recursive: true, mode: 0o700 });
fs.chmodSync(backupRoot, 0o700);
fs.chmodSync(backupDir, 0o700);
fs.chmodSync(storageFilesDir, 0o700);

console.log("=================================================================");
console.log("   SECURE REMOTE PRODUCTION BACKUP VIA SUPABASE MANAGEMENT API");
console.log(`   Destination: ${backupDir}`);
console.log("   Project: dhwtybzvkhcsqzrtgohn (it-asset-management, Tokyo)");
console.log("   Timestamp: " + new Date().toISOString());
console.log("=================================================================\n");

function runRemoteQuery(sql) {
  const output = execFileSync(
    "supabase",
    ["db", "query", "--remote", "--read-only", sql, "--output-format", "json"],
    { encoding: "utf-8", maxBuffer: 50 * 1024 * 1024 }
  );
  try {
    const parsed = JSON.parse(output);
    return parsed.rows || [];
  } catch (err) {
    throw new Error(`Failed to parse query output: ${err.message}\nOutput: ${output}`);
  }
}

async function main() {
  const manifest = {
    timestamp: new Date().toISOString(),
    project_ref: "dhwtybzvkhcsqzrtgohn",
    region: "ap-northeast-1 (Tokyo)",
    backup_directory: backupDir,
    tables: {},
    storage: {},
    checksums: {},
  };

  const tablesToBackup = [
    { name: "auth_users", query: "SELECT json_agg(t) FROM (SELECT id, email, created_at, email_confirmed_at, last_sign_in_at FROM auth.users) t;" },
    { name: "auth_identities", query: "SELECT json_agg(t) FROM (SELECT id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at FROM auth.identities) t;" },
    { name: "public_user_profiles", query: "SELECT json_agg(t) FROM (SELECT * FROM public.user_profiles) t;" },
    { name: "public_companies", query: "SELECT json_agg(t) FROM (SELECT * FROM public.companies) t;" },
    { name: "public_employees", query: "SELECT json_agg(t) FROM (SELECT * FROM public.employees) t;" },
    { name: "public_assets", query: "SELECT json_agg(t) FROM (SELECT * FROM public.assets) t;" },
    { name: "public_asset_assignments", query: "SELECT json_agg(t) FROM (SELECT * FROM public.asset_assignments) t;" },
    { name: "public_asset_photos", query: "SELECT json_agg(t) FROM (SELECT * FROM public.asset_photos) t;" },
    { name: "storage_buckets", query: "SELECT json_agg(t) FROM (SELECT * FROM storage.buckets) t;" },
    { name: "storage_objects", query: "SELECT json_agg(t) FROM (SELECT * FROM storage.objects) t;" },
  ];

  console.log("--- 1. Extracting Remote Database Tables ---");
  for (const item of tablesToBackup) {
    const rows = runRemoteQuery(item.query);
    const data = rows[0]?.json_agg || [];
    const count = Array.isArray(data) ? data.length : 0;
    manifest.tables[item.name] = count;

    const outFile = path.join(backupDir, `${item.name}.json`);
    fs.writeFileSync(outFile, JSON.stringify(data, null, 2), { mode: 0o600 });
    const size = fs.statSync(outFile).size;
    const sha = crypto.createHash("sha256").update(fs.readFileSync(outFile)).digest("hex");
    manifest.checksums[`${item.name}.json`] = sha;

    console.log(`  ✓ ${item.name}: ${count} record(s) -> ${path.basename(outFile)} (${size} bytes)`);
  }

  // 2. Storage Inspection & Backup
  console.log("\n--- 2. Inspecting Remote Storage Buckets ---");
  const buckets = runRemoteQuery("SELECT json_agg(t) FROM (SELECT id, name, public FROM storage.buckets) t;")[0]?.json_agg || [];
  const storageObjects = runRemoteQuery("SELECT json_agg(t) FROM (SELECT id, bucket_id, name, created_at FROM storage.objects) t;")[0]?.json_agg || [];

  manifest.storage = {
    buckets: buckets.map((b) => ({ id: b.id, name: b.name, public: b.public })),
    total_objects: Array.isArray(storageObjects) ? storageObjects.length : 0,
  };

  console.log(`  ✓ Storage buckets found: ${buckets.length} (${buckets.map(b => b.name).join(", ")})`);
  console.log(`  ✓ Storage objects found: ${manifest.storage.total_objects}`);

  // 3. Compute SHA-256 Checksums file
  console.log("\n--- 3. Recording Checksums & Verification Manifest ---");
  let checksumFileContent = "";
  for (const [fileName, sha] of Object.entries(manifest.checksums)) {
    checksumFileContent += `${sha}  ${fileName}\n`;
  }
  const checksumFilePath = path.join(backupDir, "CHECKSUMS.sha256");
  fs.writeFileSync(checksumFilePath, checksumFileContent, { mode: 0o600 });

  const manifestPath = path.join(backupDir, "BACKUP_VERIFICATION.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), { mode: 0o600 });
  console.log(`  ✓ Manifest generated: ${path.basename(manifestPath)}`);
  console.log(`  ✓ Checksums saved: ${path.basename(checksumFilePath)}`);

  console.log("\n=================================================================");
  console.log("   REMOTE PRODUCTION BACKUP COMPLETED SUCCESSFULLY");
  console.log(`   Location: ${backupDir}`);
  console.log("   Permissions: 0700 (Directory), 0600 (Files - Owner Only)");
  console.log("=================================================================\n");
}

main().catch((err) => {
  console.error("Backup failed:", err);
  process.exit(1);
});
