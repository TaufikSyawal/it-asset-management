"use client";

import React, { useState } from "react";
import { AssetDTO, EmployeeDTO, AssignmentAction, PhysicalCondition } from "@/types";
import {
  X,
  UserCheck,
  ArrowRightLeft,
  CornerDownLeft,
  RefreshCw,
  AlertCircle,
  Camera,
  Upload,
  Image as ImageIcon,
} from "lucide-react";

interface AssetAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: AssetDTO | null;
  allAssets?: AssetDTO[];
  initialActionType?: AssignmentAction;
  initialEmployeeId?: string;
  employees: EmployeeDTO[];
  onSuccess: () => void;
}

export default function AssetAssignModal({
  isOpen,
  onClose,
  asset,
  allAssets = [],
  initialActionType = "ASSIGN",
  initialEmployeeId,
  employees,
  onSuccess,
}: AssetAssignModalProps) {
  const [selectedAssetId, setSelectedAssetId] = useState<string>("");
  const [actionType, setActionType] = useState<AssignmentAction>(initialActionType);
  const [employeeId, setEmployeeId] = useState("");
  const [conditionAtAction, setConditionAtAction] = useState<PhysicalCondition>("GOOD");
  const [handoverDocRef, setHandoverDocRef] = useState("");
  const [notes, setNotes] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);

  // Sync initial action type or asset
  React.useEffect(() => {
    if (isOpen) {
      if (initialActionType) setActionType(initialActionType);
      if (asset) setSelectedAssetId(asset.id);
      else if (allAssets.length > 0) setSelectedAssetId(allAssets[0].id);
      if (initialEmployeeId) setEmployeeId(initialEmployeeId);
      setPhotoFile(null);
      setPhotoPreview(null);
      setError(null);
    }
  }, [isOpen, initialActionType, asset, allAssets, initialEmployeeId]);

  if (!isOpen) return null;

  const activeAsset = asset || allAssets.find((a) => a.id === selectedAssetId) || allAssets[0] || null;

  const handlePhotoSelect = (file: File | null) => {
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleRemovePhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAsset) {
      setError("Please select an asset to perform this action.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/assets/${activeAsset.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType,
          employeeId: actionType === "RETURN" ? undefined : employeeId,
          conditionAtAction,
          handoverDocRef: handoverDocRef.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Assignment operation failed");
      }

      // If condition photo was attached, upload it and link to this assignment
      if (photoFile) {
        const photoFormData = new FormData();
        photoFormData.append("file", photoFile);
        photoFormData.append(
          "category",
          actionType === "RETURN" ? "RETURN" : "HANDOVER"
        );
        photoFormData.append(
          "description",
          `Condition documented during ${actionType} (${conditionAtAction})${
            handoverDocRef ? ` Ref: ${handoverDocRef}` : ""
          }`
        );
        if (data.assignmentId) {
          photoFormData.append("assignmentId", data.assignmentId);
        }

        await fetch(`/api/assets/${activeAsset.id}/photos`, {
          method: "POST",
          body: photoFormData,
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-700">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">
                Asset Handover & Lifecycle Tracking
              </h3>
              <p className="text-xs text-slate-500">
                {activeAsset ? `Target: ${activeAsset.assetTag} (${activeAsset.assetName})` : "Select an asset to proceed"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Target Asset Selector if opened globally without an active asset */}
        {!asset && allAssets.length > 0 && (
          <div className="px-6 py-3 bg-slate-100/70 border-b border-slate-200">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Target Asset *
            </label>
            <select
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value)}
              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
            >
              {allAssets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.assetTag} • {a.assetName} ({a.company?.code} • {a.assignedEmployee ? `In Use: ${a.assignedEmployee.name}` : "Storage Pool"})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Current State Info */}
        {activeAsset && (
          <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 text-xs flex items-center justify-between">
            <div>
              <span className="text-slate-500">Current Assignee:</span>{" "}
              <span className="font-semibold text-slate-900">
                {activeAsset.assignedEmployee ? activeAsset.assignedEmployee.name : "Unassigned (Storage Pool)"}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Entity:</span>{" "}
              <span className="font-bold text-slate-800">{activeAsset.company?.code}</span>
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Lifecycle Action Type *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setActionType("ASSIGN")}
                className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center gap-2 transition-all ${
                  actionType === "ASSIGN"
                    ? "bg-brand-50 border-brand-500 text-brand-700 shadow-2xs"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <UserCheck className="w-4 h-4 text-brand-600" />
                <span>Assign to Employee</span>
              </button>

              <button
                type="button"
                onClick={() => setActionType("TRANSFER")}
                className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center gap-2 transition-all ${
                  actionType === "TRANSFER"
                    ? "bg-blue-50 border-blue-500 text-blue-700 shadow-2xs"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <ArrowRightLeft className="w-4 h-4 text-blue-600" />
                <span>Transfer User</span>
              </button>

              <button
                type="button"
                onClick={() => setActionType("RETURN")}
                className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center gap-2 transition-all ${
                  actionType === "RETURN"
                    ? "bg-amber-50 border-amber-500 text-amber-700 shadow-2xs"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <CornerDownLeft className="w-4 h-4 text-amber-600" />
                <span>Return to Storage</span>
              </button>

              <button
                type="button"
                onClick={() => setActionType("REPLACEMENT")}
                className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center gap-2 transition-all ${
                  actionType === "REPLACEMENT"
                    ? "bg-rose-50 border-rose-500 text-rose-700 shadow-2xs"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <RefreshCw className="w-4 h-4 text-rose-600" />
                <span>Mark for Replacement</span>
              </button>
            </div>
          </div>

          {/* Target Employee Dropdown (Disabled if returning or replacing) */}
          {(actionType === "ASSIGN" || actionType === "TRANSFER") && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Target Employee *
              </label>
              <select
                required
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
              >
                <option value="">— Choose an Employee —</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.employeeId} • {emp.company?.code} • {emp.department || "General"})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Condition at Handover */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Physical Condition at Handover *
            </label>
            <select
              value={conditionAtAction}
              onChange={(e) => setConditionAtAction(e.target.value as PhysicalCondition)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
            >
              <option value="EXCELLENT">Excellent (Like New)</option>
              <option value="GOOD">Good (Normal Condition)</option>
              <option value="FAIR">Fair (Minor Scuffs / Wear)</option>
              <option value="POOR">Poor (Hardware Degradation)</option>
              <option value="DAMAGED">Damaged / Non-operational</option>
            </select>
          </div>

          {/* Reference Document */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Handover Document Ref / BAST Number
            </label>
            <input
              type="text"
              value={handoverDocRef}
              onChange={(e) => setHandoverDocRef(e.target.value)}
              placeholder="e.g. BAST/IT/2024/104"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Handover Notes / Reason
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Project assignment change; laptop tested and clean."
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
            />
          </div>

          {/* Handover Condition Photo (Optional) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Handover / Condition Evidence Photo (Optional)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => handlePhotoSelect(e.target.files?.[0] || null)}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handlePhotoSelect(e.target.files?.[0] || null)}
            />

            {photoPreview ? (
              <div className="flex items-center gap-3 p-2 bg-slate-50 border border-slate-200 rounded-xl">
                <img
                  src={photoPreview}
                  alt="Handover preview"
                  className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-slate-800 block truncate">
                    {photoFile?.name}
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    {photoFile
                      ? `${(photoFile.size / 1024).toFixed(0)} KB • Ready to link to handover history`
                      : ""}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-200/50 transition-colors"
                  title="Remove photo"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-2 px-3 border border-dashed border-slate-300 hover:border-brand-500 rounded-lg text-xs font-semibold text-slate-700 bg-slate-50/50 hover:bg-brand-50/50 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                  Attach Photo File
                </button>
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="py-2 px-3 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50/50 hover:bg-emerald-100/50 flex items-center justify-center gap-1.5 transition-colors shrink-0"
                >
                  <Camera className="w-3.5 h-3.5 text-emerald-600" />
                  Take Photo
                </button>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm shadow-emerald-200 flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              <UserCheck className="w-3.5 h-3.5" />
              {loading ? "Recording in DB..." : "Confirm & Save History"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

