import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ROLE_PERMISSIONS } from "@/lib/permissions";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userSession = await getSession();
    const permissions = ROLE_PERMISSIONS[userSession.role];

    if (!permissions.canReconcileStockOpname) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to reconcile Stock Opname audits." },
        { status: 403 }
      );
    }

    const { id: sessionId } = params;
    const body = await request.json().catch(() => ({}));
    const {
      applyLocationUpdates = true,
      applyConditionUpdates = true,
      markUnscannedAsMissing = false,
      reconciliationNotes,
    } = body;

    const session = await prisma.stockOpnameSession.findUnique({
      where: { id: sessionId },
      include: {
        items: {
          include: {
            asset: true,
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.status === "COMPLETED") {
      return NextResponse.json(
        { error: `Session ${session.sessionNumber} has already been reconciled.` },
        { status: 400 }
      );
    }

    let updatedAssetCount = 0;
    let missingMarkedCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const item of session.items) {
        const asset = item.asset;
        const changes: Record<string, { from: any; to: any }> = {};
        const assetUpdate: any = {};

        // 1. Process location updates
        if (
          applyLocationUpdates &&
          item.actualLocation &&
          item.actualLocation.trim().toLowerCase() !== asset.location.trim().toLowerCase()
        ) {
          changes.location = { from: asset.location, to: item.actualLocation };
          assetUpdate.location = item.actualLocation;
        }

        // 2. Process physical condition updates
        if (
          applyConditionUpdates &&
          item.actualCondition &&
          item.actualCondition !== asset.physicalCondition
        ) {
          changes.physicalCondition = { from: asset.physicalCondition, to: item.actualCondition };
          assetUpdate.physicalCondition = item.actualCondition;
        }

        // 3. Process missing unscanned assets
        if (item.verificationStatus === "PENDING" && !item.scannedAt) {
          if (markUnscannedAsMissing) {
            changes.status = { from: asset.status, to: "MISSING" };
            assetUpdate.status = "MISSING";
            missingMarkedCount++;
          }
          await tx.stockOpnameItem.update({
            where: { id: item.id },
            data: {
              verificationStatus: "MISSING",
              reconciled: true,
              discrepancyNotes: "Asset was not scanned during the audit session; marked as MISSING.",
            },
          });
        } else {
          await tx.stockOpnameItem.update({
            where: { id: item.id },
            data: { reconciled: true },
          });
        }

        // Apply asset updates & record immutable history log
        if (Object.keys(assetUpdate).length > 0) {
          await tx.asset.update({
            where: { id: asset.id },
            data: assetUpdate,
          });

          await tx.assetHistory.create({
            data: {
              assetId: asset.id,
              action: "STOCK_OPNAME_RECONCILED",
              changes,
              notes: `Reconciled during Stock Opname session ${session.sessionNumber}. Auditor: ${session.conductedBy || userSession.name}.${reconciliationNotes ? " Notes: " + reconciliationNotes : ""}`,
              performedBy: userSession.name,
            },
          });

          updatedAssetCount++;
        }
      }

      // Close and complete the audit session
      const auditClosureNote = reconciliationNotes
        ? `${session.notes || ""}\n[Reconciled by ${userSession.name} on ${new Date().toISOString()}]: ${reconciliationNotes}`
        : session.notes;

      await tx.stockOpnameSession.update({
        where: { id: session.id },
        data: {
          status: "COMPLETED",
          endDate: new Date(),
          reconciledAt: new Date(),
          reconciledBy: userSession.name,
          notes: auditClosureNote,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: `Stock Opname session ${session.sessionNumber} successfully reconciled.`,
      updatedAssetCount,
      missingMarkedCount,
      reconciledBy: userSession.name,
    });
  } catch (err: any) {
    console.error("Error reconciling Stock Opname session:", err);
    return NextResponse.json({ error: err.message || "Failed to reconcile audit session" }, { status: 500 });
  }
}

