"use client";

import React from "react";
import { UserRole, CompanyDTO } from "@/types";
import RoleSelector from "./RoleSelector";
import { Plus, Upload, Menu, Building2, Search } from "lucide-react";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import { NavView } from "./Sidebar";

interface TopNavProps {
  activeView: NavView;
  companies: CompanyDTO[];
  selectedCompanyId: string;
  onCompanyChange: (companyId: string) => void;
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  onAddAsset: () => void;
  onOpenImport: () => void;
  onToggleMobileSidebar: () => void;
}

const VIEW_TITLES: Record<NavView, { title: string; subtitle: string }> = {
  management: {
    title: "Management Overview",
    subtitle: "Executive KPI dashboard, financial valuations & entity breakdown",
  },
  operations: {
    title: "IT Operations Overview",
    subtitle: "Daily workflows, device readiness, quick actions & task queues",
  },
  inventory: {
    title: "Asset Inventory",
    subtitle: "Complete repository of corporate hardware and specifications",
  },
  employees: {
    title: "Employees Directory",
    subtitle: "Employee hardware custody across GMD, GMC, and TEL entities",
  },
  assignments: {
    title: "Assignments & Transfers",
    subtitle: "Immutable chronological custody log and BAST documentation",
  },
  stock_opname: {
    title: "Stock Opname Audit",
    subtitle: "Physical hardware reconciliation & QR label scanning sessions",
  },
  maintenance: {
    title: "Maintenance & Diagnostics",
    subtitle: "Devices undergoing repair, diagnostics, or battery replacements",
  },
  reports: {
    title: "Inventory & Financial Reports",
    subtitle: "Capital expenditure summaries, book value reports, and audits",
  },
  settings: {
    title: "System & Governance Settings",
    subtitle: "Database connection status, RBAC policies, and configuration",
  },
};

export default function TopNav({
  activeView,
  companies,
  selectedCompanyId,
  onCompanyChange,
  currentRole,
  onRoleChange,
  onAddAsset,
  onOpenImport,
  onToggleMobileSidebar,
}: TopNavProps) {
  const permissions = ROLE_PERMISSIONS[currentRole];
  const pageMeta = VIEW_TITLES[activeView] || {
    title: "Asset Management",
    subtitle: "Enterprise IT Hardware Operations",
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Left: Mobile Menu & Page Title */}
          <div className="flex items-center gap-3">
            <button
              onClick={onToggleMobileSidebar}
              className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-bold text-base text-slate-900 tracking-tight leading-none">
                {pageMeta.title}
              </h1>
              <p className="text-[11px] text-slate-500 hidden sm:block mt-1 font-medium">
                {pageMeta.subtitle}
              </p>
            </div>
          </div>

          {/* Center: Global Company Filter Switcher */}
          <div className="hidden md:flex items-center bg-slate-100/80 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => onCompanyChange("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedCompanyId === "ALL"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Entities
            </button>
            {companies.map((comp) => (
              <button
                key={comp.id}
                onClick={() => onCompanyChange(comp.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  selectedCompanyId === comp.id
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                <span>{comp.code}</span>
                {comp._count?.assets !== undefined && (
                  <span className="text-[10px] bg-slate-200/80 text-slate-700 font-bold px-1.5 py-0.2 rounded-full">
                    {comp._count.assets}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Right: Role Switcher & Action Buttons */}
          <div className="flex items-center gap-2">
            <RoleSelector currentRole={currentRole} onRoleChange={onRoleChange} />

            {permissions.canImportAssets && (
              <button
                onClick={onOpenImport}
                className="hidden xl:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors"
                title="Batch import inventory from Excel"
              >
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                <span>Import Excel</span>
              </button>
            )}

            {permissions.canCreateAssets && (
              <button
                onClick={onAddAsset}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 active:bg-brand-800 rounded-lg shadow-sm shadow-brand-200 transition-all shrink-0"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span className="hidden sm:inline">Add Asset</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

