"use client";

import React, { useState, useRef } from "react";
import { PhotoCategory } from "@/types";
import {
  X,
  Upload,
  Camera,
  Image as ImageIcon,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Star,
  Info,
} from "lucide-react";
import { CATEGORY_LABELS } from "./AssetPhotoGallery";

interface AssetPhotoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  assetId: string;
  assetTag: string;
  assetName: string;
  onSuccess: () => void;
}

interface QueuedFile {
  id: string;
  file: File;
  previewUrl: string;
}

export default function AssetPhotoUploadModal({
  isOpen,
  onClose,
  assetId,
  assetTag,
  assetName,
  onSuccess,
}: AssetPhotoUploadModalProps) {
  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([]);
  const [category, setCategory] = useState<PhotoCategory>("MAIN_PHOTO");
  const [description, setDescription] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);

    const newQueued: QueuedFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate client-side extension / mime
      const validTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!validTypes.includes(file.type) && !file.name.match(/\.(jpe?g|png|webp)$/i)) {
        setError(`"${file.name}" is not a supported image. Only JPEG, PNG, and WebP are allowed.`);
        continue;
      }

      if (file.size > 15 * 1024 * 1024) {
        setError(`"${file.name}" exceeds the 15MB file size limit.`);
        continue;
      }

      newQueued.push({
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }

    setQueuedFiles((prev) => [...prev, ...newQueued]);
  };

  const handleRemoveQueued = (id: string) => {
    setQueuedFiles((prev) => {
      const item = prev.find((f) => f.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((f) => f.id !== id);
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFilesSelected(e.dataTransfer.files);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (queuedFiles.length === 0) {
      setError("Please select at least one photo to upload.");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      for (const item of queuedFiles) {
        formData.append("files", item.file);
      }
      formData.append("category", category);
      if (description.trim()) {
        formData.append("description", description.trim());
      }
      if (isPrimary) {
        formData.append("isPrimary", "true");
      }

      const res = await fetch(`/api/assets/${assetId}/photos`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to upload photo(s)");
      }

      // Cleanup object URLs
      queuedFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl));

      onSuccess();
    } catch (err: any) {
      setError(err.message || "An error occurred during upload.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-70 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-brand-100 text-brand-700 rounded-lg">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">Upload Asset Photos</h3>
              <p className="text-xs text-slate-500">
                {assetTag} • {assetName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={uploading}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Hidden File Inputs */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => handleFilesSelected(e.target.files)}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFilesSelected(e.target.files)}
          />

          {/* Drag & Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-5 text-center transition-all ${
              isDragging
                ? "border-brand-500 bg-brand-50/50"
                : "border-slate-300 bg-slate-50/50 hover:bg-slate-50"
            }`}
          >
            <div className="flex justify-center gap-3 mb-2">
              <div className="p-2.5 rounded-full bg-brand-100 text-brand-600">
                <Upload className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs font-semibold text-slate-800">
              Drag and drop images here, or browse from storage
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Supports JPEG, PNG, and WebP (up to 15MB each)
            </p>

            <div className="flex items-center justify-center gap-2 mt-3.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-lg shadow-2xs transition-colors flex items-center gap-1.5"
              >
                <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                Browse Files
              </button>
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold rounded-lg shadow-2xs transition-colors flex items-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5 text-emerald-600" />
                Take Photo
              </button>
            </div>
          </div>

          {/* Queued Photos Preview List */}
          {queuedFiles.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-700 block">
                Selected Photos ({queuedFiles.length})
              </span>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-36 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-200">
                {queuedFiles.map((item) => (
                  <div
                    key={item.id}
                    className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200 bg-white"
                  >
                    <img
                      src={item.previewUrl}
                      alt="preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveQueued(item.id)}
                      className="absolute top-1 right-1 p-1 bg-slate-900/70 hover:bg-rose-600 text-white rounded-full transition-colors"
                      title="Remove"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <span className="absolute bottom-0 inset-x-0 bg-slate-950/70 text-white text-[9px] px-1 py-0.5 truncate text-center">
                      {(item.file.size / 1024).toFixed(0)} KB
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Category Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Photo Category *
            </label>
            <select
              value={category}
              onChange={(e) => {
                const newCat = e.target.value as PhotoCategory;
                setCategory(newCat);
                if (newCat === "MAIN_PHOTO") setIsPrimary(true);
              }}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
            >
              {Object.entries(CATEGORY_LABELS).map(([catKey, label]) => (
                <option key={catKey} value={catKey}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description / Notes (Optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Serial number label clearly readable; scratch on top casing"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
            />
          </div>

          {/* Primary Photo Toggle */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="setPrimaryPhoto"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              className="w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-500"
            />
            <label
              htmlFor="setPrimaryPhoto"
              className="text-xs font-semibold text-slate-700 cursor-pointer flex items-center gap-1.5"
            >
              <Star className="w-3.5 h-3.5 text-amber-500" />
              Set as primary photo for this asset
            </label>
          </div>

          <div className="p-2.5 bg-blue-50/70 border border-blue-100 rounded-lg flex items-start gap-2 text-[11px] text-blue-700">
            <Info className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
            <span>
              EXIF and GPS metadata will be automatically stripped before secure storage in compliance with data privacy policies.
            </span>
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || queuedFiles.length === 0}
              className="px-4 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm shadow-brand-200 flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" />
              {uploading
                ? `Optimizing & Uploading (${queuedFiles.length})...`
                : `Upload ${queuedFiles.length > 0 ? `(${queuedFiles.length})` : ""}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

