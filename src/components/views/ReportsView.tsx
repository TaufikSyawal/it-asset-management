"use client";

import React from "react";
import * as XLSX from "xlsx";
import { UserRole, CompanyDTO, AssetDTO } from "@/types";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import { BarChart3, Printer, Download, Coins, Building, Package, ShieldCheck, CheckCircle2 } from "lucide-react";

interface ReportsViewProps {
  stats: any;
  assets: AssetDTO[];
  currentRole: UserRole;
  companies: CompanyDTO[];
  selectedCompanyName: string;
}

export default function ReportsView({
  stats,
  assets,
  currentRole,
  companies,
  selectedCompanyName,
}: ReportsViewProps) {
  const permissions = ROLE_PERMISSIONS[currentRole];

  const formatCurrency = (val?: number | null) => {
    if (val === undefined || val === null) return "—";
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const handlePrint = () => {
    window.print();
  };

  // Export full report to Excel (.xlsx)
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Executive KPI Summary
    const summaryData = [
      { Metric: "Scope", Value: selectedCompanyName },
      { Metric: "Total Registered Hardware", Value: stats?.total || 0 },
      { Metric: "Assets In Use (Deployed)", Value: stats?.inUse || 0 },
      { Metric: "Available in Storage Pool", Value: stats?.available || 0 },
      { Metric: "Under Maintenance / Diagnostics", Value: stats?.maintenance || 0 },
      { Metric: "Hardware Utilization Rate", Value: `${stats?.utilizationRate || 0}%` },
      { Metric: "Distinct Assets Requiring Attention", Value: stats?.requiringAttention || 0 },
      ...(permissions.canViewFinancials
        ? [
            { Metric: "Total Historical Acquisition Cost (IDR)", Value: stats?.totalPurchaseCost || 0 },
            { Metric: "Current Net Book Value (IDR)", Value: stats?.totalNetBookValue || 0 },
          ]
        : []),
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Executive Summary");

    // Sheet 2: Category Allocation
    const categoryData = (stats?.byCategory || []).map((cat: any) => ({
      Category: cat.category,
      "Asset Count": cat.count,
      "Allocation Percentage": `${cat.percentage}%`,
    }));
    const wsCategory = XLSX.utils.json_to_sheet(categoryData);
    XLSX.utils.book_append_sheet(wb, wsCategory, "Category Breakdown");

    // Sheet 3: Entity Breakdown
    const entityData = (stats?.byCompany || []).map((comp: any) => ({
      Entity: comp.code,
      "Asset Count": comp.count,
      "Allocation Percentage": `${comp.percentage}%`,
    }));
    const wsEntity = XLSX.utils.json_to_sheet(entityData);
    XLSX.utils.book_append_sheet(wb, wsEntity, "Entity Breakdown");

    // Sheet 4: Full Assets List
    const assetListData = assets.map((a) => ({
      "Asset Tag": a.assetTag,
      "Asset Name": a.assetName,
      Entity: a.company?.code || "",
      Category: a.category,
      Model: a.model,
      CPU: a.cpu,
      RAM: a.ram,
      "Serial Number": a.serialNumber || "Unrecorded",
      Status: a.status,
      Condition: a.physicalCondition,
      "Assigned Personnel": a.assignedEmployee?.name || "Unassigned",
      Location: a.location,
      ...(permissions.canViewFinancials
        ? {
            "Purchase Cost": a.purchaseCost || 0,
            "Net Book Value": a.netBookValue || 0,
          }
        : {}),
    }));
    const wsAssets = XLSX.utils.json_to_sheet(assetListData);
    XLSX.utils.book_append_sheet(wb, wsAssets, "Inventory Detail");

    const dateStr = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `IT_Asset_Report_${dateStr}.xlsx`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header & Export Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-brand-600" />
            <span>Executive IT Asset Summary Report</span>
          </h2>
          <p className="text-xs text-slate-500">
            Official valuation, deployment status, and compliance tally for {selectedCompanyName}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Excel (.xlsx)</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs flex items-center gap-1.5 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / PDF</span>
          </button>
        </div>
      </div>

      {/* Financial Valuation Report (If permitted) */}
      {permissions.canViewFinancials ? (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Coins className="w-4 h-4 text-emerald-600" />
              <span>Capital Expenditure & Net Book Value Statement</span>
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">Straight-Line Depreciation</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-500 block">Total Historical Acquisition Cost</span>
              <span className="text-2xl font-extrabold text-slate-900 mt-1 block">
                {formatCurrency(stats?.totalPurchaseCost)}
              </span>
            </div>
            <div className="p-4 bg-emerald-50/70 rounded-xl border border-emerald-100">
              <span className="text-xs text-emerald-700 block">Current Total Net Book Value (NBV)</span>
              <span className="text-2xl font-extrabold text-emerald-700 mt-1 block">
                {formatCurrency(stats?.totalNetBookValue)}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 text-center text-xs text-slate-500">
          Financial valuation sections are restricted to Super Admin, Finance, and Auditor roles.
        </div>
      )}

      {/* Entity Comparison Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <Building className="w-4 h-4 text-brand-600" />
            <span>Multi-Company Entity Allocation Breakdown</span>
          </h3>
          <span className="text-xs text-slate-500">{companies.length} Operating Entities</span>
        </div>

        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-100/75 text-slate-600 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
            <tr>
              <th className="py-3 px-4">Entity Code</th>
              <th className="py-3 px-4">Total Assets</th>
              <th className="py-3 px-4">In Use</th>
              <th className="py-3 px-4">Available</th>
              <th className="py-3 px-4">Maintenance</th>
              <th className="py-3 px-4 text-right">Allocation %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(stats?.byCompany || []).map((comp: any) => {
              const compAssets = assets.filter((a) => a.company?.code === comp.code);
              const inUseCount = compAssets.filter((a) => a.status === "IN_USE").length;
              const availableCount = compAssets.filter((a) => a.status === "AVAILABLE").length;
              const maintenanceCount = compAssets.filter((a) => a.status === "MAINTENANCE").length;

              return (
                <tr key={comp.code} className="hover:bg-slate-50/80">
                  <td className="py-3 px-4 font-bold text-slate-900">{comp.code}</td>
                  <td className="py-3 px-4 font-mono font-bold text-slate-800">{comp.count}</td>
                  <td className="py-3 px-4 text-emerald-700 font-medium">{inUseCount}</td>
                  <td className="py-3 px-4 text-blue-700 font-medium">{availableCount}</td>
                  <td className="py-3 px-4 text-amber-700 font-medium">{maintenanceCount}</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-600">
                    {comp.percentage}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Category Breakdown Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <Package className="w-4 h-4 text-brand-600" />
            <span>Hardware Allocation by Category</span>
          </h3>
          <span className="text-xs text-slate-500">{stats?.total || 0} Total Assets</span>
        </div>

        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-100/75 text-slate-600 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
            <tr>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4 text-center">Unit Count</th>
              <th className="py-3 px-4 text-right">Percentage Allocation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(stats?.byCategory || []).map((cat: any) => (
              <tr key={cat.category} className="hover:bg-slate-50/80">
                <td className="py-3 px-4 font-semibold text-slate-800 capitalize">
                  {cat.category.toLowerCase().replace("_", " ")}
                </td>
                <td className="py-3 px-4 text-center font-mono font-bold text-slate-900">
                  {cat.count}
                </td>
                <td className="py-3 px-4 text-right font-mono text-slate-600">
                  {cat.percentage}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
