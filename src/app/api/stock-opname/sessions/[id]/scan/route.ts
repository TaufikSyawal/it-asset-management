import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import { parseQRScanInput } from "@/lib/qrcode";
import { PhysicalCondition } from "@/types";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userSession = await getSession();
    const permissions = ROLE_PERMISSIONS[userSession.role];

    if (!permissions.canManageStockOpname) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { id: sessionId } = params;
    const body = await request.json();
    const {
      rawInput,
      assetId: explicitAssetId,
      assetTag: explicitAssetTag,
      qrCodeToken: explicitToken,
      actualLocation,
      actualCondition = "GOOD",
      actualEmployeeId,
      scannedBy,
      scannedAt: clientScannedAt,
      notes,
    } = body;

    // 1. Verify session exists and is active
    const session = await prisma.stockOpnameSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json({ error: "Audit session not found" }, { status: 404 });
    }

    if (session.status === "COMPLETED" || session.status === "CANCELLED") {
      return NextResponse.json(
        { error: `Cannot scan into session ${session.sessionNumber} because its status is ${session.status}.` },
        { status: 400 }
      );
    }

    // 2. Parse input (from QR code, camera, barcode, or manual string)
    let parsedId = explicitAssetId;
    let parsedTag = explicitAssetTag;
    let parsedToken = explicitToken;

    if (rawInput && typeof rawInput === "string") {
      const parsed = parseQRScanInput(rawInput);
      if (parsed.assetId && !parsedId) parsedId = parsed.assetId;
      if (parsed.assetTag && !parsedTag) parsedTag = parsed.assetTag;
      if (parsed.qrCodeToken && !parsedToken) parsedToken = parsed.qrCodeToken;
    }

    // 3. Resolve target asset from PostgreSQL
    const orConditions: any[] = [];
    if (parsedId) orConditions.push({ id: parsedId });
    if (parsedToken) orConditions.push({ qrCodeToken: parsedToken });
    if (parsedTag) orConditions.push({ assetTag: parsedTag });
    if (rawInput && typeof rawInput === "string") {
      orConditions.push({ serialNumber: rawInput.trim() });
    }

    if (orConditions.length === 0) {
      return NextResponse.json(
        { error: "Please provide a valid QR Code payload, Asset Tag, or Asset ID." },
        { status: 400 }
      );
    }

    const asset = await prisma.asset.findFirst({
      where: {
        OR: orConditions,
        isArchived: false,
      },
      include: {
        company: { select: { id: true, code: true, name: true } },
        assignedEmployee: {
          select: { id: true, employeeId: true, name: true, department: true },
        },
      },
    });

    if (!asset) {
      return NextResponse.json(
        {
          error: "Asset not found",
          message: `No active hardware asset found matching: ${rawInput || parsedTag || parsedId}`,
          notFoundInput: rawInput || parsedTag || parsedId,
        },
        { status: 404 }
      );
    }

    const scanTimestamp = clientScannedAt ? new Date(clientScannedAt) : new Date();
    const auditor = scannedBy || userSession.name;
    const resolvedLocation = actualLocation || asset.location;
    const resolvedCondition = (actualCondition as PhysicalCondition) || asset.physicalCondition;

    // 4. Check if asset already exists in session items
    const existingItem = await prisma.stockOpnameItem.findUnique({
      where: {
        sessionId_assetId: {
          sessionId,
          assetId: asset.id,
        },
      },
    });

    let updatedItem;
    let isDuplicateScan = false;
    let isUnexpected = false;
    let discrepancyType: "NONE" | "DUPLICATE" | "LOCATION_MISMATCH" | "USER_MISMATCH" | "UNEXPECTED" = "NONE";
    const discrepancyNotesArr: string[] = [];

    if (existingItem) {
      // Asset is in expected snapshot
      isDuplicateScan = existingItem.scanCount > 0;
      const newScanCount = existingItem.scanCount + 1;

      if (isDuplicateScan) {
        discrepancyType = "DUPLICATE";
        discrepancyNotesArr.push(`Duplicate scan #${newScanCount} recorded at ${scanTimestamp.toLocaleTimeString()}`);
      }

      const locationMismatch = Boolean(
        existingItem.expectedLocation &&
        resolvedLocation &&
        existingItem.expectedLocation.trim().toLowerCase() !== resolvedLocation.trim().toLowerCase()
      );

      const userMismatch = Boolean(
        actualEmployeeId !== undefined &&
        actualEmployeeId !== null &&
        actualEmployeeId !== "" &&
        existingItem.expectedEmployeeId !== actualEmployeeId
      );

      let verificationStatus: "VERIFIED" | "MISMATCH_LOCATION" | "MISMATCH_USER" = "VERIFIED";

      if (locationMismatch) {
        verificationStatus = "MISMATCH_LOCATION";
        if (discrepancyType === "NONE") discrepancyType = "LOCATION_MISMATCH";
        discrepancyNotesArr.push(
          `Location mismatch: Expected '${existingItem.expectedLocation}', found at '${resolvedLocation}'`
        );
      }

      if (userMismatch) {
        verificationStatus = "MISMATCH_USER";
        if (discrepancyType === "NONE") discrepancyType = "USER_MISMATCH";
        discrepancyNotesArr.push(`Assignee mismatch: Expected different custodian than recorded`);
      }

      if (resolvedCondition !== existingItem.expectedCondition) {
        discrepancyNotesArr.push(
          `Condition changed: was '${existingItem.expectedCondition}', now '${resolvedCondition}'`
        );
      }

      updatedItem = await prisma.stockOpnameItem.update({
        where: { id: existingItem.id },
        data: {
          scannedAt: scanTimestamp,
          scannedBy: auditor,
          verificationStatus,
          actualLocation: resolvedLocation,
          actualCondition: resolvedCondition,
          actualEmployeeId: actualEmployeeId || existingItem.actualEmployeeId,
          scanCount: newScanCount,
          discrepancyNotes: discrepancyNotesArr.length > 0 ? discrepancyNotesArr.join(". ") : null,
          notes: notes ? (existingItem.notes ? `${existingItem.notes}\n${notes}` : notes) : existingItem.notes,
        },
        include: {
          asset: {
            include: {
              company: { select: { id: true, code: true, name: true } },
              assignedEmployee: { select: { id: true, employeeId: true, name: true } },
            },
          },
        },
      });
    } else {
      // Asset was NOT in expected scope -> Unexpected Asset found!
      isUnexpected = true;
      discrepancyType = "UNEXPECTED";
      discrepancyNotesArr.push(
        `Unexpected asset: Not part of original audit scope (Belongs to ${asset.company.code}, Location '${asset.location}')`
      );

      updatedItem = await prisma.stockOpnameItem.create({
        data: {
          sessionId,
          assetId: asset.id,
          expectedLocation: asset.location,
          expectedEmployeeId: asset.assignedEmployeeId,
          expectedCondition: asset.physicalCondition,
          actualLocation: resolvedLocation,
          actualCondition: resolvedCondition,
          actualEmployeeId: actualEmployeeId || asset.assignedEmployeeId,
          scannedAt: scanTimestamp,
          scannedBy: auditor,
          verificationStatus: "UNREGISTERED",
          isUnexpected: true,
          scanCount: 1,
          discrepancyNotes: discrepancyNotesArr.join(". "),
          notes,
        },
        include: {
          asset: {
            include: {
              company: { select: { id: true, code: true, name: true } },
              assignedEmployee: { select: { id: true, employeeId: true, name: true } },
            },
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Scanned: ${asset.assetTag} - ${asset.assetName} [${updatedItem.verificationStatus}]`,
      item: updatedItem,
      asset,
      isDuplicateScan,
      isUnexpected,
      discrepancyType,
      verificationStatus: updatedItem.verificationStatus,
      discrepancyNotes: updatedItem.discrepancyNotes,
    });
  } catch (err: any) {
    console.error("Error processing scan:", err);
    return NextResponse.json({ error: err.message || "Failed to process scan" }, { status: 500 });
  }
}

