"use client";

import React, { useState, useEffect } from "react";
import { UserRole, CompanyDTO } from "@/types";
import {
  Settings,
  Database,
  ShieldCheck,
  RefreshCw,
  Terminal,
  CheckCircle2,
  Cloud,
  Building2,
  Plus,
  Edit2,
  Power,
  X,
  AlertCircle,
} from "lucide-react";
import RoleSelector from "@/components/RoleSelector";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import {
  getCompanies,
  createCompany,
  updateCompany,
  toggleCompanyStatus,
} from "@/services/companyService";
import { ROLE_PERMISSIONS } from "@/lib/permissions";

interface SettingsViewProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  companies: CompanyDTO[];
  onRefreshCompanies?: () => void;
}

export default function SettingsView({
  currentRole,
  onRoleChange,
  companies,
  onRefreshCompanies,
}: SettingsViewProps) {
  const [healthData, setHealthData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const isCloud = isSupabaseConfigured();

  // Dynamic Company Management State
  const [allCompanies, setAllCompanies] = useState<CompanyDTO[]>(companies);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyDTO | null>(null);
  const [modalCode, setModalCode] = useState("");
  const [modalName, setModalName] = useState("");
  const [modalDescription, setModalDescription] = useState("");
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const permissions = ROLE_PERMISSIONS[currentRole];
  const canManageCompanies = permissions?.canManageCompanies ?? (currentRole === "SUPER_ADMIN");

  const checkHealth = async () => {
    setLoading(true);

    if (isCloud) {
      try {
        const { count, error } = await supabase
          .from("assets_view")
          .select("id", { count: "exact", head: true })
          .eq("is_archived", false);

        setHealthData({
          connected: !error,
          type: "supabase",
          assetCount: count || 0,
          error: error?.message,
        });
      } catch (err: any) {
        setHealthData({
          connected: false,
          type: "supabase",
          error: err.message,
        });
      } finally {
        setLoading(false);
      }
      return;
    }

    // Local dev health check
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      setHealthData({
        ...data,
        type: "local",
      });
    } catch (err: any) {
      setHealthData({ connected: false, type: "local", error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const loadAllCompanies = async () => {
    setLoadingCompanies(true);
    try {
      const data = await getCompanies(true); // Include inactive companies
      setAllCompanies(data);
    } catch (err) {
      console.error("Failed to load company entities:", err);
    } finally {
      setLoadingCompanies(false);
    }
  };

  useEffect(() => {
    checkHealth();
    loadAllCompanies();
  }, []);

  const openAddModal = () => {
    setEditingCompany(null);
    setModalCode("");
    setModalName("");
    setModalDescription("");
    setModalError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (comp: CompanyDTO) => {
    setEditingCompany(comp);
    setModalCode(comp.code);
    setModalName(comp.name);
    setModalDescription(comp.description || "");
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalSaving(true);
    setModalError(null);

    try {
      if (editingCompany) {
        await updateCompany(editingCompany.id, {
          name: modalName,
          description: modalDescription,
        });
      } else {
        await createCompany({
          code: modalCode,
          name: modalName,
          description: modalDescription,
        });
      }

      setIsModalOpen(false);
      await loadAllCompanies();
      if (onRefreshCompanies) {
        onRefreshCompanies();
      }
    } catch (err: any) {
      setModalError(err.message || "Failed to save company record");
    } finally {
      setModalSaving(false);
    }
  };

  const handleToggleStatus = async (comp: CompanyDTO) => {
    const newStatus = !(comp.isActive ?? comp.is_active ?? true);
    const actionLabel = newStatus ? "activate" : "deactivate";

    if (
      !confirm(
        `Are you sure you want to ${actionLabel} company entity "${comp.code} - ${comp.name}"?`
      )
    ) {
      return;
    }

    try {
      await toggleCompanyStatus(comp.id, newStatus);
      await loadAllCompanies();
      if (onRefreshCompanies) {
        onRefreshCompanies();
      }
    } catch (err: any) {
      alert(`Failed to ${actionLabel} company: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150 max-w-4xl">
      {/* Header */}
      <div className="pb-2 border-b border-slate-200">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <Settings className="w-4 h-4 text-brand-600" />
          <span>System & Governance Settings</span>
        </h2>
        <p className="text-xs text-slate-500">
          Database connectivity diagnostics, multi-entity tenant scopes, and RBAC governance
        </p>
      </div>

      {/* Database Diagnostic Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              {isCloud ? <Cloud className="w-5 h-5" /> : <Database className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                {isCloud ? "Supabase Cloud PostgreSQL" : "Local Development Database"}
              </h3>
              <p className="text-[11px] text-slate-500">
                {isCloud
                  ? "Managed PostgreSQL 17 • Row Level Security & Private Storage"
                  : "Prisma ORM engine & live schema on localhost"}
              </p>
            </div>
          </div>

          <button
            onClick={checkHealth}
            disabled={loading}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Test Connection</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-400 block text-[11px]">Connection Status</span>
            {healthData?.connected ? (
              <span className="font-bold text-emerald-600 flex items-center gap-1 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Active & Persistent
              </span>
            ) : (
              <span className="font-bold text-rose-600">Disconnected</span>
            )}
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-400 block text-[11px]">Backend Architecture</span>
            <span className="font-bold text-slate-800 mt-0.5 block">
              {isCloud ? "Supabase Free Tier ($0/mo)" : "PostgreSQL 16 Local"}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-400 block text-[11px]">Active Entities</span>
            <span className="font-bold text-slate-800 mt-0.5 block truncate">
              {companies.map((c) => c.code).join(" • ")} ({companies.length} Active)
            </span>
          </div>
        </div>

        {isCloud ? (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-800">Supabase Free Tier Compliance Policy:</p>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Target monthly cost: <strong>$0.00 / month</strong>. Database quota: 500 MB. Storage quota: 1 GB (Canvas client-side WebP optimization fits 12,000+ asset photos). Bandwidth egress: 2 GB/mo.
            </p>
          </div>
        ) : healthData?.databaseUrl ? (
          <div className="p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px] flex items-center gap-2 overflow-x-auto">
            <Terminal className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>DATABASE_URL: {healthData.databaseUrl}</span>
          </div>
        ) : null}
      </div>

      {/* Enterprise Company Entity Management Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-brand-50 text-brand-600 rounded-lg">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                  Enterprise Company Management
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-50 text-brand-700 border border-brand-200">
                  {allCompanies.filter((c) => c.isActive !== false && c.is_active !== false).length} Active Entities
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Manage organizational entities (GMD, GMC, TEL, RCI) and provision new operating units dynamically
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadAllCompanies}
              disabled={loadingCompanies}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Refresh entities"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingCompanies ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {canManageCompanies && (
              <button
                onClick={openAddModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white rounded-lg text-xs font-semibold shadow-2xs transition-all shrink-0"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Register Entity</span>
              </button>
            )}
          </div>
        </div>

        {/* Company Table */}
        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Code</th>
                <th className="py-2.5 px-3">Company Name</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3">Hardware Assets</th>
                <th className="py-2.5 px-3">Personnel</th>
                <th className="py-2.5 px-3">Status</th>
                {canManageCompanies && <th className="py-2.5 px-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allCompanies.length === 0 ? (
                <tr>
                  <td
                    colSpan={canManageCompanies ? 7 : 6}
                    className="py-6 text-center text-slate-400 italic"
                  >
                    No company entities configured.
                  </td>
                </tr>
              ) : (
                allCompanies.map((comp) => {
                  const isActive = comp.isActive !== false && comp.is_active !== false;
                  return (
                    <tr
                      key={comp.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        !isActive ? "opacity-60 bg-slate-50/30" : ""
                      }`}
                    >
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-brand-50 text-brand-700 border border-brand-200">
                          {comp.code}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{comp.name}</td>
                      <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate">
                        {comp.description || "-"}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        {comp._count?.assets ?? 0}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{comp._count?.employees ?? 0}</td>
                      <td className="py-2.5 px-3">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            Inactive
                          </span>
                        )}
                      </td>
                      {canManageCompanies && (
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openEditModal(comp)}
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Edit entity"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleToggleStatus(comp)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                isActive
                                  ? "text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                  : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                              }`}
                              title={isActive ? "Deactivate entity" : "Activate entity"}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-slate-400">
          All company filters, QR labels, asset records, stock opname audits, and employee directories dynamically synchronize with these entities without requiring software code deployments.
        </p>
      </div>

      {/* RBAC Role Governance Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                Active Role-Based Access Control (RBAC) Persona
              </h3>
              <p className="text-[11px] text-slate-500">
                Simulate permission enforcement, multi-company filtering, and financial masking
              </p>
            </div>
          </div>

          <RoleSelector currentRole={currentRole} onRoleChange={onRoleChange} />
        </div>

        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 space-y-1">
          <p>
            Current active persona: <strong className="text-slate-900">{currentRole}</strong>
          </p>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Financial capital and net book values are automatically masked at the database level for IT Admin, Auditor, and Employee roles, while being fully visible to Super Admin, Management, and Finance. Company management is strictly restricted to Super Admin.
          </p>
        </div>
      </div>

      {/* Modal for Add / Edit Company */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-brand-50 text-brand-600 rounded-lg">
                  <Building2 className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-slate-900">
                  {editingCompany ? `Edit Entity: ${editingCompany.code}` : "Register New Entity"}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCompany} className="p-5 space-y-4">
              {modalError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Entity Code * (e.g. GMD, GMC, TEL, RCI)
                </label>
                <input
                  type="text"
                  required
                  disabled={!!editingCompany}
                  value={modalCode}
                  onChange={(e) => setModalCode(e.target.value.toUpperCase())}
                  placeholder="e.g. RCI"
                  maxLength={10}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold tracking-wider text-slate-900 focus:ring-2 focus:ring-brand-500 focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-500"
                />
                <span className="text-[10px] text-slate-400 block mt-1">
                  Permanent unique abbreviation for asset tags and QR codes
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Legal / Company Name *
                </label>
                <input
                  type="text"
                  required
                  value={modalName}
                  onChange={(e) => setModalName(e.target.value)}
                  placeholder="e.g. RCI"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description / Operational Notes
                </label>
                <textarea
                  value={modalDescription}
                  onChange={(e) => setModalDescription(e.target.value)}
                  placeholder="e.g. Resource & Commercial Infrastructure division"
                  rows={3}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:ring-2 focus:ring-brand-500 focus:outline-hidden resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSaving}
                  className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                >
                  {modalSaving ? "Saving..." : editingCompany ? "Update Entity" : "Register Entity"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
