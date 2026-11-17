import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import * as XLSX from "xlsx";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userSession = await getSession();
    const permissions = ROLE_PERMISSIONS[userSession.role];

    if (!permissions.canViewAssets) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { id: sessionId } = params;

    const session = await prisma.stockOpnameSession.findUnique({
      where: { id: sessionId },
      include: {
        company: { select: { id: true, code: true, name: true } },
        items: {
          orderBy: [{ isUnexpected: "desc" }, { scannedAt: "desc" }],
          include: {
            asset: {
              include: {
                company: { select: { code: true, name: true } },
                assignedEmployee: { select: { name: true, employeeId: true } },
              },
            },
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Stock Opname session not found" }, { status: 404 });
    }

    // Resolve employee references
    const empIds = new Set<string>();
    session.items.forEach((it) => {
      if (it.expectedEmployeeId) empIds.add(it.expectedEmployeeId);
      if (it.actualEmployeeId) empIds.add(it.actualEmployeeId);
    });
    const employees = empIds.size > 0
      ? await prisma.employee.findMany({
          where: { id: { in: Array.from(empIds) } },
          select: { id: true, name: true, employeeId: true },
        })
      : [];
    const empMap = new Map(employees.map((e) => [e.id, `${e.name} (${e.employeeId})`]));

    // 1. Sheet 1: Audit Summary
    const totalExpected = session.items.filter((it) => !it.isUnexpected).length;
    const scannedCount = session.items.filter((it) => it.scannedAt !== null).length;
    const verifiedCount = session.items.filter((it) => it.verificationStatus === "VERIFIED").length;
    const locationMismatchCount = session.items.filter((it) => it.verificationStatus === "MISMATCH_LOCATION").length;
    const userMismatchCount = session.items.filter((it) => it.verificationStatus === "MISMATCH_USER").length;
    const missingCount = session.items.filter((it) => it.verificationStatus === "MISSING").length;
    const unexpectedCount = session.items.filter((it) => it.isUnexpected).length;
    const duplicateScansCount = session.items.reduce((acc, it) => acc + (it.scanCount > 1 ? it.scanCount - 1 : 0), 0);
    const progressPct = totalExpected > 0 ? ((scannedCount / totalExpected) * 100).toFixed(1) + "%" : "100%";

    const summaryData = [
      ["IT ASSET MANAGEMENT SYSTEM - STOCK OPNAME AUDIT REPORT"],
      [],
      ["Session Number", session.sessionNumber],
      ["Audit Title", session.title],
      ["Company Entity", session.company ? `${session.company.code} - ${session.company.name}` : "All Entities (GMD • GMC • TEL)"],
      ["Location Scope", session.locationScope || "ALL"],
      ["Category Scope", session.categoryScope || "ALL"],
      ["Audit Status", session.status],
      ["Auditor / Conducted By", session.conductedBy || "Not Specified"],
      ["Audit Started At", session.startDate.toLocaleString()],
      ["Audit Reconciled At", session.reconciledAt ? session.reconciledAt.toLocaleString() : "Pending Reconciliation"],
      ["Reconciled By", session.reconciledBy || "N/A"],
      ["Auditor Notes", session.notes || ""],
      [],
      ["AUDIT KEY PERFORMANCE INDICATORS", "COUNT", "PERCENTAGE OF SCOPE"],
      ["Total Expected Assets in Scope", totalExpected, "100.0%"],
      ["Total Assets Physically Scanned", scannedCount, progressPct],
      ["Verified Matching (Location & Custodian)", verifiedCount, totalExpected > 0 ? ((verifiedCount / totalExpected) * 100).toFixed(1) + "%" : "0%"],
      ["Location Mismatches", locationMismatchCount, totalExpected > 0 ? ((locationMismatchCount / totalExpected) * 100).toFixed(1) + "%" : "0%"],
      ["Custodian / User Mismatches", userMismatchCount, totalExpected > 0 ? ((userMismatchCount / totalExpected) * 100).toFixed(1) + "%" : "0%"],
      ["Missing / Unscanned Hardware", missingCount, totalExpected > 0 ? ((missingCount / totalExpected) * 100).toFixed(1) + "%" : "0%"],
      ["Unexpected / Extra Hardware Found", unexpectedCount, "N/A"],
      ["Duplicate Scans Detected", duplicateScansCount, "N/A"],
    ];

    // 2. Sheet 2: Full Reconciliation Matrix
    const matrixHeader = [
      "Asset Tag",
      "Asset Name",
      "Company",
      "Category",
      "Serial Number",
      "Verification Status",
      "Expected Location",
      "Actual Location",
      "Location Match",
      "Expected Custodian",
      "Actual Custodian",
      "Assignee Match",
      "Expected Condition",
      "Actual Condition",
      "Scan Count",
      "Scanned At",
      "Auditor",
      "Discrepancy Notes",
      "Reconciled",
    ];

    const matrixRows = session.items.map((it) => {
      const expEmp = it.expectedEmployeeId ? empMap.get(it.expectedEmployeeId) || it.expectedEmployeeId : "Unassigned / Pool";
      const actEmp = it.actualEmployeeId ? empMap.get(it.actualEmployeeId) || it.actualEmployeeId : (it.scannedAt ? "Unassigned / Pool" : "Not Scanned");
      const locMatch = !it.scannedAt ? "UNSCANNED" : it.expectedLocation === it.actualLocation ? "MATCH" : "MISMATCH";
      const usrMatch = !it.scannedAt ? "UNSCANNED" : it.expectedEmployeeId === it.actualEmployeeId ? "MATCH" : "MISMATCH";

      return [
        it.asset.assetTag,
        it.asset.assetName,
        it.asset.company.code,
        it.asset.category,
        it.asset.serialNumber || "N/A",
        it.verificationStatus,
        it.expectedLocation || "N/A",
        it.actualLocation || "N/A",
        locMatch,
        expEmp,
        actEmp,
        usrMatch,
        it.expectedCondition || "N/A",
        it.actualCondition || "N/A",
        it.scanCount,
        it.scannedAt ? it.scannedAt.toLocaleString() : "Pending",
        it.scannedBy || "N/A",
        it.discrepancyNotes || "",
        it.reconciled ? "YES" : "NO",
      ];
    });

    // 3. Sheet 3: Discrepancies Only
    const discrepanciesRows = matrixRows.filter((row) => {
      const status = row[5];
      const isMismatch = status !== "VERIFIED";
      const isDuplicate = Number(row[14]) > 1;
      return isMismatch || isDuplicate;
    });

    const wb = XLSX.utils.book_new();

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    wsSummary["!cols"] = [{ wch: 35 }, { wch: 25 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, "Audit Summary");

    const wsMatrix = XLSX.utils.aoa_to_sheet([matrixHeader, ...matrixRows]);
    wsMatrix["!cols"] = [
      { wch: 16 }, { wch: 26 }, { wch: 10 }, { wch: 14 }, { wch: 18 },
      { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 25 },
      { wch: 25 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 12 },
      { wch: 20 }, { wch: 18 }, { wch: 35 }, { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, wsMatrix, "Reconciliation Matrix");

    const wsDiscrepancies = XLSX.utils.aoa_to_sheet([matrixHeader, ...discrepanciesRows]);
    wsDiscrepancies["!cols"] = wsMatrix["!cols"];
    XLSX.utils.book_append_sheet(wb, wsDiscrepancies, "Audit Discrepancies");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const filename = `Stock_Opname_${session.sessionNumber}_${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    console.error("Error exporting Stock Opname report:", err);
    return NextResponse.json({ error: err.message || "Failed to generate Excel report" }, { status: 500 });
  }
}

