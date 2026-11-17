import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ROLE_PERMISSIONS, sanitizeAssetForRole } from "@/lib/permissions";
import { AssignmentAction, PhysicalCondition } from "@/types";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    const permissions = ROLE_PERMISSIONS[session.role];

    if (!permissions.canAssignAssets) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to assign or transfer assets." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      actionType, // "ASSIGN" | "RETURN" | "TRANSFER" | "REPLACEMENT"
      employeeId,
      conditionAtAction = "GOOD",
      handoverDocRef,
      notes,
    }: {
      actionType: AssignmentAction;
      employeeId?: string;
      conditionAtAction: PhysicalCondition;
      handoverDocRef?: string;
      notes?: string;
    } = body;

    const asset = await prisma.asset.findUnique({
      where: { id: params.id },
      include: {
        assignedEmployee: true,
      },
    });

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    const now = new Date();

    let createdAssignmentRecordId: string | null = null;

    const updatedAsset = await prisma.$transaction(async (tx) => {
      // Find active assignment if returning to capture its record ID
      const activeAssignment = await tx.assetAssignment.findFirst({
        where: { assetId: params.id, returnedAt: null },
        orderBy: { assignedAt: "desc" },
      });
      if (activeAssignment) {
        createdAssignmentRecordId = activeAssignment.id;
      }

      // 1. Close any existing active assignment record without overwriting history
      await tx.assetAssignment.updateMany({
        where: {
          assetId: params.id,
          returnedAt: null,
        },
        data: {
          returnedAt: now,
        },
      });

      let newStatus = asset.status;
      let newEmployeeId: string | null = null;
      let historyNotes = "";

      if (actionType === "RETURN") {
        newStatus = "AVAILABLE";
        newEmployeeId = null;
        historyNotes = `Asset returned by ${asset.assignedEmployee?.name || "employee"}. Condition: ${conditionAtAction}. Handover Ref: ${handoverDocRef || "N/A"}.`;
      } else if (actionType === "ASSIGN" || actionType === "TRANSFER") {
        if (!employeeId) {
          throw new Error("Employee must be selected for assignment or transfer.");
        }
        const targetEmployee = await tx.employee.findUnique({
          where: { id: employeeId },
        });
        if (!targetEmployee) {
          throw new Error("Target employee not found.");
        }

        newStatus = "IN_USE";
        newEmployeeId = employeeId;
        historyNotes = `${actionType === "TRANSFER" ? "Transferred" : "Assigned"} to ${targetEmployee.name} (${targetEmployee.employeeId}). Condition: ${conditionAtAction}. Handover Ref: ${handoverDocRef || "N/A"}.`;

        // Create new immutable assignment record
        const newAssign = await tx.assetAssignment.create({
          data: {
            assetId: params.id,
            employeeId,
            actionType,
            conditionAtAction,
            assignedAt: now,
            handoverDocRef: handoverDocRef || null,
            performedBy: session.name,
            notes: notes || null,
          },
        });
        createdAssignmentRecordId = newAssign.id;
      } else if (actionType === "REPLACEMENT") {
        newStatus = "MAINTENANCE";
        newEmployeeId = null;
        historyNotes = `Asset marked for replacement / maintenance. Condition: ${conditionAtAction}.`;

        const newRep = await tx.assetAssignment.create({
          data: {
            assetId: params.id,
            employeeId: null,
            actionType: "REPLACEMENT",
            conditionAtAction,
            assignedAt: now,
            returnedAt: now,
            handoverDocRef: handoverDocRef || null,
            performedBy: session.name,
            notes: notes || null,
          },
        });
        createdAssignmentRecordId = newRep.id;
      }

      // 2. Update current asset state
      const updated = await tx.asset.update({
        where: { id: params.id },
        data: {
          status: newStatus,
          assignedEmployeeId: newEmployeeId,
          physicalCondition: conditionAtAction,
        },
        include: {
          company: true,
          assignedEmployee: true,
          assignments: {
            orderBy: { assignedAt: "desc" },
            include: { employee: true },
          },
          photos: {
            orderBy: { createdAt: "desc" },
          },
        },
      });

      // 3. Record in AssetHistory audit log
      await tx.assetHistory.create({
        data: {
          assetId: params.id,
          action: actionType,
          performedBy: session.name,
          notes: `${historyNotes} Performed by ${session.name}. ${notes ? `User notes: ${notes}` : ""}`,
        },
      });

      return updated;
    });

    return NextResponse.json({
      asset: sanitizeAssetForRole(updatedAsset, session.role),
      assignmentId: createdAssignmentRecordId,
      message: `Asset assignment operation '${actionType}' completed successfully.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to update asset assignment" },
      { status: 500 }
    );
  }
}

