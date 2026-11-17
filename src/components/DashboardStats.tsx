"use client";

import React from "react";
import { UserRole } from "@/types";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import {
  Laptop,
  CheckCircle2,
  Box,
  Wrench,
  AlertTriangle,
  Coins,
  TrendingDown,
  Building,
} from "lucide-react";

interface DashboardStatsProps {
  stats: {
    total: number;
    inUse: number;
    available: number;
    maintenance: number;
    missing: number;
    disposed: number;
    duplicateTags: number;
    totalPurchaseCost?: number | null;
    totalNetBookValue?: number | null;
  } | null;
  currentRole: UserRole;
  selectedCompanyName?: string;
  onFilterDuplicateTags?: () => void;
  onFilterStatus?: (status: string) => void;
}

export default function DashboardStats({
  stats,
  currentRole,
  selectedCompanyName = "All Entities",
  onFilterDuplicateTags,
  onFilterStatus,
}: DashboardStatsProps) {
  const permissions = ROLE_PERMISSIONS[currentRole];

  if (!stats) return null;

  const formatCurrency = (val?: number | null) => {
    if (val === undefined || val === null) return "—";
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="space-y-4">
      {/* Header bar showing scope */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Building className="w-4 h-4 text-brand-600" />
            <span>Dashboard Overview</span>
            <span className="text-xs font-normal text-slate-500">
              ({selectedCompanyName})
            </span>
          </h2>
        </div>
      </div>

      {/* Main KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Total Assets */}
        <div
          onClick={() => onFilterStatus && onFilterStatus("ALL")}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Assets</span>
            <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-slate-200 transition-colors">
              <Laptop className="w-4 h-4 text-slate-700" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{stats.total}</span>
            <span className="text-[11px] text-slate-500">Registered</span>
          </div>
        </div>

        {/* In Use */}
        <div
          onClick={() => onFilterStatus && onFilterStatus("IN_USE")}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-emerald-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
              In Use
            </span>
            <div className="p-2 bg-emerald-50 rounded-lg group-hover:bg-emerald-100 transition-colors">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-700">{stats.inUse}</span>
            <span className="text-[11px] text-emerald-600">
              {stats.total > 0 ? `${Math.round((stats.inUse / stats.total) * 100)}%` : "0%"}
            </span>
          </div>
        </div>

        {/* Available */}
        <div
          onClick={() => onFilterStatus && onFilterStatus("AVAILABLE")}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-blue-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-800">
              Available
            </span>
            <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
              <Box className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-blue-700">{stats.available}</span>
            <span className="text-[11px] text-blue-600">In Storage</span>
          </div>
        </div>

        {/* Maintenance */}
        <div
          onClick={() => onFilterStatus && onFilterStatus("MAINTENANCE")}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-amber-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-800">
              Maintenance
            </span>
            <div className="p-2 bg-amber-50 rounded-lg group-hover:bg-amber-100 transition-colors">
              <Wrench className="w-4 h-4 text-amber-600" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-700">{stats.maintenance}</span>
            <span className="text-[11px] text-amber-600">Under Repair</span>
          </div>
        </div>

        {/* Duplicate Tags Warning */}
        <div
          onClick={onFilterDuplicateTags}
          className={`p-4 rounded-xl border transition-all cursor-pointer group ${
            stats.duplicateTags > 0
              ? "bg-rose-50/70 border-rose-200 hover:border-rose-300"
              : "bg-white border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-800">
              Duplicate Tags
            </span>
            <div className="p-2 bg-rose-100/70 rounded-lg group-hover:bg-rose-200 transition-colors">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-700">{stats.duplicateTags}</span>
            <span className="text-[11px] text-rose-600">Audit Flags</span>
          </div>
        </div>
      </div>

      {/* Financial Section (Strictly displayed only to roles with financial permission) */}
      {permissions.canViewFinancials && (
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-sm">
              <Coins className="w-6 h-6 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-200">
                  Financial Valuation & Asset Capital
                </span>
                <span className="bg-indigo-500/30 text-indigo-200 text-[10px] font-medium px-2 py-0.5 rounded border border-indigo-400/20">
                  {currentRole === "SUPER_ADMIN" ? "Super Admin" : currentRole === "FINANCE" ? "Finance Role" : "Auditor"}
                </span>
              </div>
              <p className="text-xs text-indigo-300/80 mt-0.5">
                Straight-line depreciation and book value metrics for {selectedCompanyName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 sm:gap-8 divide-x divide-white/10">
            <div>
              <span className="text-[11px] text-indigo-200 uppercase tracking-wider block">
                Total Acquisition Cost
              </span>
              <span className="text-lg sm:text-xl font-bold text-white tracking-tight">
                {formatCurrency(stats.totalPurchaseCost)}
              </span>
            </div>

            <div className="pl-6 sm:pl-8">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-indigo-200 uppercase tracking-wider block">
                  Net Book Value (NBV)
                </span>
                <TrendingDown className="w-3.5 h-3.5 text-indigo-300" />
              </div>
              <span className="text-lg sm:text-xl font-bold text-emerald-400 tracking-tight">
                {formatCurrency(stats.totalNetBookValue)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

