"use client";

import React, { useState } from "react";
import { AssetDTO, AssetPhotoDTO, PhotoCategory, UserRole } from "@/types";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import {
  Camera,
  Upload,
  Star,
  Trash2,
  Download,
  Eye,
  AlertTriangle,
  CheckCircle2,
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Calendar,
  User,
  HardDrive,
  ExternalLink,
} from "lucide-react";
import AssetPhotoUploadModal from "./AssetPhotoUploadModal";
import AssetPhotoLightboxModal from "./AssetPhotoLightboxModal";

interface AssetPhotoGalleryProps {
  asset: AssetDTO;
  currentRole: UserRole;
  onPhotoUpdated?: () => void;
}

export const CATEGORY_LABELS: Record<PhotoCategory, string> = {
  MAIN_PHOTO: "Main Photo",
  FRONT_VIEW: "Front View",
  BACK_BOTTOM_VIEW: "Back / Bottom View",
  SERIAL_NUMBER: "Serial Number Photo",
  DAMAGE_CONDITION: "Damage / Condition",
  HANDOVER: "Handover Photo",
  RETURN: "Return Photo",
  OTHER: "Other Documentation",
};

export const CATEGORY_COLORS: Record<PhotoCategory, { bg: string; text: string; border: string }> = {
  MAIN_PHOTO: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  FRONT_VIEW: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
  BACK_BOTTOM_VIEW: { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200" },
  SERIAL_NUMBER: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  DAMAGE_CONDITION: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  HANDOVER: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  RETURN: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  OTHER: { bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200" },
};

export default function AssetPhotoGallery({
  asset,
  currentRole,
  onPhotoUpdated,
}: AssetPhotoGalleryProps) {
  const permissions = ROLE_PERMISSIONS[currentRole];
  const [selectedCategory, setSelectedCategory] = useState<"ALL" | PhotoCategory>("ALL");
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<AssetPhotoDTO | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settingPrimaryId, setSettingPrimaryId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const photos = asset.photos || [];

  const filteredPhotos =
    selectedCategory === "ALL"
      ? photos
      : photos.filter((p) => p.category === selectedCategory);

  const handleSetPrimary = async (photo: AssetPhotoDTO) => {
    if (!permissions.canManagePhotos || photo.isPrimary) return;
    setSettingPrimaryId(photo.id);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/assets/${asset.id}/photos/${photo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPrimary: true }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to set as primary photo");
      }

      if (lightboxPhoto && lightboxPhoto.id === photo.id) {
        setLightboxPhoto({ ...lightboxPhoto, isPrimary: true });
      }

      onPhotoUpdated?.();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to update primary status");
    } finally {
      setSettingPrimaryId(null);
    }
  };

  const handleDeletePhoto = async (photo: AssetPhotoDTO) => {
    if (!permissions.canManagePhotos) return;
    if (!confirm(`Are you sure you want to permanently delete "${photo.originalFilename}"?`)) {
      return;
    }

    setDeletingId(photo.id);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/assets/${asset.id}/photos/${photo.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete photo");
      }

      if (lightboxPhoto?.id === photo.id) {
        setLightboxPhoto(null);
      }

      onPhotoUpdated?.();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to delete photo");
    } finally {
      setDeletingId(null);
    }
  };

  // Lightbox navigation
  const currentIndex = lightboxPhoto
    ? filteredPhotos.findIndex((p) => p.id === lightboxPhoto.id)
    : -1;

  const handlePrevPhoto = () => {
    if (currentIndex > 0) {
      setLightboxPhoto(filteredPhotos[currentIndex - 1]);
    } else if (filteredPhotos.length > 0) {
      setLightboxPhoto(filteredPhotos[filteredPhotos.length - 1]);
    }
  };

  const handleNextPhoto = () => {
    if (currentIndex < filteredPhotos.length - 1) {
      setLightboxPhoto(filteredPhotos[currentIndex + 1]);
    } else if (filteredPhotos.length > 0) {
      setLightboxPhoto(filteredPhotos[0]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Bar: Action Buttons & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full text-xs">
          <button
            onClick={() => setSelectedCategory("ALL")}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all shrink-0 ${
              selectedCategory === "ALL"
                ? "bg-brand-600 text-white shadow-2xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All ({photos.length})
          </button>
          {Object.entries(CATEGORY_LABELS).map(([catKey, label]) => {
            const count = photos.filter((p) => p.category === catKey).length;
            if (count === 0 && selectedCategory !== catKey) return null;
            return (
              <button
                key={catKey}
                onClick={() => setSelectedCategory(catKey as PhotoCategory)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all shrink-0 ${
                  selectedCategory === catKey
                    ? "bg-brand-600 text-white shadow-2xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {label} ({count})
              </button>
            );
          })}
        </div>

        {/* Upload Button */}
        {permissions.canManagePhotos && (
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all shrink-0"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Upload Photos</span>
          </button>
        )}
      </div>

      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Gallery Grid */}
      {filteredPhotos.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center bg-slate-50/50">
          <Camera className="w-10 h-10 mx-auto text-slate-300 stroke-1 mb-2" />
          <h4 className="text-xs font-bold text-slate-700">No photos documented yet</h4>
          <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
            {selectedCategory === "ALL"
              ? "Upload photos of the device, serial number tag, condition, or handover documentation."
              : `No photos categorized under "${CATEGORY_LABELS[selectedCategory]}".`}
          </p>
          {permissions.canManagePhotos && (
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-xs"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Add First Photo</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {filteredPhotos.map((photo) => {
            const style = CATEGORY_COLORS[photo.category] || CATEGORY_COLORS.MAIN_PHOTO;
            return (
              <div
                key={photo.id}
                className="group relative bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs hover:shadow-md transition-all flex flex-col"
              >
                {/* Thumbnail Container */}
                <div
                  className="relative aspect-4/3 w-full bg-slate-100 cursor-pointer overflow-hidden"
                  onClick={() => setLightboxPhoto(photo)}
                >
                  <img
                    src={photo.thumbnailUrl}
                    alt={photo.description || photo.originalFilename}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />

                  {/* Primary Badge */}
                  {photo.isPrimary && (
                    <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-500 text-white shadow-xs flex items-center gap-1">
                      <Star className="w-2.5 h-2.5 fill-white" />
                      Primary
                    </span>
                  )}

                  {/* Hover Overlay with Quick Buttons */}
                  <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLightboxPhoto(photo);
                      }}
                      title="Enlarge preview"
                      className="p-1.5 bg-white/90 hover:bg-white text-slate-800 rounded-lg shadow-xs transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <a
                      href={`${photo.url}?download=true`}
                      onClick={(e) => e.stopPropagation()}
                      title="Download photo"
                      className="p-1.5 bg-white/90 hover:bg-white text-slate-800 rounded-lg shadow-xs transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                    {permissions.canManagePhotos && !photo.isPrimary && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSetPrimary(photo);
                        }}
                        disabled={settingPrimaryId === photo.id}
                        title="Set as primary asset photo"
                        className="p-1.5 bg-white/90 hover:bg-white text-amber-600 rounded-lg shadow-xs transition-colors disabled:opacity-50"
                      >
                        <Star className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {permissions.canManagePhotos && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePhoto(photo);
                        }}
                        disabled={deletingId === photo.id}
                        title="Delete photo"
                        className="p-1.5 bg-white/90 hover:bg-white text-rose-600 rounded-lg shadow-xs transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Card Info */}
                <div className="p-2.5 flex-1 flex flex-col justify-between text-[11px] bg-white">
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${style.bg} ${style.text} ${style.border}`}
                      >
                        {CATEGORY_LABELS[photo.category]}
                      </span>
                      <span className="text-slate-400 font-mono text-[10px]">
                        {(photo.fileSize / 1024).toFixed(0)} KB
                      </span>
                    </div>

                    {photo.description && (
                      <p className="text-slate-700 font-medium line-clamp-2 mt-1 leading-snug">
                        {photo.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-slate-400 text-[10px]">
                    <span className="truncate" title={`Uploaded by ${photo.uploadedBy || "IT Admin"}`}>
                      {photo.uploadedBy || "IT Admin"}
                    </span>
                    <span>
                      {new Date(photo.createdAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxPhoto && (
        <AssetPhotoLightboxModal
          photo={lightboxPhoto}
          allPhotos={filteredPhotos}
          onClose={() => setLightboxPhoto(null)}
          assetId={asset.id}
          currentRole={currentRole}
          onPhotoUpdated={onPhotoUpdated}
        />
      )}

      {/* Upload Modal */}
      {isUploadModalOpen && (
        <AssetPhotoUploadModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          assetId={asset.id}
          assetTag={asset.assetTag}
          assetName={asset.assetName}
          onSuccess={() => {
            setIsUploadModalOpen(false);
            onPhotoUpdated?.();
          }}
        />
      )}
    </div>
  );
}

