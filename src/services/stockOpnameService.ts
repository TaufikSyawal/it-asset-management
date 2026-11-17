import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  StockOpnameSessionDTO,
  StockOpnameItemDTO,
  StockOpnameSessionStats,
  PhysicalCondition,
  AssetDTO,
} from "@/types";
import { enqueueOfflineScan } from "./offlineSyncService";
import { mapRowToAssetDTO } from "./assetService";
import * as XLSX from "xlsx";

function computeSessionStats(items: StockOpnameItemDTO[]): StockOpnameSessionStats {
  const totalExpected = items.filter((i) => !i.isUnexpected).length;
  let scannedCount = 0;
  let verifiedCount = 0;
  let locationMismatchCount = 0;
  let userMismatchCount = 0;
  let missingCount = 0;
  let unexpectedCount = 0;
  let duplicateScansCount = 0;

  for (const item of items) {
    if (item.scannedAt) scannedCount++;
    if (item.verificationStatus === "VERIFIED") verifiedCount++;
    else if (item.verificationStatus === "MISMATCH_LOCATION") locationMismatchCount++;
    else if (item.verificationStatus === "MISMATCH_USER") userMismatchCount++;
    else if (item.verificationStatus === "MISSING") missingCount++;

    if (item.isUnexpected) unexpectedCount++;
    if (item.scanCount > 1) duplicateScansCount++;
  }

  const progressPercentage = totalExpected > 0 ? Math.round((scannedCount / totalExpected) * 100) : 0;

  return {
    totalExpected,
    scannedCount,
    verifiedCount,
    locationMismatchCount,
    userMismatchCount,
    missingCount,
    unexpectedCount,
    duplicateScansCount,
    progressPercentage,
  };
}

export async function getStockOpnameSessions(companyId?: string): Promise<StockOpnameSessionDTO[]> {
  if (isSupabaseConfigured()) {
    try {
      let query = supabase
        .from("stock_opname_sessions")
        .select(`
          *,
          company:companies (id, code, name),
          items:stock_opname_items (
            id,
            scanned_at,
            verification_status,
            is_unexpected,
            scan_count
          )
        `)
        .order("created_at", { ascending: false });

      if (companyId && companyId !== "ALL") {
        query = query.eq("company_id", companyId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((s: any) => {
        const stats = computeSessionStats(
          (s.items || []).map((i: any) => ({
            ...i,
            scannedAt: i.scanned_at,
            verificationStatus: i.verification_status,
            isUnexpected: !!i.is_unexpected,
            scanCount: i.scan_count || 1,
          }))
        );

        return {
          id: s.id,
          sessionNumber: s.session_number,
          title: s.title,
          companyId: s.company_id,
          company: s.company,
          locationScope: s.location_scope,
          categoryScope: s.category_scope,
          status: s.status,
          startDate: s.start_date,
          endDate: s.end_date,
          conductedBy: s.conducted_by,
          reconciledAt: s.reconciled_at,
          reconciledBy: s.reconciled_by,
          notes: s.notes,
          createdAt: s.created_at,
          updatedAt: s.updated_at,
          stats,
        };
      });
    } catch (err) {
      console.error("Failed to fetch sessions from Supabase:", err);
    }
  }

  // Fallback
  try {
    const res = await fetch("/api/stock-opname/sessions");
    if (res.ok) {
      const json = await res.json();
      return json.sessions || [];
    }
  } catch (err) {
    console.warn("Fallback /api/stock-opname/sessions error:", err);
  }

  return [];
}

export async function getStockOpnameSessionDetails(sessionId: string): Promise<StockOpnameSessionDTO | null> {
  if (isSupabaseConfigured()) {
    try {
      const { data: s, error } = await supabase
        .from("stock_opname_sessions")
        .select(`
          *,
          company:companies (id, code, name),
          items:stock_opname_items (
            *,
            asset:assets (*, company:companies(id, code, name)),
            expectedEmployee:employees!expected_employee_id (id, employee_id, name, department),
            actualEmployee:employees!actual_employee_id (id, employee_id, name, department)
          )
        `)
        .eq("id", sessionId)
        .single();

      if (error || !s) throw error;

      const items: StockOpnameItemDTO[] = (s.items || []).map((i: any) => ({
        id: i.id,
        sessionId: i.session_id,
        assetId: i.asset_id,
        asset: mapRowToAssetDTO(i.asset),
        expectedLocation: i.expected_location,
        expectedEmployeeId: i.expected_employee_id,
        expectedEmployee: i.expectedEmployee,
        expectedCondition: i.expected_condition,
        scannedAt: i.scanned_at,
        scannedBy: i.scanned_by,
        verificationStatus: i.verification_status,
        actualLocation: i.actual_location,
        actualCondition: i.actual_condition,
        actualEmployeeId: i.actual_employee_id,
        actualEmployee: i.actualEmployee,
        isUnexpected: !!i.is_unexpected,
        scanCount: i.scan_count || 1,
        discrepancyNotes: i.discrepancy_notes,
        reconciled: !!i.reconciled,
        notes: i.notes,
        createdAt: i.created_at,
        updatedAt: i.updated_at,
      }));

      const stats = computeSessionStats(items);

      return {
        id: s.id,
        sessionNumber: s.session_number,
        title: s.title,
        companyId: s.company_id,
        company: s.company,
        locationScope: s.location_scope,
        categoryScope: s.category_scope,
        status: s.status,
        startDate: s.start_date,
        endDate: s.end_date,
        conductedBy: s.conducted_by,
        reconciledAt: s.reconciled_at,
        reconciledBy: s.reconciled_by,
        notes: s.notes,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
        items,
        stats,
      };
    } catch (err) {
      console.error("Failed to fetch session details from Supabase:", err);
    }
  }

  // Fallback
  try {
    const res = await fetch(`/api/stock-opname/sessions/${sessionId}`);
    if (res.ok) {
      const json = await res.json();
      return json.session || null;
    }
  } catch (err) {
    console.warn("Fallback /api/stock-opname/sessions/[id] error:", err);
  }

  return null;
}

export async function createStockOpnameSession(payload: {
  title: string;
  companyId?: string | null;
  locationScope?: string;
  categoryScope?: string;
  notes?: string | null;
}): Promise<{ session: any; error: string | null }> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.rpc("create_stock_opname_session", {
        p_title: payload.title.trim(),
        p_company_id: payload.companyId && payload.companyId !== "ALL" ? payload.companyId : null,
        p_location_scope: payload.locationScope || "ALL",
        p_category_scope: payload.categoryScope || "ALL",
        p_notes: payload.notes || null,
      });

      if (error) return { session: null, error: error.message };
      return { session: data, error: null };
    } catch (err: any) {
      return { session: null, error: err.message };
    }
  }

  // Fallback
  try {
    const res = await fetch("/api/stock-opname/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (res.ok) return { session: json.session, error: null };
    return { session: null, error: json.error || "Failed to create session" };
  } catch (err: any) {
    return { session: null, error: err.message };
  }
}

