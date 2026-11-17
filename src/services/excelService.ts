import * as XLSX from "xlsx";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { parseExcelInventory, ParsedAssetRow } from "@/lib/excel";
import { AssetDTO } from "@/types";

export interface ImportPreviewResult {
  rows: ParsedAssetRow[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
}

export interface ImportExecuteResult {
  success: boolean;
  inserted: number;
  updated: number;
  failed: number;
  errors: string[];
}

/**
 * Parse uploaded Excel file in the browser for validation preview
 */
export async function parseExcelFileForPreview(file: File): Promise<ImportPreviewResult> {
  const buffer = await file.arrayBuffer();
  return parseExcelInventory(buffer);
}

/**
 * Execute batch import of validated rows into Supabase database
 */
export async function executeBatchImport(
  file: File,
  parsedRows: ParsedAssetRow[]
): Promise<ImportExecuteResult> {
  if (isSupabaseConfigured()) {
    try {
      // 1. Fetch companies map
      const { data: companies, error: compErr } = await supabase
        .from("companies")
        .select("id, code");
      if (compErr || !companies) throw new Error("Could not retrieve companies master data");

      const companyMap: Record<string, string> = {};
      for (const c of companies) {
        companyMap[c.code] = c.id;
      }

      // Default company fallback
      const defaultCompanyId = companies[0]?.id;

      // 2. Fetch existing asset tags to detect duplicates
      const { data: existingAssets } = await supabase
        .from("assets")
        .select("id, asset_tag, company_id");
      const existingTagMap = new Set((existingAssets || []).map((a) => a.asset_tag.toUpperCase()));

      // 3. Batch insert valid rows
      const validRows = parsedRows.filter((r) => r.isValid);
      let inserted = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const row of validRows) {
        try {
          const compId = companyMap[row.companyCode] || defaultCompanyId;
          const isDuplicate = existingTagMap.has(row.assetTag.toUpperCase());
          const assetId = `ast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

          const newAsset = {
            id: assetId,
            asset_tag: row.assetTag,
            is_duplicate_tag: isDuplicate,
            asset_name: row.assetName,
            company_id: compId,
            category: row.category,
            model: row.model || "Standard Model",
            cpu: row.cpu || "Standard CPU",
            ram: row.ram || "8GB",
            serial_number: row.serialNumber || null,
            mac_address: row.macAddress || null,
            status: row.status,
            physical_condition: row.physicalCondition,
            location: row.location || "HQ",
            purchase_date: row.purchaseDate || null,
            purchase_cost: row.purchaseCost || null,
            useful_life_months: row.usefulLifeMonths || null,
            laptop_code: row.laptopCode || null,
            laptop_account: row.laptopAccount || null,
            username: row.username || null,
            notes: row.notes || null,
            qr_code_token: `QR-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
            is_archived: false,
          };

          const { error: insErr } = await supabase.from("assets").insert(newAsset);
          if (insErr) {
            failed++;
            errors.push(`Row ${row.rowNumber} (${row.assetTag}): ${insErr.message}`);
          } else {
            inserted++;
            existingTagMap.add(row.assetTag.toUpperCase());

            // Append history
            await supabase.from("asset_histories").insert({
              id: `hst_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              asset_id: assetId,
              action: "EXCEL_IMPORT",
              notes: `Imported via batch Excel file (${row.assetTag})`,
            });
          }
        } catch (err: any) {
          failed++;
          errors.push(`Row ${row.rowNumber}: ${err.message}`);
        }
      }

      return {
        success: inserted > 0,
        inserted,
        updated: 0,
        failed,
        errors,
      };
    } catch (err: any) {
      return {
        success: false,
        inserted: 0,
        updated: 0,
        failed: parsedRows.length,
        errors: [err.message || "Failed to execute batch import"],
      };
    }
  }

  // Fallback to local /api/import route
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("action", "confirm");

    const res = await fetch("/api/import", {
      method: "POST",
      body: formData,
    });

    const json = await res.json();
    return {
      success: res.ok,
      inserted: json.inserted || 0,
      updated: json.updated || 0,
      failed: json.failed || 0,
      errors: json.errors || [],
    };
  } catch (err: any) {
    return {
      success: false,
      inserted: 0,
      updated: 0,
      failed: parsedRows.length,
      errors: [err.message],
    };
  }
}

/**
 * Generate standard Excel template and download in browser
 */
export function downloadExcelTemplate() {
  const templateRows = [
    {
      "Asset Tag": "AST-2026-001",
      "Asset Name": "ThinkPad T14 Gen 4",
      Company: "GMD",
      Category: "LAPTOP",
      Model: "ThinkPad T14 Gen 4",
      CPU: "Intel Core i7-1365U",
      RAM: "16GB",
      "Serial Number": "PF-4XYZ123",
      "MAC Address": "A4:BB:6D:44:E2:10",
      Status: "AVAILABLE",
      "Physical Condition": "GOOD",
      "Assigned Employee": "",
      Location: "GMD Jakarta HQ Floor 3",
      "Purchase Date": "2024-01-15",
      "Purchase Cost": 18500000,
      "Useful Life (Months)": 36,
      "Laptop Code": "LT-GMD-042",
      "Laptop Account": "gmd-user",
      Username: "it.support",
      Notes: "Standard executive issuance",
    },
    {
      "Asset Tag": "AST-2026-002",
      "Asset Name": "Dell OptiPlex 7000",
      Company: "GMC",
      Category: "DESKTOP",
      Model: "OptiPlex 7000 Micro",
      CPU: "Intel Core i5-12500",
      RAM: "16GB",
      "Serial Number": "DL-7890123",
      "MAC Address": "D8:9E:F3:11:02:88",
      Status: "IN_USE",
      "Physical Condition": "EXCELLENT",
      "Assigned Employee": "Budi Santoso",
      Location: "GMC Operations Plant A",
      "Purchase Date": "2023-06-10",
      "Purchase Cost": 14000000,
      "Useful Life (Months)": 48,
      "Laptop Code": "",
      "Laptop Account": "",
      Username: "budi.santoso",
      Notes: "Operations plant monitoring station",
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(templateRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory Template");

  XLSX.writeFile(workbook, "IT_Asset_Inventory_Template.xlsx");
}

/**
 * Export current asset inventory to Excel file
 */
export function exportAssetsToExcel(assets: AssetDTO[], filename = "IT_Asset_Inventory.xlsx") {
  const exportRows = assets.map((a, idx) => ({
    No: idx + 1,
    "Asset Tag": a.assetTag,
    "Asset Name": a.assetName,
    Entity: a.company?.code || "",
    Category: a.category,
    Model: a.model,
    CPU: a.cpu,
    RAM: a.ram,
    "Serial Number": a.serialNumber || "-",
    "MAC Address": a.macAddress || "-",
    Status: a.status,
    "Physical Condition": a.physicalCondition,
    "Assigned Employee": a.assignedEmployee?.name || "-",
    Location: a.location,
    "Purchase Date": a.purchaseDate || "-",
    "Purchase Cost": a.purchaseCost !== undefined && a.purchaseCost !== null ? a.purchaseCost : "MASKED",
    "Net Book Value": a.netBookValue !== undefined && a.netBookValue !== null ? a.netBookValue : "MASKED",
    "Laptop Code": a.laptopCode || "-",
    "Created Date": new Date(a.createdAt).toLocaleDateString(),
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Asset Inventory");

  XLSX.writeFile(workbook, filename);
}
