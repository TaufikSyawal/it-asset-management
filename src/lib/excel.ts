import * as XLSX from "xlsx";
import { AssetCategory, AssetStatus, PhysicalCondition } from "@/types";

export interface ParsedAssetRow {
  rowNumber: number;
  assetTag: string;
  assetName: string;
  companyCode: string;
  category: AssetCategory;
  model: string;
  cpu: string;
  ram: string;
  serialNumber?: string;
  macAddress?: string;
  status: AssetStatus;
  physicalCondition: PhysicalCondition;
  employeeName?: string;
  location: string;
  purchaseDate?: string;
  purchaseCost?: number;
  usefulLifeMonths?: number;
  laptopCode?: string;
  laptopAccount?: string;
  username?: string;
  notes?: string;
  isValid: boolean;
  errors: string[];
}

export function parseExcelInventory(buffer: ArrayBuffer | Buffer): {
  rows: ParsedAssetRow[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
} {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const rawData: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  const rows: ParsedAssetRow[] = [];

  rawData.forEach((item, index) => {
    const rowNum = index + 2; // Accounting for 1-based index and header
    const errors: string[] = [];

    // Flexible column resolution (case-insensitive & trim)
    const findVal = (keys: string[]): string => {
      for (const k of keys) {
        for (const [sheetKey, val] of Object.entries(item)) {
          if (sheetKey.trim().toLowerCase() === k.toLowerCase()) {
            return String(val).trim();
          }
        }
      }
      return "";
    };

    const assetTag = findVal(["Asset Tag", "Tag", "Asset No", "Asset ID"]);
    const assetName = findVal(["Asset Name", "Name", "Device Name", "Description"]);
    const companyRaw = findVal(["Company", "Entity", "Company Code"]).toUpperCase();
    const model = findVal(["Model", "Machine Model"]);
    const cpu = findVal(["CPU", "Processor"]);
    const ram = findVal(["RAM", "Memory"]);
    const serialNumber = findVal(["Serial Number", "Serial", "S/N", "Serial No"]);
    const macAddress = findVal(["MAC Address", "MAC", "Ethernet MAC", "Wi-Fi MAC"]);
    const statusRaw = findVal(["Status", "Asset Status"]).toUpperCase();
    const conditionRaw = findVal(["Physical Condition", "Condition"]).toUpperCase();
    const employeeName = findVal(["Assigned Employee", "Employee", "User", "PIC"]);
    const location = findVal(["Location", "Site", "Building", "Room"]) || "HQ";
    const purchaseDateRaw = findVal(["Purchase Date", "PO Date", "Date of Purchase"]);
    const purchaseCostRaw = findVal(["Purchase Cost", "Cost", "Price", "Amount"]);
    const usefulLifeRaw = findVal(["Useful Life", "Useful Life (Months)", "Depreciation Months"]);
    const laptopCode = findVal(["Laptop Code", "Code", "Inventory Code"]);
    const laptopAccount = findVal(["Laptop Account", "Account", "Host Name"]);
    const username = findVal(["Username", "User Account", "Domain User"]);
    const notes = findVal(["Notes", "Remark", "Remarks", "Asset History"]);

    // Validations
    if (!assetTag) errors.push("Asset Tag is required");
    if (!assetName) errors.push("Asset Name is required");

    // Standardize company: default to GMD if not specified or unknown
    let companyCode = "GMD";
    if (companyRaw.includes("GMC")) companyCode = "GMC";
    else if (companyRaw.includes("TEL")) companyCode = "TEL";
    else if (companyRaw.includes("GMD")) companyCode = "GMD";

    // Standardize category
    let category: AssetCategory = "LAPTOP";
    const nameLower = assetName.toLowerCase();
    if (nameLower.includes("desktop") || nameLower.includes("pc")) category = "DESKTOP";
    else if (nameLower.includes("server")) category = "SERVER";
    else if (nameLower.includes("monitor") || nameLower.includes("display")) category = "MONITOR";
    else if (nameLower.includes("printer")) category = "PRINTER";
    else if (nameLower.includes("switch") || nameLower.includes("router")) category = "NETWORK_EQUIPMENT";

    // Standardize status
    let status: AssetStatus = "AVAILABLE";
    if (statusRaw.includes("USE") || employeeName) status = "IN_USE";
    else if (statusRaw.includes("MAINTENANCE") || statusRaw.includes("REPAIR")) status = "MAINTENANCE";
    else if (statusRaw.includes("DISPOSE")) status = "DISPOSED";
    else if (statusRaw.includes("ARCHIVE")) status = "ARCHIVED";
    else if (statusRaw.includes("MISSING")) status = "MISSING";

    // Standardize condition
    let physicalCondition: PhysicalCondition = "GOOD";
    if (conditionRaw.includes("EXCELLENT") || conditionRaw.includes("BARU")) physicalCondition = "EXCELLENT";
    else if (conditionRaw.includes("FAIR") || conditionRaw.includes("CUKUP")) physicalCondition = "FAIR";
    else if (conditionRaw.includes("POOR") || conditionRaw.includes("KURANG")) physicalCondition = "POOR";
    else if (conditionRaw.includes("DAMAGE") || conditionRaw.includes("RUSAK")) physicalCondition = "DAMAGED";

    // Financial parse
    let purchaseCost: number | undefined;
    if (purchaseCostRaw) {
      const cleanNum = parseFloat(purchaseCostRaw.replace(/[^0-9.-]/g, ""));
      if (!isNaN(cleanNum)) purchaseCost = cleanNum;
    }

    let usefulLifeMonths: number | undefined;
    if (usefulLifeRaw) {
      const cleanMonths = parseInt(usefulLifeRaw.replace(/[^0-9]/g, ""), 10);
      if (!isNaN(cleanMonths)) usefulLifeMonths = cleanMonths;
    }

    rows.push({
      rowNumber: rowNum,
      assetTag,
      assetName,
      companyCode,
      category,
      model: model || "Standard",
      cpu: cpu || "N/A",
      ram: ram || "N/A",
      serialNumber: serialNumber || undefined,
      macAddress: macAddress || undefined,
      status,
      physicalCondition,
      employeeName: employeeName || undefined,
      location,
      purchaseDate: purchaseDateRaw || undefined,
      purchaseCost,
      usefulLifeMonths,
      laptopCode: laptopCode || undefined,
      laptopAccount: laptopAccount || undefined,
      username: username || undefined,
      notes: notes || undefined,
      isValid: errors.length === 0,
      errors,
    });
  });

  const validRows = rows.filter((r) => r.isValid).length;
  const invalidRows = rows.length - validRows;

  return {
    rows,
    totalRows: rows.length,
    validRows,
    invalidRows,
  };
}

