import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { PhotoCategory, AssetPhotoDTO } from "@/types";

export interface OptimizedImageResult {
  fullBlob: Blob;
  thumbBlob: Blob;
  width: number;
  height: number;
  fullSize: number;
}

/**
 * Optimizes an image client-side via HTML5 Canvas:
 * - Scales image down to max dimensions (1920x1080 for main, 300x300 for thumb)
 * - Converts to WebP format
 * - Strips all EXIF, geolocation, camera device markers
 */
export async function optimizeImageClientSide(
  file: File,
  maxMainDim = 1920,
  maxThumbDim = 300
): Promise<OptimizedImageResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Invalid image format"));
      img.onload = () => {
        // Calculate main dimensions
        let width = img.width;
        let height = img.height;

        if (width > maxMainDim || height > maxMainDim) {
          if (width > height) {
            height = Math.round((height * maxMainDim) / width);
            width = maxMainDim;
          } else {
            width = Math.round((width * maxMainDim) / height);
            height = maxMainDim;
          }
        }

        // Render main canvas
        const mainCanvas = document.createElement("canvas");
        mainCanvas.width = width;
        mainCanvas.height = height;
        const mainCtx = mainCanvas.getContext("2d");
        if (!mainCtx) return reject(new Error("Could not initialize 2D canvas"));
        mainCtx.drawImage(img, 0, 0, width, height);

        // Render thumbnail canvas
        let thumbW = img.width;
        let thumbH = img.height;
        if (thumbW > maxThumbDim || thumbH > maxThumbDim) {
          if (thumbW > thumbH) {
            thumbH = Math.round((thumbH * maxThumbDim) / thumbW);
            thumbW = maxThumbDim;
          } else {
            thumbW = Math.round((thumbW * maxThumbDim) / thumbH);
            thumbH = maxThumbDim;
          }
        }

        const thumbCanvas = document.createElement("canvas");
        thumbCanvas.width = thumbW;
        thumbCanvas.height = thumbH;
        const thumbCtx = thumbCanvas.getContext("2d");
        if (!thumbCtx) return reject(new Error("Could not initialize thumb canvas"));
        thumbCtx.drawImage(img, 0, 0, thumbW, thumbH);

        // Convert to WebP blobs
        mainCanvas.toBlob(
          (fullBlob) => {
            if (!fullBlob) return reject(new Error("Failed to generate main WebP"));
            thumbCanvas.toBlob(
              (thumbBlob) => {
                if (!thumbBlob) return reject(new Error("Failed to generate thumb WebP"));
                resolve({
                  fullBlob,
                  thumbBlob,
                  width,
                  height,
                  fullSize: fullBlob.size,
                });
              },
              "image/webp",
              0.70
            );
          },
          "image/webp",
          0.82
        );
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Upload an asset photo with client-side WebP optimization
 */
export async function uploadAssetPhoto(
  assetId: string,
  file: File,
  category: PhotoCategory,
  description?: string,
  isPrimary?: boolean
): Promise<{ photo: AssetPhotoDTO | null; error: string | null }> {
  if (isSupabaseConfigured()) {
    try {
      const optimized = await optimizeImageClientSide(file);
      const photoId = `pht_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const fileKey = `assets/${assetId}/${photoId}.webp`;
      const thumbKey = `assets/${assetId}/${photoId}_thumb.webp`;

      // Upload main photo
      const { error: uploadMainErr } = await supabase.storage
        .from("asset-photos")
        .upload(fileKey, optimized.fullBlob, {
          contentType: "image/webp",
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadMainErr) {
        return { photo: null, error: uploadMainErr.message };
      }

      // Upload thumbnail
      const { error: uploadThumbErr } = await supabase.storage
        .from("asset-photos")
        .upload(thumbKey, optimized.thumbBlob, {
          contentType: "image/webp",
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadThumbErr) {
        console.warn("Thumbnail upload warning:", uploadThumbErr.message);
      }

      // If isPrimary is true, unset other photos for this asset
      if (isPrimary) {
        await supabase
          .from("asset_photos")
          .update({ is_primary: false })
          .eq("asset_id", assetId);
      }

      // Get current user identifier
      const { data: { session } } = await supabase.auth.getSession();
      const uploadedBy = session?.user?.email || "IT Admin";

      // Insert metadata into asset_photos
      const { data: photoRow, error: dbErr } = await supabase
        .from("asset_photos")
        .insert({
          id: photoId,
          asset_id: assetId,
          category,
          file_key: fileKey,
          thumbnail_key: thumbKey,
          original_filename: file.name,
          mime_type: "image/webp",
          file_size: optimized.fullSize,
          width: optimized.width,
          height: optimized.height,
          description: description?.trim() || null,
          is_primary: !!isPrimary,
          uploaded_by: uploadedBy,
        })
        .select()
        .single();

      if (dbErr || !photoRow) {
        return { photo: null, error: dbErr?.message || "Failed to save photo record" };
      }

      // Append audit log
      await supabase.from("asset_histories").insert({
        id: `hst_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        asset_id: assetId,
        action: "PHOTO_UPLOAD",
        notes: `Photo added (${category}): ${file.name}`,
      });

      const photoDTO: AssetPhotoDTO = {
        id: photoRow.id,
        assetId: photoRow.asset_id,
        category: photoRow.category,
        fileKey: photoRow.file_key,
        thumbnailKey: photoRow.thumbnail_key,
        originalFilename: photoRow.original_filename,
        mimeType: photoRow.mime_type,
        fileSize: photoRow.file_size,
        width: photoRow.width,
        height: photoRow.height,
        description: photoRow.description,
        isPrimary: photoRow.is_primary,
        uploadedBy: photoRow.uploaded_by,
        createdAt: photoRow.created_at,
        updatedAt: photoRow.updated_at,
        url: supabase.storage.from("asset-photos").getPublicUrl(fileKey).data.publicUrl,
        thumbnailUrl: supabase.storage.from("asset-photos").getPublicUrl(thumbKey).data.publicUrl,
      };

      return { photo: photoDTO, error: null };
    } catch (err: any) {
      return { photo: null, error: err.message || "Failed to process photo" };
    }
  }

  // Fallback to local API route
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);
    if (description) formData.append("description", description);
    if (isPrimary) formData.append("isPrimary", "true");

    const res = await fetch(`/api/assets/${assetId}/photos`, {
      method: "POST",
      body: formData,
    });

    const json = await res.json();
    if (res.ok) {
      return { photo: json.photo, error: null };
    }
    return { photo: null, error: json.error || "Failed to upload photo" };
  } catch (err: any) {
    return { photo: null, error: err.message };
  }
}

