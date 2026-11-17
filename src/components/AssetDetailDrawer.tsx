"use client";

import React, { useState } from "react";
import { AssetDTO, UserRole } from "@/types";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import { getAssetById } from "@/services/assetService";
import {
  X,
  Laptop,
  Building,
  User,
  MapPin,
  Calendar,
  Coins,
  History,
  QrCode,
  ShieldCheck,
  Clock,
  ArrowRight,
  FileText,
  AlertTriangle,
  Printer,
  Camera,
  ImageIcon,
  Star,
  Maximize2,
} from "lucide-react";
import { generateAssetQRPayload, generateQRCodeDataURL } from "@/lib/qrcode";
import AssetPhotoGallery from "./AssetPhotoGallery";
import AssetPhotoLightboxModal from "./AssetPhotoLightboxModal";
import AssetPhotoUploadModal from "./AssetPhotoUploadModal";

interface AssetDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  asset: AssetDTO | null;
  currentRole: UserRole;
  onEdit?: () => void;
  onAssign?: () => void;
  onPrintLabel?: (asset: AssetDTO) => void;
  onAssetUpdated?: () => void;
}

export default function AssetDetailDrawer({
  isOpen,
  onClose,
  asset: initialAsset,
  currentRole,
  onEdit,
  onAssign,
  onPrintLabel,
  onAssetUpdated,
}: AssetDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<"specs" | "photos" | "history" | "audit" | "qr">("specs");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [localAsset, setLocalAsset] = useState<AssetDTO | null>(initialAsset);
  const permissions = ROLE_PERMISSIONS[currentRole];

  React.useEffect(() => {
    setLocalAsset(initialAsset);
  }, [initialAsset]);

  const activeAsset = localAsset || initialAsset;

  const refreshAssetData = async () => {
    if (!activeAsset) return;
    try {
      const asset = await getAssetById(activeAsset.id);
      if (asset) {
        setLocalAsset(asset);
      }
    } catch (err) {
      console.error("Failed to refresh asset:", err);
    }
    onAssetUpdated?.();
  };

  React.useEffect(() => {
    if (!activeAsset) return;
    const payload = generateAssetQRPayload({
      id: activeAsset.id,
      assetTag: activeAsset.assetTag,
      companyCode: activeAsset.company?.code,
      serialNumber: activeAsset.serialNumber,
      qrCodeToken: activeAsset.qrCodeToken,
    });
    generateQRCodeDataURL(payload, { width: 240, margin: 1 }).then(setQrDataUrl).catch(console.error);
  }, [activeAsset]);

  if (!isOpen || !activeAsset) return null;
  const asset = activeAsset;

  const formatCurrency = (val?: number | null) => {
    if (val === undefined || val === null) return "—";
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("id-ID", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-xl bg-white shadow-2xl border-l border-slate-200 h-full flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-6 bg-slate-50 border-b border-slate-200">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              {asset.primaryPhoto?.thumbnailUrl ? (
                <div
                  className="relative group cursor-pointer shrink-0 mt-0.5"
                  onClick={() => setIsLightboxOpen(true)}
                  title="Click to view full-screen photo"
                >
                  <img
                    src={asset.primaryPhoto.thumbnailUrl}
                    alt={asset.assetName}
                    className="w-14 h-14 rounded-xl object-cover border-2 border-white shadow-md ring-1 ring-slate-200 group-hover:ring-brand-500 transition-all"
                  />
                  <span className="absolute -bottom-1 -right-1 p-1 bg-brand-600 text-white rounded-full shadow-xs">
                    <Camera className="w-2.5 h-2.5" />
                  </span>
                </div>
              ) : null}
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-brand-100 text-brand-800 border border-brand-200">
                    {asset.assetTag}
                  </span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                    {asset.company?.code}
                  </span>
                  {asset.isDuplicateTag && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-rose-600" /> Duplicate Tag
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-1.5 leading-snug">
                  {asset.assetName}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Internal ID: <code className="font-mono text-[11px] text-slate-700">{asset.id}</code>
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

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 mt-5 border-b border-slate-200 -mb-6 pb-2">
            <button
              onClick={() => setActiveTab("specs")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "specs"
                  ? "bg-brand-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              Specifications
            </button>
            <button
              onClick={() => setActiveTab("photos")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === "photos"
                  ? "bg-brand-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              Photos
              {asset.photos && asset.photos.length > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    activeTab === "photos"
                      ? "bg-brand-700 text-white"
                      : "bg-slate-200 text-slate-800"
                  }`}
                >
                  {asset.photos.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === "history"
                  ? "bg-brand-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Assignment History
              {asset.assignments && asset.assignments.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200/60 text-slate-800">
                  {asset.assignments.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("audit")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "audit"
                  ? "bg-brand-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              Audit Trail
            </button>
            <button
              onClick={() => setActiveTab("qr")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                activeTab === "qr"
                  ? "bg-brand-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              QR Code
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === "specs" && (
            <div className="space-y-6">
              {/* Assignment Banner */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                  Current Assignment & Custody
                </span>
                <div className="flex items-center justify-between">
                  <div>
                    {asset.assignedEmployee ? (
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900">
                          <User className="w-4 h-4 text-brand-600" />
                          <span>{asset.assignedEmployee.name}</span>
                        </div>
                        <span className="text-xs text-slate-500 block mt-0.5">
                          ID: {asset.assignedEmployee.employeeId} • Dept: {asset.assignedEmployee.department || "General"}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-slate-500 italic">
                        Currently in Storage Pool (Unassigned)
                      </span>
                    )}
                  </div>
                  {permissions.canAssignAssets && onAssign && (
                    <button
                      onClick={onAssign}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors"
                    >
                      Change User
                    </button>
                  )}
                </div>
              </div>

              {/* Primary Asset Photo Larger Preview */}
              {asset.primaryPhoto ? (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <Camera className="w-3.5 h-3.5 text-brand-600" />
                        Primary Asset Photo
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-white shadow-2xs flex items-center gap-1">
                        <Star className="w-2.5 h-2.5 fill-white" />
                        Primary
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIsLightboxOpen(true)}
                        className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg shadow-2xs transition-colors flex items-center gap-1"
                        title="Open full-screen image viewer"
                      >
                        <Maximize2 className="w-3 h-3 text-slate-500" />
                        Enlarge
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab("photos")}
                        className="px-2.5 py-1 text-[11px] font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-lg shadow-2xs transition-colors"
                      >
                        All Photos ({asset.photos?.length || 0})
                      </button>
                    </div>
                  </div>

                  {/* Responsive Photo Display Container */}
                  <div
                    onClick={() => setIsLightboxOpen(true)}
                    className="relative w-full h-56 sm:h-64 bg-slate-950 rounded-xl overflow-hidden cursor-pointer group shadow-inner border border-slate-900/60 flex items-center justify-center transition-all"
                    title="Click to view full screen"
                  >
                    <img
                      src={asset.primaryPhoto.url}
                      alt={asset.primaryPhoto.description || asset.assetName}
                      className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                    />

                    {/* Enlarge Hint Pill on Hover */}
                    <div className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-slate-950/80 backdrop-blur-xs text-white text-[11px] font-medium flex items-center gap-1.5 opacity-90 group-hover:opacity-100 group-hover:bg-brand-600 transition-all shadow-md">
                      <Maximize2 className="w-3 h-3" />
                      Click to expand
                    </div>
                  </div>

                  {/* Metadata & Description */}
                  <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 pt-0.5">
                    <span className="truncate font-medium text-slate-700">
                      {asset.primaryPhoto.description || asset.primaryPhoto.originalFilename}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400 shrink-0 ml-2">
                      {asset.primaryPhoto.width} × {asset.primaryPhoto.height} px • {(asset.primaryPhoto.fileSize / 1024).toFixed(0)} KB
                    </span>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-5 text-center bg-slate-50/60">
                  <div className="w-10 h-10 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                    <ImageIcon className="w-5 h-5 stroke-1" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-700">No Physical Photo Documented</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5 max-w-sm mx-auto">
                    {permissions.canManagePhotos
                      ? "Upload device photos to document physical condition, serial number tag, and accessories."
                      : "No physical photo has been documented for this asset by IT administration."}
                  </p>
                  {permissions.canManagePhotos && (
                    <button
                      type="button"
                      onClick={() => setIsUploadModalOpen(true)}
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Upload Primary Photo
                    </button>
                  )}
                </div>
              )}

              {/* Hardware Spec Grid */}
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-3">
                  Hardware Specifications
                </span>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-slate-400 block text-[11px]">Model</span>
                    <span className="font-semibold text-slate-800">{asset.model}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-slate-400 block text-[11px]">Category</span>
                    <span className="font-semibold text-slate-800">{asset.category}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-slate-400 block text-[11px]">CPU / Processor</span>
                    <span className="font-semibold text-slate-800">{asset.cpu}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-slate-400 block text-[11px]">RAM / Memory</span>
                    <span className="font-semibold text-slate-800">{asset.ram}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-slate-400 block text-[11px]">Serial Number</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {asset.serialNumber || "Unrecorded"}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-slate-400 block text-[11px]">MAC Address</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {asset.macAddress || "—"}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-slate-400 block text-[11px]">Location</span>
                    <span className="font-semibold text-slate-800 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {asset.location}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-slate-400 block text-[11px]">Physical Condition</span>
                    <span className="font-semibold text-slate-800">{asset.physicalCondition}</span>
                  </div>
                </div>
              </div>

              {/* Machine Identifiers (Zero Passwords) */}
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-3">
                  Account Identifiers (Non-Sensitive)
                </span>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-slate-400 block text-[11px]">Laptop Account / Host</span>
                    <span className="font-mono text-slate-800 font-semibold">{asset.laptopAccount || "—"}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-slate-400 block text-[11px]">Domain / Assigned User</span>
                    <span className="font-mono text-slate-800 font-semibold">{asset.username || "—"}</span>
                  </div>
                </div>
              </div>

              {/* Financial Breakdown (Visible only to authorized roles) */}
              {permissions.canViewFinancials && (
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-3">
                    Financial Capital & Depreciation
                  </span>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-indigo-50/50 rounded-lg border border-indigo-100">
                      <span className="text-indigo-600 block text-[11px]">Purchase Cost</span>
                      <span className="font-bold text-slate-900 text-sm">
                        {formatCurrency(asset.purchaseCost)}
                      </span>
                    </div>
                    <div className="p-3 bg-emerald-50/50 rounded-lg border border-emerald-100">
                      <span className="text-emerald-700 block text-[11px]">Net Book Value (NBV)</span>
                      <span className="font-bold text-emerald-800 text-sm">
                        {formatCurrency(asset.netBookValue)}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-slate-400 block text-[11px]">Purchase Date</span>
                      <span className="font-semibold text-slate-800">
                        {formatDate(asset.purchaseDate)}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-slate-400 block text-[11px]">Depreciation Method</span>
                      <span className="font-semibold text-slate-800">
                        {asset.depreciationMethod} ({asset.usefulLifeMonths || 36} mos)
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              {asset.notes && (
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
                    Remarks & Notes
                  </span>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700 whitespace-pre-wrap">
                    {asset.notes}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab: Asset Photo Gallery */}
          {activeTab === "photos" && (
            <AssetPhotoGallery
              asset={asset}
              currentRole={currentRole}
              onPhotoUpdated={refreshAssetData}
            />
          )}

          {/* Tab 2: Immutable Assignment History */}
          {activeTab === "history" && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  All employee handovers, returns, and transfers are permanently preserved in PostgreSQL.
                </span>
              </div>

              {asset.assignments && asset.assignments.length > 0 ? (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {asset.assignments.map((item, idx) => (
                    <div key={item.id} className="relative">
                      {/* Timeline dot */}
                      <div
                        className={`absolute -left-6 top-1 w-3 h-3 rounded-full border-2 border-white ${
                          idx === 0 && !item.returnedAt ? "bg-emerald-500 ring-2 ring-emerald-200" : "bg-slate-400"
                        }`}
                      />
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-brand-100 text-brand-800">
                              {item.actionType}
                            </span>
                            {item.employee ? item.employee.name : "Warehouse / Storage"}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {formatDate(item.assignedAt)}
                          </span>
                        </div>

                        {item.handoverDocRef && (
                          <div className="text-[11px] text-slate-600 flex items-center gap-1">
                            <FileText className="w-3 h-3 text-slate-400" />
                            <span>Ref: <strong className="font-mono">{item.handoverDocRef}</strong></span>
                          </div>
                        )}

                        <div className="text-[11px] text-slate-500 flex items-center gap-3">
                          <span>Condition: <strong>{item.conditionAtAction}</strong></span>
                          {item.performedBy && <span>Officer: <strong>{item.performedBy}</strong></span>}
                          {item.returnedAt && (
                            <span className="text-amber-700">Returned: {formatDate(item.returnedAt)}</span>
                          )}
                        </div>

                        {item.notes && (
                          <p className="text-[11px] text-slate-600 italic bg-white p-2 rounded border border-slate-100 mt-1">
                            &quot;{item.notes}&quot;
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No previous assignment records. Asset has not been reassigned yet.
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Audit Trail */}
          {activeTab === "audit" && (
            <div className="space-y-3">
              {asset.historyLogs && asset.historyLogs.length > 0 ? (
                asset.historyLogs.map((log) => (
                  <div key={log.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">{log.action}</span>
                      <span className="text-[11px] text-slate-400 font-mono">{formatDate(log.createdAt)}</span>
                    </div>
                    {log.notes && <p className="text-slate-600 text-[11px]">{log.notes}</p>}
                    {log.performedBy && (
                      <span className="text-[10px] text-slate-400 block">By: {log.performedBy}</span>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No additional audit logs recorded.
                </div>
              )}
            </div>
          )}

          {/* Tab 4: QR Code & Stock Opname Token */}
          {activeTab === "qr" && (
            <div className="space-y-4 text-center">
              <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl inline-block mx-auto">
                <div className="w-44 h-44 bg-white border border-slate-300 rounded-xl mx-auto flex flex-col items-center justify-center p-2 shadow-xs">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt={`QR for ${asset.assetTag}`} className="w-36 h-36 object-contain" />
                  ) : (
                    <QrCode className="w-24 h-24 text-slate-900" />
                  )}
                  <span className="font-mono text-[10px] font-bold text-slate-900 mt-1">
                    {asset.assetTag}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-700 block">Stock Opname Token</span>
                <code className="text-xs font-mono bg-slate-100 text-slate-900 px-3 py-1 rounded border border-slate-200 inline-block mt-1">
                  {asset.qrCodeToken || "QR-TOKEN-PENDING"}
                </code>
              </div>

              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Cryptographically generated QR Code encoding the immutable Asset ID ({asset.id.slice(-8)}), Asset Tag, and company code.
              </p>

              {onPrintLabel && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => onPrintLabel(asset)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors shadow-2xs"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print 50×25mm / 60×40mm Label
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
          >
            Close
          </button>
          <div className="flex items-center gap-2">
            {(permissions.canEditAssets || permissions.canEditFinancials) && onEdit && (
              <button
                onClick={onEdit}
                className="px-4 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm shadow-brand-200 transition-colors"
              >
                Edit Asset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox Modal for Full-Screen View */}
      {isLightboxOpen && asset.primaryPhoto && (
        <AssetPhotoLightboxModal
          photo={asset.primaryPhoto}
          allPhotos={asset.photos || [asset.primaryPhoto]}
          onClose={() => setIsLightboxOpen(false)}
          assetId={asset.id}
          currentRole={currentRole}
          onPhotoUpdated={refreshAssetData}
        />
      )}

      {/* Upload Modal triggered from placeholder */}
      {isUploadModalOpen && (
        <AssetPhotoUploadModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          assetId={asset.id}
          assetTag={asset.assetTag}
          assetName={asset.assetName}
          onSuccess={() => {
            setIsUploadModalOpen(false);
            refreshAssetData();
          }}
        />
      )}
    </div>
  );
}

