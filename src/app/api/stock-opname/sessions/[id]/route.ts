import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ROLE_PERMISSIONS, sanitizeAssetForRole } from "@/lib/permissions";
import { StockOpnameItemDTO, StockOpnameSessionDTO, StockOpnameSessionStats } from "@/types";

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

    const { id } = params;

    const sessionRecord = await prisma.stockOpnameSession.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, code: true, name: true } },
        items: {
          orderBy: [{ isUnexpected: "desc" }, { scannedAt: "desc" }, { createdAt: "asc" }],
          include: {
            asset: {
              include: {
                company: { select: { id: true, code: true, name: true } },
                assignedEmployee: {
                  select: { id: true, employeeId: true, name: true, department: true },
                },
              },
            },
          },
        },
      },
    });

    if (!sessionRecord) {
      return NextResponse.json({ error: "Stock Opname session not found" }, { status: 404 });
    }

    // Also fetch employees for resolving expectedEmployee and actualEmployee IDs
    const employeeIdsToFetch = new Set<string>();
    sessionRecord.items.forEach((item) => {
      if (item.expectedEmployeeId) employeeIdsToFetch.add(item.expectedEmployeeId);
      if (item.actualEmployeeId) employeeIdsToFetch.add(item.actualEmployeeId);
    });

    const employees = employeeIdsToFetch.size > 0
      ? await prisma.employee.findMany({
          where: { id: { in: Array.from(employeeIdsToFetch) } },
          select: { id: true, employeeId: true, name: true, department: true, companyId: true, status: true },
        })
      : [];
    const employeeMap = new Map(employees.map((e) => [e.id, e]));

    // Format items
    const formattedItems: StockOpnameItemDTO[] = sessionRecord.items.map((item) => {
      const sanitizedAsset = sanitizeAssetForRole(item.asset, userSession.role);
      const expectedEmp = item.expectedEmployeeId ? employeeMap.get(item.expectedEmployeeId) || null : null;
      const actualEmp = item.actualEmployeeId ? employeeMap.get(item.actualEmployeeId) || null : null;

      return {
        id: item.id,
        sessionId: item.sessionId,
        assetId: item.assetId,
        asset: sanitizedAsset,
        expectedLocation: item.expectedLocation,
        expectedEmployeeId: item.expectedEmployeeId,
        expectedEmployee: expectedEmp as any,
        expectedCondition: item.expectedCondition as any,
        scannedAt: item.scannedAt?.toISOString() || null,
        scannedBy: item.scannedBy,
        verificationStatus: item.verificationStatus as any,
        actualLocation: item.actualLocation,
        actualCondition: item.actualCondition as any,
        actualEmployeeId: item.actualEmployeeId,
        actualEmployee: actualEmp as any,
        isUnexpected: item.isUnexpected,
        scanCount: item.scanCount,
        discrepancyNotes: item.discrepancyNotes,
        reconciled: item.reconciled,
        notes: item.notes,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      };
    });

    // Compute live audit statistics
    const totalExpected = sessionRecord.items.filter((it) => !it.isUnexpected).length;
    const scannedCount = sessionRecord.items.filter((it) => it.scannedAt !== null).length;
    const verifiedCount = sessionRecord.items.filter((it) => it.verificationStatus === "VERIFIED").length;
    const locationMismatchCount = sessionRecord.items.filter((it) => it.verificationStatus === "MISMATCH_LOCATION").length;
    const userMismatchCount = sessionRecord.items.filter((it) => it.verificationStatus === "MISMATCH_USER").length;
    const missingCount = sessionRecord.items.filter(
      (it) => it.verificationStatus === "MISSING" || (sessionRecord.status === "COMPLETED" && it.verificationStatus === "PENDING")
    ).length;
    const unexpectedCount = sessionRecord.items.filter((it) => it.isUnexpected).length;
    const duplicateScansCount = sessionRecord.items.reduce(
      (acc, it) => acc + (it.scanCount > 1 ? it.scanCount - 1 : 0),
      0
    );

    const progressPercentage =
      totalExpected > 0 ? Math.min(100, Math.round((scannedCount / totalExpected) * 100)) : 100;

    const stats: StockOpnameSessionStats = {
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

    const sessionDTO: StockOpnameSessionDTO = {
      id: sessionRecord.id,
      sessionNumber: sessionRecord.sessionNumber,
      title: sessionRecord.title,
      companyId: sessionRecord.companyId,
      company: sessionRecord.company,
      locationScope: sessionRecord.locationScope,
      categoryScope: sessionRecord.categoryScope,
      status: sessionRecord.status as any,
      startDate: sessionRecord.startDate.toISOString(),
      endDate: sessionRecord.endDate?.toISOString() || null,
      conductedBy: sessionRecord.conductedBy,
      reconciledAt: sessionRecord.reconciledAt?.toISOString() || null,
      reconciledBy: sessionRecord.reconciledBy,
      notes: sessionRecord.notes,
      createdAt: sessionRecord.createdAt.toISOString(),
      updatedAt: sessionRecord.updatedAt.toISOString(),
      items: formattedItems,
      stats,
    };

    return NextResponse.json({ session: sessionDTO });
  } catch (err: any) {
    console.error("Error fetching Stock Opname session detail:", err);
    return NextResponse.json({ error: err.message || "Failed to load audit session details" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userSession = await getSession();
    const permissions = ROLE_PERMISSIONS[userSession.role];

    if (!permissions.canManageStockOpname) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { id } = params;

    const existing = await prisma.stockOpnameSession.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (existing.status === "COMPLETED") {
      return NextResponse.json(
        { error: "Cannot delete a completed and reconciled audit session. Audit trails must be preserved." },
        { status: 400 }
      );
    }

    await prisma.stockOpnameSession.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: `Session ${existing.sessionNumber} deleted.` });
  } catch (err: any) {
    console.error("Error deleting session:", err);
    return NextResponse.json({ error: err.message || "Failed to delete session" }, { status: 500 });
  }
}