/**
 * Delete a photo from storage and database
 */
export async function deleteAssetPhoto(
  assetId: string,
  photoId: string,
  fileKey?: string,
  thumbKey?: string
): Promise<{ success: boolean; error: string | null }> {
  if (isSupabaseConfigured()) {
    try {
      if (fileKey) {
        await supabase.storage.from("asset-photos").remove([fileKey]);
      }
      if (thumbKey) {
        await supabase.storage.from("asset-photos").remove([thumbKey]);
      }

      const { error } = await supabase.from("asset_photos").delete().eq("id", photoId);
      if (error) {
        return { success: false, error: error.message };
      }

      await supabase.from("asset_histories").insert({
        id: `hst_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        asset_id: assetId,
        action: "PHOTO_DELETE",
        notes: `Photo removed from asset records`,
      });

      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // Fallback
  try {
    const res = await fetch(`/api/assets/${assetId}/photos/${photoId}`, {
      method: "DELETE",
    });
    const json = await res.json();
    if (res.ok) {
      return { success: true, error: null };
    }
    return { success: false, error: json.error || "Failed to delete photo" };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Set a photo as the primary asset photo
 */
export async function setPrimaryPhoto(
  assetId: string,
  photoId: string
): Promise<{ success: boolean; error: string | null }> {
  if (isSupabaseConfigured()) {
    try {
      // Unset previous primary
      await supabase.from("asset_photos").update({ is_primary: false }).eq("asset_id", assetId);
      // Set new primary
      const { error } = await supabase.from("asset_photos").update({ is_primary: true }).eq("id", photoId);
      if (error) return { success: false, error: error.message };
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // Fallback
  try {
    const res = await fetch(`/api/assets/${assetId}/photos/${photoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPrimary: true }),
    });
    const json = await res.json();
    if (res.ok) return { success: true, error: null };
    return { success: false, error: json.error || "Failed to set primary photo" };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

