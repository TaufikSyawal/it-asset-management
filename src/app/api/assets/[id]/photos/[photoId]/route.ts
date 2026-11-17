import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import { storageProvider } from "@/lib/storage";

export async function GET(
  request: Request,
  { params }: { params: { id: string; photoId: string } }
) {
  try {
    const session = await getSession();
    const permissions = ROLE_PERMISSIONS[session.role];

    const asset = await prisma.asset.findUnique({
      where: { id: params.id },
      select: { id: true, assignedEmployeeId: true },
    });

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    if (permissions.restrictedToOwnAssets && asset.assignedEmployeeId !== session.employeeId) {
      return NextResponse.json({ error: "Access denied to this asset photo" }, { status: 403 });
    }

    const photo = await prisma.assetPhoto.findUnique({
      where: { id: params.photoId },
    });

    if (!photo || photo.assetId !== params.id) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    const url = new URL(request.url);
    const isThumb = url.searchParams.get("thumb") === "true";
    const isDownload = url.searchParams.get("download") === "true";

    const targetKey = (isThumb && photo.thumbnailKey) ? photo.thumbnailKey : photo.fileKey;
    const fileBuffer = await storageProvider.get(targetKey);

    if (!fileBuffer) {
      return NextResponse.json({ error: "Photo file not found in storage" }, { status: 404 });
    }

    const disposition = isDownload
      ? `attachment; filename="${photo.originalFilename || 'asset_photo.webp'}"`
      : "inline";

    return new NextResponse(fileBuffer as any, {
      status: 200,
      headers: {
        "Content-Type": photo.mimeType || "image/webp",
        "Content-Length": fileBuffer.length.toString(),
        "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800",
        "Content-Disposition": disposition,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to stream photo", details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; photoId: string } }
) {
  try {
    const session = await getSession();
    const permissions = ROLE_PERMISSIONS[session.role];

    if (!permissions.canManagePhotos) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to modify photos." },
        { status: 403 }
      );
    }

    const photo = await prisma.assetPhoto.findUnique({
      where: { id: params.photoId },
    });

    if (!photo || photo.assetId !== params.id) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    const body = await request.json();
    const { category, description, isPrimary } = body;

    const updateData: any = {};
    if (category !== undefined) updateData.category = category;
    if (description !== undefined) updateData.description = description ? description.trim() : null;

    if (isPrimary === true) {
      // Unset primary flag on other photos of this asset
      await prisma.assetPhoto.updateMany({
        where: { assetId: params.id },
        data: { isPrimary: false },
      });
      updateData.isPrimary = true;
    } else if (isPrimary === false && photo.isPrimary) {
      updateData.isPrimary = false;
    }

    const updated = await prisma.assetPhoto.update({
      where: { id: params.photoId },
      data: updateData,
    });

    await prisma.assetHistory.create({
      data: {
        assetId: params.id,
        action: "PHOTO_UPDATED",
        performedBy: session.name,
        notes: `Updated photo metadata: ${photo.originalFilename}${
          isPrimary ? " (Set as primary)" : ""
        }`,
      },
    });

    return NextResponse.json({
      success: true,
      photo: {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
        url: `/api/assets/${params.id}/photos/${updated.id}`,
        thumbnailUrl: `/api/assets/${params.id}/photos/${updated.id}?thumb=true`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to update photo", details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; photoId: string } }
) {
  try {
    const session = await getSession();
    const permissions = ROLE_PERMISSIONS[session.role];

    if (!permissions.canManagePhotos) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to delete photos." },
        { status: 403 }
      );
    }

    const photo = await prisma.assetPhoto.findUnique({
      where: { id: params.photoId },
    });

    if (!photo || photo.assetId !== params.id) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    // Delete stored files from disk/storage
    await storageProvider.delete(photo.fileKey);
    if (photo.thumbnailKey) {
      await storageProvider.delete(photo.thumbnailKey);
    }

    // Delete database record
    await prisma.assetPhoto.delete({
      where: { id: params.photoId },
    });

    // If deleted photo was primary, elect the latest remaining photo as primary
    if (photo.isPrimary) {
      const nextPrimary = await prisma.assetPhoto.findFirst({
        where: { assetId: params.id },
        orderBy: { createdAt: "desc" },
      });

      if (nextPrimary) {
        await prisma.assetPhoto.update({
          where: { id: nextPrimary.id },
          data: { isPrimary: true },
        });
      }
    }

    // Record audit trail
    await prisma.assetHistory.create({
      data: {
        assetId: params.id,
        action: "PHOTO_DELETED",
        performedBy: session.name,
        notes: `Deleted photo: ${photo.category} (${photo.originalFilename})`,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Photo ${photo.originalFilename} successfully deleted.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to delete photo", details: error.message },
      { status: 500 }
    );
  }
}
