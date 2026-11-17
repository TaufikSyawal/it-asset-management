import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ROLE_PERMISSIONS, sanitizeAssetForRole } from "@/lib/permissions";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    const permissions = ROLE_PERMISSIONS[session.role];

    const asset = await prisma.asset.findUnique({
      where: { id: params.id },
      include: {
        company: true,
        assignedEmployee: {
          include: { company: true },
        },
        assignments: {
          orderBy: { assignedAt: "desc" },
          include: { employee: true },
        },
        photos: {
          orderBy: { createdAt: "desc" },
        },
        historyLogs: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    if (permissions.restrictedToOwnAssets && asset.assignedEmployeeId !== session.employeeId) {
      return NextResponse.json({ error: "Access denied to this asset" }, { status: 403 });
    }

    return NextResponse.json({
      asset: sanitizeAssetForRole(asset, session.role),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Error retrieving asset", details: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    const permissions = ROLE_PERMISSIONS[session.role];

    if (!permissions.canEditAssets && !permissions.canEditFinancials) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to edit assets." },
        { status: 403 }
      );
    }

    const currentAsset = await prisma.asset.findUnique({
      where: { id: params.id },
    });

    if (!currentAsset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    const body = await request.json();
    const updateData: any = {};
    const changes: Record<string, { from: any; to: any }> = {};

    // Fields that IT_ADMIN & SUPER_ADMIN can edit
    if (permissions.canEditAssets) {
      const allowedGeneralFields = [
        "assetName",
        "category",
        "model",
        "cpu",
        "ram",
        "serialNumber",
        "macAddress",
        "physicalCondition",
        "location",
        "laptopCode",
        "laptopAccount",
        "username",
        "notes",
      ];

      for (const field of allowedGeneralFields) {
        if (body[field] !== undefined && body[field] !== (currentAsset as any)[field]) {
          changes[field] = { from: (currentAsset as any)[field], to: body[field] };
          updateData[field] = body[field];
        }
      }
    }

    // Financial fields (Restricted to FINANCE and SUPER_ADMIN)
    if (permissions.canEditFinancials) {
      const allowedFinanceFields = [
        "purchaseCost",
        "usefulLifeMonths",
        "depreciationMethod",
        "netBookValue",
        "accumulatedDepreciation",
      ];

      for (const field of allowedFinanceFields) {
        if (body[field] !== undefined) {
          const numVal = body[field] !== null ? Number(body[field]) : null;
          if (numVal !== Number((currentAsset as any)[field])) {
            changes[field] = { from: (currentAsset as any)[field], to: numVal };
            updateData[field] = numVal;
          }
        }
      }
    }

    // If no changes
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({
        asset: sanitizeAssetForRole(currentAsset, session.role),
        message: "No fields modified",
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.asset.update({
        where: { id: params.id },
        data: updateData,
        include: {
          company: true,
          assignedEmployee: true,
          photos: {
            orderBy: { createdAt: "desc" },
          },
        },
      });

      // Immutable history log recording exact field diff
      await tx.assetHistory.create({
        data: {
          assetId: params.id,
          action: "UPDATED",
          performedBy: session.name,
          changes,
          notes: `Updated by ${session.name} (${session.role})`,
        },
      });

      return result;
    });

    return NextResponse.json({
      asset: sanitizeAssetForRole(updated, session.role),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to update asset", details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    const permissions = ROLE_PERMISSIONS[session.role];

    if (!permissions.canArchiveAssets) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to archive assets." },
        { status: 403 }
      );
    }

    const asset = await prisma.asset.findUnique({
      where: { id: params.id },
    });

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // Soft archive preserving historical integrity
    await prisma.$transaction(async (tx) => {
      await tx.asset.update({
        where: { id: params.id },
        data: {
          isArchived: true,
          status: "ARCHIVED",
        },
      });

      await tx.assetHistory.create({
        data: {
          assetId: params.id,
          action: "ARCHIVED",
          performedBy: session.name,
          notes: `Asset archived by ${session.name}. Retained in database for audit compliance.`,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: `Asset ${asset.assetTag} successfully archived.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to archive asset", details: error.message },
      { status: 500 }
    );
  }
}

