"use client";

import React from "react";
import { UserRole, AssetDTO } from "@/types";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import {
  Cpu,
  UserCheck,
  ArrowRightLeft,
  CornerDownLeft,
  Plus,
  Upload,
  QrCode,
  Wrench,
  AlertTriangle,
  Clock,
  Laptop,
  CheckCircle2,
  Box,
  FileText,
  User,
  ArrowRight,
} from "lucide-react";

interface ITOperationsOverviewProps {
  stats: any;
  loading?: boolean;
  currentRole: UserRole;
  selectedCompanyName: string;
  onAddAsset: () => void;
  onOpenImport: () => void;
  onAssignAsset: (actionType: "ASSIGN" | "TRANSFER" | "RETURN" | "REPLACEMENT", asset?: AssetDTO) => void;
  onNavigateToInventory: (filter?: { status?: string; duplicateOnly?: boolean }) => void;
  onNavigateToMaintenance: () => void;
  onNavigateToStockOpname: () => void;
  onViewAssetDetails: (assetId: string) => void;
}

export default function ITOperationsOverview({
  stats,
  loading = false,
  currentRole,
  selectedCompanyName,
  onAddAsset,
  onOpenImport,
  onAssignAsset,
  onNavigateToInventory,
  onNavigateToMaintenance,
  onNavigateToStockOpname,
  onViewAssetDetails,
}: ITOperationsOverviewProps) {
  const permissions = ROLE_PERMISSIONS[currentRole];

  if (loading && !stats) {
    return (
      <div className="py-16 text-center text-slate-400 animate-in fade-in duration-150">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent" />
        <p className="mt-3 text-xs font-medium">Loading operational metrics...</p>
      </div>
    );
  }

  const safeStats = stats || {
    inUse: 0,
    available: 0,
    maintenance: 0,
    missingSerials: 0,
    duplicateTags: 0,
    recentAssignments: [],
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("id-ID", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const recentList: any[] = safeStats.recentAssignments || [];
  const assignmentsCount = recentList.filter((a) => a.actionType === "ASSIGN").length;
  const transfersCount = recentList.filter((a) => a.actionType === "TRANSFER").length;
  const returnsCount = recentList.filter((a) => a.actionType === "RETURN").length;

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* 1. Quick Actions Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-brand-600" />
            <span>IT Operational Quick Actions</span>
          </h2>
          <span className="text-[11px] text-slate-400 font-medium">{selectedCompanyName}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {permissions.canCreateAssets && (
            <button
              onClick={onAddAsset}
              className="p-3 bg-brand-50 hover:bg-brand-100 text-brand-800 border border-brand-200 rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-1.5 transition-all group"
            >
              <div className="p-1.5 bg-brand-600 text-white rounded-lg group-hover:scale-105 transition-transform">
                <Plus className="w-4 h-4" />
              </div>
              <span>Add New Asset</span>
            </button>
          )}

          {permissions.canAssignAssets && (
            <button
              onClick={() => onAssignAsset("ASSIGN")}
              className="p-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-1.5 transition-all group"
            >
              <div className="p-1.5 bg-emerald-600 text-white rounded-lg group-hover:scale-105 transition-transform">
                <UserCheck className="w-4 h-4" />
              </div>
              <span>Assign Asset</span>
            </button>
          )}

          {permissions.canAssignAssets && (
            <button
              onClick={() => onAssignAsset("TRANSFER")}
              className="p-3 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-1.5 transition-all group"
            >
              <div className="p-1.5 bg-blue-600 text-white rounded-lg group-hover:scale-105 transition-transform">
                <ArrowRightLeft className="w-4 h-4" />
              </div>
              <span>Transfer User</span>
            </button>
          )}

          {permissions.canAssignAssets && (
            <button
              onClick={() => onAssignAsset("RETURN")}
              className="p-3 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-1.5 transition-all group"
            >
              <div className="p-1.5 bg-amber-600 text-white rounded-lg group-hover:scale-105 transition-transform">
                <CornerDownLeft className="w-4 h-4" />
              </div>
              <span>Return to Storage</span>
            </button>
          )}

          {permissions.canImportAssets && (
            <button
              onClick={onOpenImport}
              className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-1.5 transition-all group"
            >
              <div className="p-1.5 bg-slate-700 text-white rounded-lg group-hover:scale-105 transition-transform">
                <Upload className="w-4 h-4" />
              </div>
              <span>Batch Excel</span>
            </button>
          )}

          <button
            onClick={onNavigateToStockOpname}
            className="p-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-1.5 transition-all group relative"
          >
            <div className="p-1.5 bg-indigo-600 text-white rounded-lg group-hover:scale-105 transition-transform">
              <QrCode className="w-4 h-4" />
            </div>
            <span>Stock Opname</span>
            <span className="absolute -top-1.5 -right-1.5 bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase">
              Phase 2
            </span>
          </button>
        </div>
      </div>

      {/* 2. Operations Workload & Status Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Assigned */}
        <div
          onClick={() => onNavigateToInventory({ status: "IN_USE" })}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-emerald-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              Assigned
            </span>
            <span className="p-1 bg-emerald-50 rounded text-emerald-700">
              <UserCheck className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{safeStats.inUse}</span>
            <span className="text-xs text-emerald-600 font-medium">In Custody</span>
          </div>
        </div>

        {/* Ready to Deploy (Storage Pool) */}
        <div
          onClick={() => onNavigateToInventory({ status: "AVAILABLE" })}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-blue-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800">
              Storage Pool
            </span>
            <span className="p-1 bg-blue-50 rounded text-blue-700">
              <Box className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{safeStats.available}</span>
            <span className="text-xs text-blue-600 font-medium">Ready</span>
          </div>
        </div>

        {/* In Repair / Maintenance */}
        <div
          onClick={onNavigateToMaintenance}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-amber-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
              Maintenance
            </span>
            <span className="p-1 bg-amber-50 rounded text-amber-700">
              <Wrench className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{safeStats.maintenance}</span>
            <span className="text-xs text-amber-600 font-medium">Diagnostic</span>
          </div>
        </div>

        {/* Missing Serials */}
        <div
          onClick={() => onNavigateToInventory()}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Missing S/N
            </span>
            <span className="p-1 bg-slate-100 rounded text-slate-700">
              <AlertTriangle className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{safeStats.missingSerials}</span>
            <span className="text-xs text-slate-500 font-medium">Unrecorded</span>
          </div>
        </div>

        {/* Duplicate Tags */}
        <div
          onClick={() => onNavigateToInventory({ duplicateOnly: true })}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-rose-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800">
              Duplicate Tags
            </span>
            <span className="p-1 bg-rose-50 rounded text-rose-700">
              <AlertTriangle className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-700">{safeStats.duplicateTags}</span>
            <span className="text-xs text-rose-600 font-medium">Review</span>
          </div>
        </div>
      </div>

      {/* 3. Operational Feed & Actionable Issue Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Recent Handover & Custody Activity Feed */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Recent Handover & Custody Log
              </h3>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-400">
              <span>{assignmentsCount} Assigns</span>•<span>{transfersCount} Transfers</span>•<span>{returnsCount} Returns</span>
            </div>
          </div>

          <div className="space-y-3">
            {recentList.length === 0 ? (
              <p className="text-center py-8 text-xs text-slate-400">No recent activity recorded.</p>
            ) : (
              recentList.map((item) => (
                <div
                  key={item.id}
                  className="p-3 bg-slate-50/70 hover:bg-slate-100/70 rounded-xl border border-slate-200/80 transition-colors flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        item.actionType === "ASSIGN"
                          ? "bg-emerald-100 text-emerald-800"
                          : item.actionType === "TRANSFER"
                          ? "bg-blue-100 text-blue-800"
                          : item.actionType === "RETURN"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {item.actionType}
                    </span>
                    <div>
                      <span className="font-semibold text-slate-900 block">
                        {item.asset?.assetTag} • {item.asset?.assetName}
                      </span>
                      <span className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <User className="w-3 h-3 text-slate-400" />
                        {item.employee ? item.employee.name : "Storage Pool"}
                        {item.handoverDocRef && (
                          <span className="font-mono text-slate-400">({item.handoverDocRef})</span>
                        )}
                      </span>
                    </div>
                  </div>

                  <span className="text-[11px] font-mono text-slate-400 shrink-0">
                    {formatDate(item.assignedAt)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Actionable Issue List & Task Queue */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Operational Task Queue</span>
            </h3>
            <span className="text-[11px] font-semibold text-slate-500">
              {safeStats.requiringAttention || 0} Actionable Items
            </span>
          </div>

          <div className="space-y-3">
            {(safeStats.requiringAttention || 0) === 0 ? (
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center gap-3 text-xs">
                <div className="p-2 bg-emerald-100 rounded-lg text-emerald-700 shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <span className="font-bold text-emerald-950 block">Operational Queue Clear</span>
                  <span className="text-emerald-700 text-[11px]">
                    No immediate maintenance diagnostics, duplicate tags, or audit flags pending.
                  </span>
                </div>
              </div>
            ) : (
              <>
                {/* Task: Duplicate Tag Audit */}
                {(safeStats.duplicateTags || 0) > 0 && (
                  <div className="p-3.5 bg-rose-50/60 border border-rose-200 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-rose-950 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-600" />
                        Duplicate Tag Verification
                      </span>
                      <span className="text-[10px] bg-rose-200/80 text-rose-800 font-bold px-1.5 py-0.2 rounded-full">
                        {safeStats.duplicateTags}
                      </span>
                    </div>
                    <p className="text-[11px] text-rose-800 leading-snug">
                      Review legacy imported assets with identical asset tags to verify serial numbers and confirm distinct physical identities.
                    </p>
                    <button
                      onClick={() => onNavigateToInventory({ duplicateOnly: true })}
                      className="text-xs font-bold text-rose-700 hover:text-rose-900 inline-flex items-center gap-1 pt-1"
                    >
                      <span>Open Duplicate Filter</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Task: Maintenance Diagnostic Clearance */}
                {(safeStats.maintenance || 0) > 0 && (
                  <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-600" />
                        Service & Repair Diagnostics
                      </span>
                      <span className="text-[10px] bg-amber-200/80 text-amber-800 font-bold px-1.5 py-0.2 rounded-full">
                        {safeStats.maintenance}
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-800 leading-snug">
                      Review devices currently undergoing diagnostic bench work, battery replacements, or vendor RMA repair.
                    </p>
                    <button
                      onClick={onNavigateToMaintenance}
                      className="text-xs font-bold text-amber-700 hover:text-amber-900 inline-flex items-center gap-1 pt-1"
                    >
                      <span>View Maintenance Queue</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Task: Unnumbered Hardware Audit */}
                {(safeStats.missingSerials || 0) > 0 && (
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-slate-400" />
                        Hardware S/N Physical Audit
                      </span>
                      <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-1.5 py-0.2 rounded-full">
                        {safeStats.missingSerials}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">
                      Record serial numbers for legacy assets before the upcoming physical Stock Opname audit cycle.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

