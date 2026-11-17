"use client";

import React, { useState } from "react";
import { UserRole, UserSession } from "@/types";
import { Shield, ChevronDown, Check, LogOut, User as UserIcon } from "lucide-react";

interface RoleOption {
  role: UserRole;
  label: string;
  desc: string;
  badgeClass: string;
}

const ROLES: RoleOption[] = [
  {
    role: "SUPER_ADMIN",
    label: "Super Admin",
    desc: "Full permissions: Financials, operations, archive, user management",
    badgeClass: "bg-purple-100 text-purple-800 border-purple-200",
  },
  {
    role: "MANAGEMENT",
    label: "Management",
    desc: "Executive oversight: Portfolio KPIs, financial valuations, multi-entity reports",
    badgeClass: "bg-indigo-100 text-indigo-800 border-indigo-200",
  },
  {
    role: "IT_ADMIN",
    label: "IT Admin",
    desc: "Operational: Add, edit, assign, archive, import (Financials masked)",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-200",
  },
  {
    role: "FINANCE",
    label: "Finance",
    desc: "Financial view & edit (Purchase Cost, Depreciation, NBV)",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  {
    role: "AUDITOR",
    label: "Auditor",
    desc: "Read-only audit: Stock opname reconciliation, asset logs (Financials masked)",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
  },
  {
    role: "EMPLOYEE",
    label: "Employee",
    desc: "Self-service: View own assigned device only",
    badgeClass: "bg-slate-100 text-slate-800 border-slate-200",
  },
];

export default function RoleSelector({
  currentRole,
  onRoleChange,
  authenticatedUser,
  onSignOut,
}: {
  currentRole: UserRole;
  onRoleChange: (newRole: UserRole) => void;
  authenticatedUser?: UserSession | null;
  onSignOut?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const activeOption = ROLES.find((r) => r.role === currentRole) || ROLES[0];

  const handleSelect = async (role: UserRole) => {
    setIsOpen(false);
    try {
      await fetch("/api/auth/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      onRoleChange(role);
    } catch (err) {
      console.error("Failed to switch role:", err);
    }
  };

  // If user is authenticated in production via Supabase Auth
  if (authenticatedUser) {
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 bg-white border border-slate-200 hover:border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 shadow-2xs transition-all"
        >
          <div className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-[10px]">
            {authenticatedUser.name.charAt(0).toUpperCase()}
          </div>
          <div className="text-left hidden sm:block">
            <p className="font-semibold text-slate-800 leading-tight truncate max-w-[120px]">
              {authenticatedUser.name}
            </p>
            <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold border ${activeOption.badgeClass}`}>
              {activeOption.label}
            </span>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute right-0 mt-1.5 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50">
              <div className="px-3.5 py-2 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-900">{authenticatedUser.name}</p>
                <p className="text-[11px] text-slate-500 truncate">{authenticatedUser.email}</p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${activeOption.badgeClass}`}>
                    {activeOption.label}
                  </span>
                  {authenticatedUser.allCompanies ? (
                    <span className="text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">All Entities</span>
                  ) : (
                    <span className="text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                      {authenticatedUser.allowedCompanies?.join(", ") || "Single Entity"}
                    </span>
                  )}
                </div>
              </div>

              {onSignOut && (
                <div className="pt-1 px-1">
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      onSignOut();
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-500" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // Development simulation mode
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-white border border-slate-200 hover:border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-700 shadow-sm transition-all"
        title="Switch active user role for testing permissions"
      >
        <Shield className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-slate-500 font-medium">Role:</span>
        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${activeOption.badgeClass}`}>
          {activeOption.label}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-1.5 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50">
            <div className="px-3 py-2 border-b border-slate-100">
              <p className="text-xs font-semibold text-slate-900">Switch RBAC Role (Testing)</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Simulate permission rules for different company personas
              </p>
            </div>
            <div className="py-1">
              {ROLES.map((item) => {
                const isSelected = item.role === currentRole;
                return (
                  <button
                    key={item.role}
                    onClick={() => handleSelect(item.role)}
                    className={`w-full text-left px-3 py-2 text-xs flex items-start gap-2.5 hover:bg-slate-50 transition-colors ${
                      isSelected ? "bg-slate-50/80" : ""
                    }`}
                  >
                    <div className="mt-0.5">
                      {isSelected ? (
                        <Check className="w-3.5 h-3.5 text-brand-600 font-bold" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border border-slate-300" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">{item.label}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded border font-medium ${item.badgeClass}`}>
                          {item.role}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{item.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
