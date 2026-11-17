import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ROLE_PERMISSIONS, sanitizeAssetForRole } from "@/lib/permissions";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    const permissions = ROLE_PERMISSIONS[session.role];

    if (!permissions.canViewAssets) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const companyId = searchParams.get("companyId");
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const condition = searchParams.get("condition");
    const duplicateOnly = searchParams.get("isDuplicateTag") === "true";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "15", 10)));
    const skip = (page - 1) * limit;

    const where: any = {
      isArchived: status === "ARCHIVED" ? true : false,
    };

    // Employee role restriction: can only view own assigned hardware
    if (permissions.restrictedToOwnAssets) {
      if (session.employeeId) {
        where.assignedEmployeeId = session.employeeId;
      } else {
        return NextResponse.json({
          assets: [],
          total: 0,
          page,
          totalPages: 0,
          stats: null,
          role: session.role,
        });
      }
    }

    if (companyId && companyId !== "ALL") {
      where.companyId = companyId;
    }

    if (status && status !== "ALL" && status !== "ARCHIVED") {
      where.status = status;
    }

    if (category && category !== "ALL") {
      where.category = category;
    }

    if (condition && condition !== "ALL") {
      where.physicalCondition = condition;
    }

    if (duplicateOnly) {
      where.isDuplicateTag = true;
    }

    if (search) {
      where.OR = [
        { assetTag: { contains: search, mode: "insensitive" } },
        { assetName: { contains: search, mode: "insensitive" } },
        { model: { contains: search, mode: "insensitive" } },
        { cpu: { contains: search, mode: "insensitive" } },
        { ram: { contains: search, mode: "insensitive" } },
        { serialNumber: { contains: search, mode: "insensitive" } },
        { laptopCode: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
        { username: { contains: search, mode: "insensitive" } },
        { assignedEmployee: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [assetsRaw, total, allAssetsForStats, recentAssignmentsRaw] = await Promise.all([
      prisma.asset.findMany({
        where,
        include: {
          company: true,
          assignedEmployee: {
            include: { company: true },
          },
          assignments: {
            take: 1,
            orderBy: { assignedAt: "desc" },
            include: { employee: true },
          },
          photos: {
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.asset.count({ where }),
      // Aggregate stats scoped to active company filter
      prisma.asset.findMany({
        where: {
          isArchived: false,
          ...(companyId && companyId !== "ALL" ? { companyId } : {}),
        },
        select: {
          id: true,
          status: true,
          category: true,
          companyId: true,
          company: { select: { code: true, name: true } },
          physicalCondition: true,
          serialNumber: true,
          purchaseCost: true,
          netBookValue: true,
          isDuplicateTag: true,
          assignedEmployeeId: true,
        },
      }),
      // Recent assignments for IT Operations overview, filtered by active company scope
      prisma.assetAssignment.findMany({
        where: {
          ...(companyId && companyId !== "ALL" ? { asset: { companyId } } : {}),
        },
        take: 8,
        orderBy: { assignedAt: "desc" },
        include: {
          asset: {
            select: {
              id: true,
              assetTag: true,
              assetName: true,
              category: true,
              companyId: true,
              company: { select: { code: true } },
            },
          },
          employee: {
            select: { id: true, name: true, employeeId: true },
          },
        },
      }),
    ]);

    // Sanitize records based on user's role (masking financial fields where prohibited)
    const sanitizedAssets = assetsRaw.map((asset) => sanitizeAssetForRole(asset, session.role));

    const totalCount = allAssetsForStats.length;
    const inUseCount = allAssetsForStats.filter((a) => a.status === "IN_USE").length;
    const availableCount = allAssetsForStats.filter((a) => a.status === "AVAILABLE").length;
    const maintenanceCount = allAssetsForStats.filter((a) => a.status === "MAINTENANCE").length;
    const missingCount = allAssetsForStats.filter((a) => a.status === "MISSING").length;
    const disposedCount = allAssetsForStats.filter((a) => a.status === "DISPOSED").length;
    const duplicateTagsCount = allAssetsForStats.filter((a) => a.isDuplicateTag).length;
    const missingSerialsCount = allAssetsForStats.filter((a) => !a.serialNumber || a.serialNumber.trim() === "").length;

    // Distinct set of assets needing management/operational attention
    const attentionAssetIds = new Set(
      allAssetsForStats
        .filter((a) => a.isDuplicateTag || a.status === "MAINTENANCE" || a.status === "MISSING" || !a.serialNumber || a.physicalCondition === "DAMAGED" || a.physicalCondition === "POOR")
        .map((a) => a.id)
    );

    // Grouping by Company
    const companyCountMap = new Map<string, { code: string; name: string; count: number }>();
    for (const item of allAssetsForStats) {
      const code = item.company?.code || "Other";
      const existing = companyCountMap.get(code) || { code, name: item.company?.name || code, count: 0 };
      existing.count++;
      companyCountMap.set(code, existing);
    }
    const byCompany = Array.from(companyCountMap.values()).map((c) => ({
      ...c,
      percentage: totalCount > 0 ? Math.round((c.count / totalCount) * 100) : 0,
    }));

    // Grouping by Category
    const categoryCountMap = new Map<string, number>();
    for (const item of allAssetsForStats) {
      categoryCountMap.set(item.category, (categoryCountMap.get(item.category) || 0) + 1);
    }
    const byCategory = Array.from(categoryCountMap.entries()).map(([category, count]) => ({
      category,
      count,
      percentage: totalCount > 0 ? Math.round((count / totalCount) * 100) : 0,
    }));

    // Grouping by Status
    const statusCountMap = new Map<string, number>();
    for (const item of allAssetsForStats) {
      statusCountMap.set(item.status, (statusCountMap.get(item.status) || 0) + 1);
    }
    const byStatus = Array.from(statusCountMap.entries()).map(([status, count]) => ({
      status,
      count,
    }));

    // Grouping by Condition
    const conditionCountMap = new Map<string, number>();
    for (const item of allAssetsForStats) {
      conditionCountMap.set(item.physicalCondition, (conditionCountMap.get(item.physicalCondition) || 0) + 1);
    }
    const byCondition = Array.from(conditionCountMap.entries()).map(([condition, count]) => ({
      condition,
      count,
    }));

    // Calculate dynamic stats
    const stats = {
      total: totalCount,
      inUse: inUseCount,
      available: availableCount,
      maintenance: maintenanceCount,
      missing: missingCount,
      disposed: disposedCount,
      duplicateTags: duplicateTagsCount,
      missingSerials: missingSerialsCount,
      requiringAttention: attentionAssetIds.size,
      totalAttentionIssues: duplicateTagsCount + maintenanceCount + missingCount + missingSerialsCount,
      utilizationRate: totalCount > 0 ? Math.round((inUseCount / totalCount) * 100) : 0,
      byCompany,
      byCategory,
      byStatus,
      byCondition,
      recentAssignments: recentAssignmentsRaw,
      // Financial aggregates (only populated if user role has permission)
      totalPurchaseCost: permissions.canViewFinancials
        ? allAssetsForStats.reduce((sum, a) => sum + (Number(a.purchaseCost) || 0), 0)
        : null,
      totalNetBookValue: permissions.canViewFinancials
        ? allAssetsForStats.reduce((sum, a) => sum + (Number(a.netBookValue) || 0), 0)
        : null,
    };

    return NextResponse.json({
      assets: sanitizedAssets,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      stats,
      role: session.role,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Failed to fetch assets from database",
        details: error.message,
        hint: "Check PostgreSQL connection in .env and verify migrations.",
      },
      { status: 503 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    const permissions = ROLE_PERMISSIONS[session.role];

    if (!permissions.canCreateAssets) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to create assets." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      assetTag,
      assetName,
      companyId,
      category,
      model,
      cpu,
      ram,
      serialNumber,
      macAddress,
      status = "AVAILABLE",
      physicalCondition = "GOOD",
      assignedEmployeeId,
      location,
      purchaseDate,
      purchaseCost,
      usefulLifeMonths,
      depreciationMethod = "STRAIGHT_LINE",
      laptopCode,
      laptopAccount,
      username,
      notes,
    } = body;

    if (!assetTag || !assetName || !companyId || !model || !cpu || !ram || !location) {
      return NextResponse.json(
        { error: "Missing required fields (Asset Tag, Name, Company, Model, CPU, RAM, Location)." },
        { status: 400 }
      );
    }

    // Check duplicate Asset Tag in database
    const existingWithSameTag = await prisma.asset.findFirst({
      where: { assetTag: assetTag.trim(), isArchived: false },
    });

    const isDuplicate = !!existingWithSameTag;

    // Check unique Serial Number if provided
    if (serialNumber && serialNumber.trim() !== "") {
      const existingSerial = await prisma.asset.findFirst({
        where: { serialNumber: serialNumber.trim(), isArchived: false },
      });
      if (existingSerial) {
        return NextResponse.json(
          { error: `Serial Number '${serialNumber}' already exists on asset ${existingSerial.assetTag}` },
          { status: 400 }
        );
      }
    }

    // Determine initial status based on employee assignment
    let finalStatus = status;
    if (assignedEmployeeId && finalStatus === "AVAILABLE") {
      finalStatus = "IN_USE";
    }

    const newAsset = await prisma.$transaction(async (tx) => {
      // If tag is duplicate, also mark previous asset as duplicate tag
      if (isDuplicate && existingWithSameTag) {
        await tx.asset.update({
          where: { id: existingWithSameTag.id },
          data: { isDuplicateTag: true },
        });
      }

      // Generate unique QR verification token
      const qrCodeToken = `QR-${companyId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`.toUpperCase();

      const created = await tx.asset.create({
        data: {
          assetTag: assetTag.trim(),
          isDuplicateTag: isDuplicate,
          assetName: assetName.trim(),
          companyId,
          category: category || "LAPTOP",
          model: model.trim(),
          cpu: cpu.trim(),
          ram: ram.trim(),
          serialNumber: serialNumber ? serialNumber.trim() : null,
          macAddress: macAddress ? macAddress.trim() : null,
          status: finalStatus,
          physicalCondition: physicalCondition || "GOOD",
          assignedEmployeeId: assignedEmployeeId || null,
          location: location.trim(),
          purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
          purchaseCost: purchaseCost ? Number(purchaseCost) : null,
          usefulLifeMonths: usefulLifeMonths ? Number(usefulLifeMonths) : null,
          depreciationMethod,
          netBookValue: purchaseCost ? Number(purchaseCost) : null, // Initial net book value
          laptopCode: laptopCode ? laptopCode.trim() : null,
          laptopAccount: laptopAccount ? laptopAccount.trim() : null,
          username: username ? username.trim() : null,
          notes: notes ? notes.trim() : null,
          qrCodeToken,
        },
        include: {
          company: true,
          assignedEmployee: true,
        },
      });

      // Immutable history log
      await tx.assetHistory.create({
        data: {
          assetId: created.id,
          action: "CREATED",
          performedBy: session.name,
          notes: `Asset registered by ${session.name}. Initial status: ${finalStatus}.${
            isDuplicate ? " (Tagged as duplicate Asset Tag for review)" : ""
          }`,
        },
      });

      // Immutable assignment log if assigned
      if (assignedEmployeeId) {
        await tx.assetAssignment.create({
          data: {
            assetId: created.id,
            employeeId: assignedEmployeeId,
            actionType: "ASSIGN",
            conditionAtAction: physicalCondition || "GOOD",
            performedBy: session.name,
            notes: "Initial deployment upon asset registration",
          },
        });
      }

      return created;
    });

    return NextResponse.json(
      {
        asset: sanitizeAssetForRole(newAsset, session.role),
        duplicateNotice: isDuplicate
          ? "Asset Tag matches an existing record and has been flagged for audit review."
          : null,
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to create asset", details: error.message },
      { status: 500 }
    );
  }
}

