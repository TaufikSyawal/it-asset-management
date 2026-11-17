"use client";

import React, { useState } from "react";
import { AssetDTO, UserRole } from "@/types";
import { Wrench, CheckCircle2, AlertTriangle, Eye, Search, Plus, CornerDownLeft } from "lucide-react";
import { ROLE_PERMISSIONS } from "@/lib/permissions";

interface MaintenanceViewProps {
  assets: AssetDTO[];
  currentRole: UserRole;
  onViewDetails: (asset: AssetDTO) => void;
  onAssignAsset: (asset: AssetDTO) => void;
  onSendToMaintenance: () => void;
  onRefresh: () => void;
}

export default function MaintenanceView({
  assets,
  currentRole,
  onViewDetails,
  onAssignAsset,
  onSendToMaintenance,
  onRefresh,
}: MaintenanceViewProps) {
  const [search, setSearch] = useState("");
  const permissions = ROLE_PERMISSIONS[currentRole];

  const maintenanceAssets = assets.filter((a) => {
    if (a.status !== "MAINTENANCE") return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.assetTag.toLowerCase().includes(q) ||
      a.assetName.toLowerCase().includes(q) ||
      (a.notes && a.notes.toLowerCase().includes(q)) ||
      a.model.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Wrench className="w-4 h-4 text-amber-600" />
            <span>Hardware Maintenance & Repair Diagnostics</span>
          </h2>
          <p className="text-xs text-slate-500">
            Devices requiring servicing, vendor RMA, or component upgrades
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-48 sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search repair bench..."
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500 focus:outline-hidden shadow-2xs"
            />
          </div>

          {permissions.canAssignAssets && (
            <button
              onClick={onSendToMaintenance}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Send Device to Repair</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid of Maintenance Assets */}
      {maintenanceAssets.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 space-y-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto stroke-1" />
          <h3 className="text-sm font-bold text-slate-700">No Assets Under Maintenance</h3>
          <p className="text-xs text-slate-500">
            {search
              ? "No maintenance records match your search criteria."
              : "All registered hardware is currently either deployed in custody or available in storage."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {maintenanceAssets.map((asset) => (
            <div
              key={asset.id}
              className="bg-white p-5 rounded-2xl border border-amber-200 shadow-2xs hover:border-amber-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                      {asset.assetTag}
                    </span>
                    <span className="text-[11px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-800">
                      {asset.company?.code}
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                    {asset.physicalCondition}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-900 mt-2.5">{asset.assetName}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {asset.model} • {asset.category}
                </p>

                <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-700 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                    Diagnostic / Repair Reason
                  </span>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    {asset.notes || "Device sent for routine inspection and servicing."}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => onViewDetails(asset)}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Inspect</span>
                </button>

                {permissions.canAssignAssets && (
                  <button
                    onClick={() => onAssignAsset(asset)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-2xs transition-colors"
                  >
                    <CornerDownLeft className="w-3.5 h-3.5" />
                    <span>Clear & Return</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
