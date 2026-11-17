"use client";

import React, { useState } from "react";
import { EmployeeDTO, AssetDTO, CompanyDTO, UserRole } from "@/types";
import { Users, Building, Laptop, Mail, Search, Plus, UserCheck, X, AlertCircle } from "lucide-react";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import { createEmployee } from "@/services/employeeService";

interface EmployeesViewProps {
  employees: EmployeeDTO[];
  assets: AssetDTO[];
  companies: CompanyDTO[];
  currentRole: UserRole;
  onViewAssetDetails: (asset: AssetDTO) => void;
  onAssignToEmployee: (employeeId: string) => void;
  onRefreshMetadata: () => void;
}

export default function EmployeesView({
  employees,
  assets,
  companies,
  currentRole,
  onViewAssetDetails,
  onAssignToEmployee,
  onRefreshMetadata,
}: EmployeesViewProps) {
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("ALL");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New employee form state
  const [newName, setNewName] = useState("");
  const [newEmpId, setNewEmpId] = useState("");
  const [newCompanyId, setNewCompanyId] = useState(companies[0]?.id || "");
  const [newDept, setNewDept] = useState("Operations");
  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const permissions = ROLE_PERMISSIONS[currentRole];

  const filteredEmployees = employees.filter((emp) => {
    if (companyFilter !== "ALL" && emp.companyId !== companyFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      emp.name.toLowerCase().includes(q) ||
      emp.employeeId.toLowerCase().includes(q) ||
      (emp.department && emp.department.toLowerCase().includes(q)) ||
      (emp.email && emp.email.toLowerCase().includes(q))
    );
  });

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await createEmployee({
        name: newName.trim(),
        employeeId: newEmpId.trim(),
        companyId: newCompanyId,
        department: newDept.trim() || undefined,
        email: newEmail.trim() || undefined,
      });

      if (res.error) {
        throw new Error(res.error);
      }

      setIsAddModalOpen(false);
      setNewName("");
      setNewEmpId("");
      setNewEmail("");
      onRefreshMetadata();
    } catch (err: any) {
      setError(err.message || "Failed to create employee");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-4 h-4 text-brand-600" />
            <span>Personnel & Custody Directory</span>
          </h2>
          <p className="text-xs text-slate-500">
            Employees across GMD, GMC, and TEL entities holding active company hardware
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Company filter */}
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-brand-500 shadow-2xs cursor-pointer"
          >
            <option value="ALL">All Entities</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}
              </option>
            ))}
          </select>

          {/* Search */}
          <div className="relative w-44 sm:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search personnel..."
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500 focus:outline-hidden shadow-2xs"
            />
          </div>

          {/* Add Employee Button (Only for permitted roles) */}
          {permissions.canCreateAssets && (
            <button
              onClick={() => {
                setNewCompanyId(companies[0]?.id || "");
                setIsAddModalOpen(true);
              }}
              className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Employee</span>
            </button>
          )}
        </div>
      </div>

      {/* Employee Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredEmployees.map((emp) => {
          const assignedDevices = assets.filter((a) => a.assignedEmployeeId === emp.id);

          return (
            <div
              key={emp.id}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-bold text-sm text-slate-900 block">{emp.name}</span>
                    <span className="text-[11px] font-mono text-slate-500">{emp.employeeId}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                    {emp.company?.code || "GMD"}
                  </span>
                </div>

                <div className="mt-3 space-y-1 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-slate-400" />
                    <span>{emp.department || "General Operations"}</span>
                  </div>
                  {emp.email && (
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate">{emp.email}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Custody Summary */}
              <div className="mt-4 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Assigned Hardware ({assignedDevices.length})
                  </span>
                  {permissions.canAssignAssets && (
                    <button
                      onClick={() => onAssignToEmployee(emp.id)}
                      className="text-[11px] font-bold text-brand-600 hover:text-brand-800 flex items-center gap-0.5"
                    >
                      <UserCheck className="w-3 h-3" />
                      <span>Assign Device</span>
                    </button>
                  )}
                </div>

                {assignedDevices.length > 0 ? (
                  <div className="space-y-1.5">
                    {assignedDevices.map((dev) => (
                      <div
                        key={dev.id}
                        onClick={() => onViewAssetDetails(dev)}
                        className="p-2 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-100 flex items-center justify-between text-xs cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Laptop className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                          <span className="font-semibold text-slate-800 truncate">{dev.assetName}</span>
                        </div>
                        <span className="font-mono text-[10px] text-slate-500 shrink-0 font-bold">
                          {dev.assetTag}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-slate-400 italic block">No active hardware in custody</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Add New Employee */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-brand-600" />
                <h3 className="font-bold text-sm text-slate-900">Add New Employee</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateEmployee} className="p-6 space-y-3.5 text-xs">
              {error && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Hendra Gunawan"
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Employee ID *</label>
                <input
                  type="text"
                  required
                  value={newEmpId}
                  onChange={(e) => setNewEmpId(e.target.value)}
                  placeholder="e.g. EMP-00109"
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Company Entity *</label>
                <select
                  value={newCompanyId}
                  onChange={(e) => setNewCompanyId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Department</label>
                <input
                  type="text"
                  value={newDept}
                  onChange={(e) => setNewDept(e.target.value)}
                  placeholder="e.g. Finance, Software Lab, Operations"
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Corporate Email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="e.g. hendra.g@company.internal"
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-semibold shadow-2xs disabled:opacity-50"
                >
                  {loading ? "Saving..." : "Add to Directory"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
