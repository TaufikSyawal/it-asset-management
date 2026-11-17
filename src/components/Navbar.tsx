"use client";

import React from "react";
import { UserRole, CompanyDTO } from "@/types";
import RoleSelector from "./RoleSelector";
import { Building2, Laptop, Plus, Upload, Filter } from "lucide-react";
import { ROLE_PERMISSIONS } from "@/lib/permissions";

interface NavbarProps {
  companies: CompanyDTO[];
  selectedCompanyId: string;
  onCompanyChange: (companyId: string) => void;
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  onAddAsset: () => void;
  onOpenImport: () => void;
}

export default function Navbar({
  companies,
  selectedCompanyId,
  onCompanyChange,
  currentRole,
  onRoleChange,
  onAddAsset,
  onOpenImport,
}: NavbarProps) {
  const permissions = ROLE_PERMISSIONS[currentRole];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Brand & Multi-Company Badge */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-sm shadow-brand-200">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-slate-900 tracking-tight">
                  IT Asset Inventory
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  GMD • GMC • TEL • RCI
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Hardware lifecycle, assignments, and audit management
              </p>
            </div>
          </div>

          {/* Company Filter Tabs */}
          <div className="hidden lg:flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80">
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
                {comp.code}
                {comp._count?.assets !== undefined && (
                  <span className="text-[10px] bg-slate-200/70 text-slate-700 px-1.5 py-0.2 rounded-full">
                    {comp._count.assets}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Right Controls: Role Switcher & Action Buttons */}
          <div className="flex items-center gap-2.5">
            <RoleSelector currentRole={currentRole} onRoleChange={onRoleChange} />

            {permissions.canImportAssets && (
              <button
                onClick={onOpenImport}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors"
                title="Batch import inventory from Excel"
              >
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                Import Excel
              </button>
            )}

            {permissions.canCreateAssets && (
              <button
                onClick={onAddAsset}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 active:bg-brand-800 rounded-lg shadow-sm shadow-brand-200 transition-all"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                Add Asset
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

