import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import { StockOpnameSessionDTO, StockOpnameSessionStats } from "@/types";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    const permissions = ROLE_PERMISSIONS[session.role];

    if (!permissions.canViewAssets) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    const status = searchParams.get("status");

    const where: any = {};
    if (companyId && companyId !== "ALL") {
      where.companyId = companyId;
    }
    if (status && status !== "ALL") {
      where.status = status;
    }

    const sessions = await prisma.stockOpnameSession.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        company: {
          select: { id: true, code: true, name: true },
        },
        items: {
          select: {
            id: true,
            verificationStatus: true,
            scannedAt: true,
            isUnexpected: true,
            scanCount: true,
          },
        },
      },
    });

    const formattedSessions: StockOpnameSessionDTO[] = sessions.map((s) => {
      const totalExpected = s.items.filter((it) => !it.isUnexpected).length;
      const scannedCount = s.items.filter((it) => it.scannedAt !== null).length;
      const verifiedCount = s.items.filter((it) => it.verificationStatus === "VERIFIED").length;
      const locationMismatchCount = s.items.filter((it) => it.verificationStatus === "MISMATCH_LOCATION").length;
      const userMismatchCount = s.items.filter((it) => it.verificationStatus === "MISMATCH_USER").length;
      const missingCount = s.items.filter(
        (it) => it.verificationStatus === "MISSING" || (s.status === "COMPLETED" && it.verificationStatus === "PENDING")
      ).length;
      const unexpectedCount = s.items.filter((it) => it.isUnexpected).length;
      const duplicateScansCount = s.items.reduce(
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

      return {
        id: s.id,
        sessionNumber: s.sessionNumber,
        title: s.title,
        companyId: s.companyId,
        company: s.company,
        locationScope: s.locationScope,
        categoryScope: s.categoryScope,
        status: s.status as any,
        startDate: s.startDate.toISOString(),
        endDate: s.endDate?.toISOString() || null,
        conductedBy: s.conductedBy,
        reconciledAt: s.reconciledAt?.toISOString() || null,
        reconciledBy: s.reconciledBy,
        notes: s.notes,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
        stats,
      };
    });

    return NextResponse.json({ sessions: formattedSessions });
  } catch (err: any) {
    console.error("Error fetching Stock Opname sessions:", err);
    return NextResponse.json({ error: err.message || "Failed to load audit sessions" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userSession = await getSession();
    const permissions = ROLE_PERMISSIONS[userSession.role];

    if (!permissions.canManageStockOpname) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to initialize Stock Opname sessions." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { title, companyId, locationScope, categoryScope, conductedBy, notes } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Session title is required" }, { status: 400 });
    }

    // Generate human-friendly sequential session number: OPN-YYYY-XXX
    const currentYear = new Date().getFullYear();
    const countThisYear = await prisma.stockOpnameSession.count({
      where: {
        sessionNumber: {
          startsWith: `OPN-${currentYear}-`,
        },
      },
    });
    const sessionNumber = `OPN-${currentYear}-${String(countThisYear + 1).padStart(3, "0")}`;

    // Query all matching active assets in scope for snapshot capture
    const assetWhere: any = {
      isArchived: false,
    };
    if (companyId && companyId !== "ALL") {
      assetWhere.companyId = companyId;
    }
    if (locationScope && locationScope !== "ALL") {
      assetWhere.location = locationScope;
    }
    if (categoryScope && categoryScope !== "ALL") {
      assetWhere.category = categoryScope;
    }

    const assetsInScope = await prisma.asset.findMany({
      where: assetWhere,
      select: {
        id: true,
        location: true,
        assignedEmployeeId: true,
        physicalCondition: true,
      },
    });

    const newSession = await prisma.$transaction(async (tx) => {
      const created = await tx.stockOpnameSession.create({
        data: {
          sessionNumber,
          title: title.trim(),
          companyId: companyId && companyId !== "ALL" ? companyId : null,
          locationScope: locationScope || "ALL",
          categoryScope: categoryScope || "ALL",
          conductedBy: conductedBy || userSession.name,
          notes: notes?.trim() || null,
          status: "IN_PROGRESS",
          startDate: new Date(),
        },
        include: {
          company: { select: { id: true, code: true, name: true } },
        },
      });

      // Capture immutable snapshot of expected items at session initialization
      if (assetsInScope.length > 0) {
        await tx.stockOpnameItem.createMany({
          data: assetsInScope.map((asset) => ({
            sessionId: created.id,
            assetId: asset.id,
            expectedLocation: asset.location,
            expectedEmployeeId: asset.assignedEmployeeId,
            expectedCondition: asset.physicalCondition,
            verificationStatus: "PENDING",
            scanCount: 0,
            isUnexpected: false,
          })),
        });
      }

      return created;
    });

    return NextResponse.json(
      {
        session: newSession,
        expectedItemsCount: assetsInScope.length,
        message: `Stock Opname session ${sessionNumber} created with ${assetsInScope.length} expected assets in scope.`,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("Error creating Stock Opname session:", err);
    return NextResponse.json({ error: err.message || "Failed to create audit session" }, { status: 500 });
  }
}

