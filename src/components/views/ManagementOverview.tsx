"use client";

import React from "react";
import { UserRole } from "@/types";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import {
  Building2,
  PieChart,
  CheckCircle2,
  Box,
  Wrench,
  AlertTriangle,
  Coins,
  TrendingUp,
  Percent,
  Layers,
  ArrowRight,
  Info,
  ShieldCheck,
  Package,
} from "lucide-react";

interface ManagementOverviewProps {
  stats: any;
  currentRole: UserRole;
  selectedCompanyName: string;
  onNavigateToInventory: (filter?: { status?: string; duplicateOnly?: boolean }) => void;
  onNavigateToMaintenance: () => void;
}

export default function ManagementOverview({
  stats,
  currentRole,
  selectedCompanyName,
  onNavigateToInventory,
  onNavigateToMaintenance,
}: ManagementOverviewProps) {
  const permissions = ROLE_PERMISSIONS[currentRole];

  if (!stats) {
    return (
      <div className="py-16 text-center text-slate-400">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent" />
        <p className="mt-3 text-xs font-medium">Computing management metrics...</p>
      </div>
    );
  }

  const formatCurrency = (val?: number | null) => {
    if (val === undefined || val === null) return "—";
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const total = stats.total || 0;
  const inUse = stats.inUse || 0;
  const available = stats.available || 0;
  const maintenance = stats.maintenance || 0;
  const duplicateTags = stats.duplicateTags || 0;
  const missingSerials = stats.missingSerials || 0;
  const requiringAttention = stats.requiringAttention || 0;
  const totalAttentionIssues = stats.totalAttentionIssues || (duplicateTags + maintenance + missingSerials);
  const utilizationRate = stats.utilizationRate || (total > 0 ? Math.round((inUse / total) * 100) : 0);

  const getDisplayPercentage = (count: number, totalCount: number) => {
    if (totalCount === 0) return "0%";
    const pct = (count / totalCount) * 100;
    if (pct > 0 && pct < 1) return "<1%";
    return `${Math.round(pct)}%`;
  };

  // Management Insights generated strictly from database facts
  const insights: string[] = [];
  if (total > 0) {
    insights.push(`${utilizationRate}% of total hardware assets are actively deployed to personnel.`);
  } else {
    insights.push("No hardware assets currently registered in this scope.");
  }

  if (available > 0) {
    insights.push(`${available} assets are unassigned and in storage, ready for deployment.`);
  }

  if (requiringAttention > 0) {
    insights.push(`${requiringAttention} distinct hardware asset${requiringAttention > 1 ? "s" : ""} require management review across ${totalAttentionIssues} total logged issue flags (no double counting).`);
  }

  if (duplicateTags > 0) {
    insights.push(`${duplicateTags} duplicate Asset Tag occurrences flagged across legacy imports.`);
  }

  if (maintenance > 0) {
    insights.push(`${maintenance} device${maintenance > 1 ? "s are" : " is"} currently under maintenance or repair.`);
  }

  if (missingSerials > 0) {
    insights.push(`${missingSerials} unnumbered legacy assets without recorded serial numbers.`);
  }

  // Company colors for SVG Donut (GMD, GMC, TEL, RCI and dynamic entities)
  const COMPANY_COLORS: Record<string, string> = {
    GMD: "#4f46e5", // Indigo
    GMC: "#0284c7", // Sky
    TEL: "#059669", // Emerald
    RCI: "#d97706", // Amber
    Other: "#64748b",
  };
  const COLOR_PALETTE = ["#4f46e5", "#0284c7", "#059669", "#d97706", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

  // Prepare donut segments
  const companyData: Array<{ code: string; count: number; percentage: number; color: string }> = (
    stats.byCompany || []
  ).map((c: any, idx: number) => ({
    code: c.code,
    count: c.count,
    percentage: c.percentage,
    color: COMPANY_COLORS[c.code] || COLOR_PALETTE[idx % COLOR_PALETTE.length],
  }));

  // Calculate SVG Donut stroke offsets
  let cumulativePercent = 0;
  const donutSegments = companyData.map((c) => {
    const strokeDasharray = `${c.percentage} ${100 - c.percentage}`;
    const strokeDashoffset = -cumulativePercent;
    cumulativePercent += c.percentage;
    return {
      ...c,
      strokeDasharray,
      strokeDashoffset,
    };
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Scope Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-200">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Building2 className="w-4 h-4 text-brand-600" />
          <span className="font-semibold text-slate-800">Executive Scope:</span>
          <span className="px-2.5 py-0.5 rounded-full bg-slate-200/80 text-slate-800 font-bold text-[11px]">
            {selectedCompanyName}
          </span>
        </div>
        <span className="text-[11px] text-slate-400">
          Real-time PostgreSQL aggregates • High-level overview
        </span>
      </div>

      {/* 1. Primary Executive KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Assets */}
        <div
          onClick={() => onNavigateToInventory()}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Total Assets
            </span>
            <div className="p-1.5 bg-slate-100 rounded-lg group-hover:bg-slate-200 transition-colors">
              <Package className="w-4 h-4 text-slate-700" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-slate-900 tracking-tight">{total}</span>
            <span className="text-[11px] text-slate-400 font-medium">Devices</span>
          </div>
        </div>

        {/* Assets In Use */}
        <div
          onClick={() => onNavigateToInventory({ status: "IN_USE" })}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-emerald-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              In Use
            </span>
            <div className="p-1.5 bg-emerald-50 rounded-lg group-hover:bg-emerald-100 transition-colors">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-emerald-700 tracking-tight">{inUse}</span>
            <span className="text-[11px] text-emerald-600 font-semibold">{utilizationRate}%</span>
          </div>
        </div>

        {/* Available Assets */}
        <div
          onClick={() => onNavigateToInventory({ status: "AVAILABLE" })}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-blue-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800">
              Available
            </span>
            <div className="p-1.5 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
              <Box className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-blue-700 tracking-tight">{available}</span>
            <span className="text-[11px] text-blue-500 font-medium">In Storage</span>
          </div>
        </div>

        {/* Maintenance */}
        <div
          onClick={onNavigateToMaintenance}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-amber-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
              Maintenance
            </span>
            <div className="p-1.5 bg-amber-50 rounded-lg group-hover:bg-amber-100 transition-colors">
              <Wrench className="w-4 h-4 text-amber-600" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-amber-700 tracking-tight">{maintenance}</span>
            <span className="text-[11px] text-amber-600 font-medium">Under Repair</span>
          </div>
        </div>

        {/* Assets Requiring Attention */}
        <div
          onClick={() => onNavigateToInventory({ duplicateOnly: true })}
          className={`p-4 rounded-xl border transition-all cursor-pointer group ${
            requiringAttention > 0
              ? "bg-rose-50/70 border-rose-200 hover:border-rose-300"
              : "bg-white border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800">
              Need Attention
            </span>
            <div className="p-1.5 bg-rose-100/80 rounded-lg group-hover:bg-rose-200 transition-colors">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-rose-700 tracking-tight">
              {requiringAttention}
            </span>
            <span className="text-[11px] text-rose-600 font-medium">Distinct</span>
          </div>
          <span className="text-[10px] text-rose-500 font-medium block truncate mt-0.5">
            {totalAttentionIssues} issues (deduplicated)
          </span>
        </div>

        {/* Utilization Rate */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand-800">
              Utilization
            </span>
            <div className="p-1.5 bg-brand-50 rounded-lg">
              <Percent className="w-4 h-4 text-brand-600" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-brand-700 tracking-tight">
              {utilizationRate}%
            </span>
            <span className="text-[11px] text-brand-600 font-medium">Deployed</span>
          </div>
        </div>
      </div>

      {/* 2. Financial Valuation Banner (Strictly Role-Restricted) */}
      {permissions.canViewFinancials && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-sm border border-indigo-950 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm border border-white/10">
              <Coins className="w-6 h-6 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm tracking-wide text-white uppercase">
                  Corporate Asset Capital & Valuation
                </h3>
                <span className="bg-indigo-500/30 text-indigo-200 text-[10px] font-semibold px-2 py-0.5 rounded border border-indigo-400/20">
                  {currentRole}
                </span>
              </div>
              <p className="text-xs text-indigo-200/80 mt-0.5">
                Financial summary calculated from straight-line depreciation for {selectedCompanyName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-8 sm:gap-12 divide-x divide-white/10 w-full md:w-auto justify-between md:justify-end">
            <div>
              <span className="text-[11px] uppercase tracking-wider font-semibold text-indigo-200 block">
                Total Acquisition Cost
              </span>
              <span className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                {formatCurrency(stats.totalPurchaseCost)}
              </span>
            </div>

            <div className="pl-8 sm:pl-12">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-emerald-300 block">
                Net Book Value (NBV)
              </span>
              <span className="text-xl sm:text-2xl font-extrabold text-emerald-400 tracking-tight">
                {formatCurrency(stats.totalNetBookValue)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Executive Visual Analytics (Company Donut + Category Bars) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Assets by Company (Donut Chart) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <PieChart className="w-4 h-4 text-brand-600" />
              <span>Asset Distribution by Entity</span>
            </h3>
            <span className="text-[11px] text-slate-400">{companyData.length} Entities</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-around gap-6 pt-2">
            {/* SVG Donut */}
            <div className="relative w-36 h-36 shrink-0">
              <svg viewBox="0 0 42 42" className="w-full h-full transform -rotate-90">
                <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#f1f5f9" strokeWidth="6" />
                {donutSegments.map((seg, idx) => (
                  <circle
                    key={idx}
                    cx="21"
                    cy="21"
                    r="15.91549430918954"
                    fill="transparent"
                    stroke={seg.color}
                    strokeWidth="6"
                    strokeDasharray={seg.strokeDasharray}
                    strokeDashoffset={seg.strokeDashoffset}
                    className="transition-all duration-500"
                  />
                ))}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                <span className="text-xl font-extrabold text-slate-900 leading-none">{total}</span>
                <span className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">Assets</span>
              </div>
            </div>

            {/* Donut Legend */}
            <div className="space-y-2.5 w-full max-w-xs">
              {companyData.map((c) => (
                <div key={c.code} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                    <span className="font-bold text-slate-800">{c.code}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="font-semibold text-slate-700">{c.count}</span>
                    <span className="text-[11px] text-slate-400">({c.percentage}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Assets by Category (Horizontal Bar Distribution) */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand-600" />
              <span>Hardware Allocation by Category</span>
            </h3>
            <span className="text-[11px] text-slate-400">Real counts</span>
          </div>

          <div className="space-y-3 pt-1">
            {(stats.byCategory || []).map((cat: any) => (
              <div key={cat.category} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 capitalize">
                    {cat.category.toLowerCase().replace("_", " ")}
                  </span>
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="font-bold text-slate-900">{cat.count}</span>
                    <span className="text-[11px] text-slate-400">({getDisplayPercentage(cat.count, total)})</span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-brand-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${cat.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Management Insights & Attention Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Factual Executive Insights */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Info className="w-4 h-4 text-brand-600 shrink-0" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Management Intelligence & Factual Observations
            </h3>
          </div>
          <ul className="space-y-2.5">
            {insights.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-700 leading-relaxed">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-1.5 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Management Attention & Actionable Discrepancies */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Action Items Requiring Attention
              </h3>
            </div>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
              {requiringAttention} Distinct Assets ({totalAttentionIssues} issues)
            </span>
          </div>

          <div className="space-y-2.5">
            {/* Maintenance notice */}
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-amber-950 block">Hardware in Maintenance Queue</span>
                <span className="text-amber-800 text-[11px]">
                  {maintenance} asset{maintenance > 1 ? "s" : ""} undergoing repair or diagnostics
                </span>
              </div>
              <button
                onClick={onNavigateToMaintenance}
                className="text-amber-900 hover:text-amber-950 font-bold text-xs flex items-center gap-1 transition-colors"
              >
                <span>View</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Duplicate tags notice */}
            <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-rose-950 block">Duplicate Asset Tag Review</span>
                <span className="text-rose-800 text-[11px]">
                  {duplicateTags} record{duplicateTags > 1 ? "s" : ""} flagged from legacy spreadsheet imports
                </span>
              </div>
              <button
                onClick={() => onNavigateToInventory({ duplicateOnly: true })}
                className="text-rose-900 hover:text-rose-950 font-bold text-xs flex items-center gap-1 transition-colors"
              >
                <span>Review</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Unrecorded serials notice */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-slate-800 block">Missing Hardware Serial Numbers</span>
                <span className="text-slate-600 text-[11px]">
                  {missingSerials} asset{missingSerials > 1 ? "s" : ""} pending physical S/N verification
                </span>
              </div>
              <button
                onClick={() => onNavigateToInventory()}
                className="text-slate-700 hover:text-slate-900 font-bold text-xs flex items-center gap-1 transition-colors"
              >
                <span>Audit</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

