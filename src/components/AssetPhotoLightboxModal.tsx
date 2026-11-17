"use client";

import React, { useState, useEffect } from "react";
import { AssetPhotoDTO, UserRole } from "@/types";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Star,
  Trash2,
} from "lucide-react";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "./AssetPhotoGallery";

interface AssetPhotoLightboxModalProps {
  photo: AssetPhotoDTO | null;
  allPhotos?: AssetPhotoDTO[];
  onClose: () => void;
  assetId: string;
  currentRole: UserRole;
  onPhotoUpdated?: () => void;
}

export default function AssetPhotoLightboxModal({
  photo,
  allPhotos = [],
  onClose,
  assetId,
  currentRole,
  onPhotoUpdated,
}: AssetPhotoLightboxModalProps) {
  const permissions = ROLE_PERMISSIONS[currentRole];
  const [activePhoto, setActivePhoto] = useState<AssetPhotoDTO | null>(photo);
  const [deleting, setDeleting] = useState(false);
  const [settingPrimary, setSettingPrimary] = useState(false);

  useEffect(() => {
    setActivePhoto(photo);
  }, [photo]);

  if (!activePhoto) return null;

  const photosList = allPhotos.length > 0 ? allPhotos : [activePhoto];
  const currentIndex = photosList.findIndex((p) => p.id === activePhoto.id);

  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (currentIndex > 0) {
      setActivePhoto(photosList[currentIndex - 1]);
    } else if (photosList.length > 0) {
      setActivePhoto(photosList[photosList.length - 1]);
    }
  };

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (currentIndex < photosList.length - 1) {
      setActivePhoto(photosList[currentIndex + 1]);
    } else if (photosList.length > 0) {
      setActivePhoto(photosList[0]);
    }
  };

  const handleSetPrimary = async () => {
    if (!permissions.canManagePhotos || activePhoto.isPrimary) return;
    setSettingPrimary(true);

    try {
      const res = await fetch(`/api/assets/${assetId}/photos/${activePhoto.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPrimary: true }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to set as primary photo");
      }

      setActivePhoto({ ...activePhoto, isPrimary: true });
      onPhotoUpdated?.();
    } catch (err: any) {
      alert(err.message || "Failed to update primary status");
    } finally {
      setSettingPrimary(false);
    }
  };

  const handleDelete = async () => {
    if (!permissions.canManagePhotos) return;
    if (!confirm(`Are you sure you want to permanently delete "${activePhoto.originalFilename}"?`)) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/assets/${assetId}/photos/${activePhoto.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete photo");
      }

      onPhotoUpdated?.();
      onClose();
    } catch (err: any) {
      alert(err.message || "Failed to delete photo");
    } finally {
      setDeleting(false);
    }
  };

  const style = CATEGORY_COLORS[activePhoto.category] || CATEGORY_COLORS.MAIN_PHOTO;

  return (
    <div
      className="fixed inset-0 z-70 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Lightbox Header */}
        <div className="px-5 py-3.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded text-xs font-bold border ${style.bg} ${style.text} ${style.border}`}
            >
              {CATEGORY_LABELS[activePhoto.category] || activePhoto.category}
            </span>
            {activePhoto.isPrimary && (
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                <Star className="w-3 h-3 fill-amber-400" />
                Primary Photo
              </span>
            )}
            <span className="text-xs text-slate-400 font-mono hidden sm:inline">
              {activePhoto.originalFilename}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`${activePhoto.url}?download=true`}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </a>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Lightbox Main Image Preview with Nav Arrows */}
        <div className="relative flex-1 bg-slate-950 flex items-center justify-center p-4 min-h-[300px] overflow-hidden">
          <img
            src={activePhoto.url}
            alt={activePhoto.description || activePhoto.originalFilename}
            className="max-h-[60vh] max-w-full object-contain rounded-lg shadow-lg"
          />

          {photosList.length > 1 && (
            <>
              <button
                onClick={handlePrev}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-white shadow-lg transition-all"
                title="Previous photo"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={handleNext}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-white shadow-lg transition-all"
                title="Next photo"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
        </div>

        {/* Lightbox Footer Details */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 text-slate-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            {activePhoto.description ? (
              <p className="text-sm font-semibold text-white mb-1">
                {activePhoto.description}
              </p>
            ) : (
              <p className="text-xs text-slate-500 italic mb-1">No description recorded</p>
            )}
            <div className="flex flex-wrap items-center gap-3 text-slate-400 text-[11px]">
              <span>
                Uploaded by: <b className="text-slate-300">{activePhoto.uploadedBy || "IT Admin"}</b>
              </span>
              <span>•</span>
              <span>
                Date:{" "}
                <b className="text-slate-300">
                  {new Date(activePhoto.createdAt).toLocaleString("id-ID", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </b>
              </span>
              <span>•</span>
              <span>
                Resolution:{" "}
                <b className="text-slate-300">
                  {activePhoto.width} × {activePhoto.height} px
                </b>
              </span>
              <span>•</span>
              <span>
                Size:{" "}
                <b className="text-slate-300">
                  {(activePhoto.fileSize / 1024).toFixed(1)} KB
                </b>
              </span>
            </div>
          </div>

          {permissions.canManagePhotos && (
            <div className="flex items-center gap-2 shrink-0">
              {!activePhoto.isPrimary && (
                <button
                  onClick={handleSetPrimary}
                  disabled={settingPrimary}
                  className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-lg font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <Star className="w-3.5 h-3.5 fill-amber-300" />
                  Set as Primary
                </button>
              )}
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-lg font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