export async function recordScan(
  sessionId: string,
  assetId: string,
  payload: {
    location: string;
    condition: PhysicalCondition;
    employeeId?: string | null;
    notes?: string | null;
  }
): Promise<{ result: any; isOffline?: boolean; error: string | null }> {
  // If browser is offline, store in IndexedDB queue
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    try {
      await enqueueOfflineScan({
        sessionId,
        assetId,
        location: payload.location,
        condition: payload.condition,
        employeeId: payload.employeeId,
        notes: payload.notes,
      });
      return {
        result: {
          offline: true,
          message: "Scan recorded in offline queue. Will synchronize when online.",
        },
        isOffline: true,
        error: null,
      };
    } catch (e: any) {
      return { result: null, error: "Failed to save offline scan: " + e.message };
    }
  }

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.rpc("record_stock_opname_scan", {
        p_session_id: sessionId,
        p_asset_id: assetId,
        p_location: payload.location,
        p_condition: payload.condition,
        p_employee_id: payload.employeeId || null,
        p_notes: payload.notes || null,
      });

      if (error) return { result: null, error: error.message };
      return { result: data, isOffline: false, error: null };
    } catch (err: any) {
      return { result: null, error: err.message };
    }
  }

  // Fallback
  try {
    const res = await fetch(`/api/stock-opname/sessions/${sessionId}/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetId,
        actualLocation: payload.location,
        actualCondition: payload.condition,
        actualEmployeeId: payload.employeeId,
        notes: payload.notes,
      }),
    });
    const json = await res.json();
    if (res.ok) return { result: json, error: null };
    return { result: null, error: json.error || "Failed to record scan" };
  } catch (err: any) {
    return { result: null, error: err.message };
  }
}

export async function reconcileStockOpnameSession(
  sessionId: string,
  reconciliationNotes?: string
): Promise<{ result: any; error: string | null }> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.rpc("reconcile_stock_opname", {
        p_session_id: sessionId,
        p_reconciliation_notes: reconciliationNotes || null,
      });

      if (error) return { result: null, error: error.message };
      return { result: data, error: null };
    } catch (err: any) {
      return { result: null, error: err.message };
    }
  }

  // Fallback
  try {
    const res = await fetch(`/api/stock-opname/sessions/${sessionId}/reconcile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reconciliationNotes }),
    });
    const json = await res.json();
    if (res.ok) return { result: json, error: null };
    return { result: null, error: json.error || "Failed to reconcile session" };
  } catch (err: any) {
    return { result: null, error: err.message };
  }
}

export async function deleteStockOpnameSession(sessionId: string): Promise<{ success: boolean; error: string | null }> {
  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase.from("stock_opname_sessions").delete().eq("id", sessionId);
      if (error) return { success: false, error: error.message };
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // Fallback
  try {
    const res = await fetch(`/api/stock-opname/sessions/${sessionId}`, { method: "DELETE" });
    if (res.ok) return { success: true, error: null };
    const json = await res.json();
    return { success: false, error: json.error || "Failed to delete session" };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Client-side Stock Opname Excel Report Generation
 */
export async function exportStockOpnameToExcel(sessionId: string): Promise<void> {
  const session = await getStockOpnameSessionDetails(sessionId);
  if (!session) {
    alert("Could not load session details for export.");
    return;
  }

  const rows = (session.items || []).map((item, idx) => ({
    No: idx + 1,
    "Asset Tag": item.asset.assetTag,
    "Asset Name": item.asset.assetName,
    Entity: item.asset.company?.code || "",
    Category: item.asset.category,
    Model: item.asset.model,
    "Serial Number": item.asset.serialNumber || "-",
    "Verification Status": item.verificationStatus,
    "Expected Location": item.expectedLocation || "-",
    "Actual Location": item.actualLocation || "-",
    "Expected Employee": item.expectedEmployee?.name || "-",
    "Actual Employee": item.actualEmployee?.name || "-",
    "Expected Condition": item.expectedCondition || "-",
    "Actual Condition": item.actualCondition || "-",
    "Scanned At": item.scannedAt ? new Date(item.scannedAt).toLocaleString() : "-",
    "Scanned By": item.scannedBy || "-",
    "Scan Count": item.scanCount,
    "Discrepancy Notes": item.discrepancyNotes || "-",
    Reconciled: item.reconciled ? "YES" : "NO",
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Stock Opname Audit");

  const filename = `Stock_Opname_${session.sessionNumber}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(workbook, filename);
}
