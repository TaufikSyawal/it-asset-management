import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import { storageProvider, processAndOptimizeImage, validateImageMagicBytes } from "@/lib/storage";
import { PhotoCategory } from "@/types";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
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
      return NextResponse.json({ error: "Access denied to this asset" }, { status: 403 });
    }

    const photos = await prisma.assetPhoto.findMany({
      where: { assetId: params.id },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
    });

    const formattedPhotos = photos.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      url: `/api/assets/${params.id}/photos/${p.id}`,
      thumbnailUrl: `/api/assets/${params.id}/photos/${p.id}?thumb=true`,
    }));

    return NextResponse.json({ photos: formattedPhotos });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to retrieve asset photos", details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    const permissions = ROLE_PERMISSIONS[session.role];

    if (!permissions.canManagePhotos) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to upload photos." },
        { status: 403 }
      );
    }

    const asset = await prisma.asset.findUnique({
      where: { id: params.id },
      include: {
        photos: {
          select: { id: true, isPrimary: true },
        },
      },
    });

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    const formData = await request.formData();
    
    // Support either multiple files ('files') or single file ('file')
    const files: File[] = [];
    const filesEntries = formData.getAll("files");
    const singleFile = formData.get("file");

    if (filesEntries.length > 0) {
      for (const entry of filesEntries) {
        if (entry instanceof File && entry.size > 0) {
          files.push(entry);
        }
      }
    } else if (singleFile instanceof File && singleFile.size > 0) {
      files.push(singleFile);
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No image file provided in upload." },
        { status: 400 }
      );
    }

    const requestedCategory = (formData.get("category") as PhotoCategory) || "MAIN_PHOTO";
    const description = (formData.get("description") as string)?.trim() || null;
    const isPrimaryParam = formData.get("isPrimary");
    const requestedPrimary = isPrimaryParam === "true" || isPrimaryParam === "1";
    const assignmentId = (formData.get("assignmentId") as string) || null;

    // Validate category enum
    const validCategories: PhotoCategory[] = [
      "MAIN_PHOTO",
      "FRONT_VIEW",
      "BACK_BOTTOM_VIEW",
      "SERIAL_NUMBER",
      "DAMAGE_CONDITION",
      "HANDOVER",
      "RETURN",
      "OTHER",
    ];
    const category: PhotoCategory = validCategories.includes(requestedCategory)
      ? requestedCategory
      : "MAIN_PHOTO";

    const createdPhotos = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // File size validation (15MB limit)
      if (file.size > 15 * 1024 * 1024) {
        return NextResponse.json(
          { error: `File ${file.name} exceeds the 15MB maximum size limit.` },
          { status: 400 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const rawBuffer = Buffer.from(arrayBuffer);

      // Validate magic bytes signature
      const magicCheck = validateImageMagicBytes(rawBuffer);
      if (!magicCheck.valid) {
        return NextResponse.json(
          {
            error: `File ${file.name} is not a valid image format. Only JPEG, PNG, and WebP are allowed.`,
          },
          { status: 400 }
        );
      }

      // Process and optimize image with sharp (strip EXIF/GPS, resize, create thumbnail)
      const processed = await processAndOptimizeImage(rawBuffer, asset.id);

      // Persist to private application storage
      await storageProvider.save(processed.fileKey, processed.mainBuffer, processed.mimeType);
      await storageProvider.save(processed.thumbnailKey, processed.thumbBuffer, processed.mimeType);

      // Determine isPrimary:
      // If user explicitly flagged as primary (or if asset currently has 0 photos and this is first file)
      const shouldBePrimary = (requestedPrimary && i === 0) || (asset.photos.length === 0 && i === 0);

      if (shouldBePrimary) {
        await prisma.assetPhoto.updateMany({
          where: { assetId: asset.id },
          data: { isPrimary: false },
        });
      }

      const photoRecord = await prisma.assetPhoto.create({
        data: {
          assetId: asset.id,
          category,
          fileKey: processed.fileKey,
          thumbnailKey: processed.thumbnailKey,
          originalFilename: file.name,
          mimeType: processed.mimeType,
          fileSize: processed.fileSize,
          width: processed.width,
          height: processed.height,
          description,
          isPrimary: shouldBePrimary,
          assignmentId: assignmentId || undefined,
          uploadedBy: session.name,
        },
      });

      // Audit trail
      await prisma.assetHistory.create({
        data: {
          assetId: asset.id,
          action: "PHOTO_UPLOADED",
          performedBy: session.name,
          notes: `Uploaded photo: ${category} (${file.name}, ${(processed.fileSize / 1024).toFixed(1)} KB)${
            shouldBePrimary ? " [Set as Primary Photo]" : ""
          }`,
        },
      });

      createdPhotos.push({
        ...photoRecord,
        createdAt: photoRecord.createdAt.toISOString(),
        updatedAt: photoRecord.updatedAt.toISOString(),
        url: `/api/assets/${asset.id}/photos/${photoRecord.id}`,
        thumbnailUrl: `/api/assets/${asset.id}/photos/${photoRecord.id}?thumb=true`,
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: `Successfully uploaded ${createdPhotos.length} photo(s).`,
        photos: createdPhotos,
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to upload photo", details: error.message },
      { status: 500 }
    );
  }
}

