"use client";

import React, { useState, useEffect } from "react";
import {
  UserRole,
  UserProfileDTO,
  UserRoleHistoryDTO,
  CompanyDTO,
  EmployeeDTO,
  UserSession,
} from "@/types";
import {
  getUsers,
  updateUserProfile,
  inviteUser,
  resetUserPassword,
  getUserRoleHistory,
} from "@/services/userManagementService";
import {
  Users,
  Shield,
  ShieldCheck,
  Building2,
  Mail,
  UserCheck,
  UserX,
  History,
  KeyRound,
  Edit2,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  X,
  ChevronRight,
  Lock,
} from "lucide-react";

interface UserManagementProps {
  companies: CompanyDTO[];
  employees: EmployeeDTO[];
  currentUser: UserSession | null;
  onRefreshMetadata?: () => void;
}

const ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "MANAGEMENT",
  "IT_ADMIN",
  "FINANCE",
  "AUDITOR",
  "EMPLOYEE",
];

const ROLE_COLORS: Record<UserRole, { bg: string; text: string; border: string }> = {
  SUPER_ADMIN: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  MANAGEMENT: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  IT_ADMIN: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  FINANCE: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  AUDITOR: { bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200" },
  EMPLOYEE: { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200" },
};

export default function UserManagement({
  companies,
  employees,
  currentUser,
  onRefreshMetadata,
}: UserManagementProps) {
  const [users, setUsers] = useState<UserProfileDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modals
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Editing User State
  const [editingUser, setEditingUser] = useState<UserProfileDTO | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("EMPLOYEE");
  const [editAllCompanies, setEditAllCompanies] = useState(false);
  const [editAllowedCompanies, setEditAllowedCompanies] = useState<string[]>([]);
  const [editEmployeeId, setEditEmployeeId] = useState<string>("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);

  // Invite User State
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("EMPLOYEE");
  const [inviteAllCompanies, setInviteAllCompanies] = useState(false);
  const [inviteAllowedCompanies, setInviteAllowedCompanies] = useState<string[]>([]);
  const [sendingInvite, setSendingInvite] = useState(false);

  // History State
  const [historyUser, setHistoryUser] = useState<UserProfileDTO | null>(null);
  const [roleHistory, setRoleHistory] = useState<UserRoleHistoryDTO[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchUserDirectory = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (err: any) {
      console.error("Failed to load users:", err);
      setError(err.message || "Failed to load enterprise user directory.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserDirectory();
  }, []);

  const clearNotifications = () => {
    setTimeout(() => {
      setActionSuccess(null);
      setError(null);
    }, 4000);
  };

  // Filtered directory
  const filteredUsers = users.filter((u) => {
    if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
    if (statusFilter === "ACTIVE" && !u.isActive) return false;
    if (statusFilter === "DEACTIVATED" && u.isActive) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  const activeSuperAdminCount = users.filter((u) => u.role === "SUPER_ADMIN" && u.isActive).length;

  // Handle Edit User
  const handleOpenEdit = (user: UserProfileDTO) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditRole(user.role);
    setEditAllCompanies(user.allCompanies);
    setEditAllowedCompanies([...user.allowedCompanies]);
    setEditEmployeeId(user.employeeId || "");
    setEditIsActive(user.isActive);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    // Safety: check last super admin
    if (editingUser.role === "SUPER_ADMIN" && (editRole !== "SUPER_ADMIN" || !editIsActive)) {
      if (activeSuperAdminCount <= 1) {
        alert("Operation denied: Cannot demote or deactivate the last remaining Super Admin account.");
        return;
      }
    }

    setSavingEdit(true);
    try {
      const res = await updateUserProfile(
        editingUser.id,
        {
          name: editName.trim(),
          role: editRole,
          allCompanies: editAllCompanies,
          allowedCompanies: editAllCompanies ? [] : editAllowedCompanies,
          employeeId: editEmployeeId || null,
          isActive: editIsActive,
        },
        currentUser?.id
      );

      if (!res.success) {
        throw new Error(res.error || "Failed to update profile.");
      }

      setActionSuccess(`User profile for ${editingUser.email} updated successfully.`);
      setIsEditModalOpen(false);
      await fetchUserDirectory();
      if (onRefreshMetadata) onRefreshMetadata();
      clearNotifications();
    } catch (err: any) {
      alert(err.message || "Failed to save profile changes.");
    } finally {
      setSavingEdit(false);
    }
  };

  // Handle Invite / Create User
  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    setSendingInvite(true);
    try {
      const res = await inviteUser({
        email: inviteEmail.trim(),
        name: inviteName.trim() || undefined,
        role: inviteRole,
        allCompanies: inviteAllCompanies,
        allowedCompanies: inviteAllCompanies ? [] : inviteAllowedCompanies,
      });

      if (!res.success) {
        throw new Error(res.error || "Failed to send invitation.");
      }

      setActionSuccess(res.message || `Invitation dispatched to ${inviteEmail}.`);
      setIsInviteModalOpen(false);
      setInviteEmail("");
      setInviteName("");
      setInviteRole("EMPLOYEE");
      setInviteAllCompanies(false);
      setInviteAllowedCompanies([]);
      await fetchUserDirectory();
      clearNotifications();
    } catch (err: any) {
      alert(err.message || "Failed to invite user.");
    } finally {
      setSendingInvite(false);
    }
  };

  // Handle Password Reset
  const handleResetPassword = async (user: UserProfileDTO) => {
    const confirm = window.confirm(
      `Send secure password recovery email to ${user.name} (${user.email})?`
    );
    if (!confirm) return;

    try {
      const res = await resetUserPassword(user.email);
      if (!res.success) {
        throw new Error(res.error || "Failed to initiate reset.");
      }
      setActionSuccess(res.message || `Password recovery email dispatched directly to ${user.email}.`);
      clearNotifications();
    } catch (err: any) {
      alert(`Password reset notice: ${err.message}`);
    }
  };

  // Handle Toggle Active/Deactivated
  const handleToggleActive = async (user: UserProfileDTO) => {
    const isDeactivating = user.isActive;
    if (isDeactivating && user.role === "SUPER_ADMIN" && activeSuperAdminCount <= 1) {
      alert("Operation denied: Cannot deactivate the last remaining Super Admin account.");
      return;
    }

    const actionText = isDeactivating ? "deactivate" : "activate";
    if (!window.confirm(`Are you sure you want to ${actionText} account for ${user.email}?`)) {
      return;
    }

    try {
      const res = await updateUserProfile(
        user.id,
        { isActive: !user.isActive },
        currentUser?.id
      );
      if (!res.success) {
        throw new Error(res.error || `Failed to ${actionText} user.`);
      }

      setActionSuccess(`User account ${user.email} ${isDeactivating ? "deactivated" : "activated"}.`);
      await fetchUserDirectory();
      clearNotifications();
    } catch (err: any) {
      alert(`Status update error: ${err.message}`);
    }
  };

  // Handle View Role History
  const handleOpenHistory = async (user: UserProfileDTO) => {
    setHistoryUser(user);
    setIsHistoryModalOpen(true);
    setLoadingHistory(true);
    try {
      const list = await getUserRoleHistory(user.id);
      setRoleHistory(list);
    } catch (err) {
      console.warn("Failed to load history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const toggleCompanySelection = (code: string, current: string[], setter: (v: string[]) => void) => {
    if (current.includes(code)) {
      setter(current.filter((c) => c !== code));
    } else {
      setter([...current, code]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Notifications */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center justify-between animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Directory Header Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl border border-purple-100">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-900">
                  Enterprise User Directory & Access Governance
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                  {users.length} Registered
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Centralized role assignment, multi-company access scopes, and security policy enforcement
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchUserDirectory}
              disabled={loading}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              title="Refresh directory from database"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>

            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="px-3.5 py-2 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-brand-200 transition-all shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Invite New User</span>
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative w-56 sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, or role..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
              />
            </div>

            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-brand-500 shadow-2xs cursor-pointer"
            >
              <option value="ALL">All Roles ({users.length})</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r} ({users.filter((u) => u.role === r).length})
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-brand-500 shadow-2xs cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="DEACTIVATED">Deactivated Only</option>
            </select>
          </div>

          <div className="text-xs text-slate-400">
            Showing <strong className="text-slate-700">{filteredUsers.length}</strong> of {users.length} accounts
          </div>
        </div>

        {/* User Directory Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-3">Role</th>
                <th className="py-3 px-3">Authorized Scope</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Linked Employee</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-brand-500 border-t-transparent" />
                    <p className="mt-2 text-xs">Loading user profiles...</p>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto text-slate-300 stroke-1" />
                    <p className="mt-2 text-sm font-semibold text-slate-700">No users match your filters</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Adjust your search query or clear role filters.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const roleStyle = ROLE_COLORS[user.role] || ROLE_COLORS.EMPLOYEE;
                  const isCurrent = currentUser?.id === user.id;

                  return (
                    <tr
                      key={user.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        !user.isActive ? "bg-slate-50/60 opacity-75" : ""
                      }`}
                    >
                      {/* Name & Email */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-700 shrink-0">
                            {user.name ? user.name.slice(0, 2).toUpperCase() : user.email.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900">{user.name}</span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-brand-50 text-brand-700 border border-brand-200">
                                  You
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-500 block font-mono">
                              {user.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${roleStyle.bg} ${roleStyle.text} ${roleStyle.border}`}
                        >
                          <ShieldCheck className="w-3 h-3" />
                          <span>{user.role}</span>
                        </span>
                      </td>

                      {/* Company Scope */}
                      <td className="py-3 px-3">
                        {user.allCompanies ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <Building2 className="w-3 h-3 text-emerald-600" />
                            <span>All Entities (GMD, GMC, TEL, RCI)</span>
                          </span>
                        ) : user.allowedCompanies && user.allowedCompanies.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {user.allowedCompanies.map((c) => (
                              <span
                                key={c}
                                className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200 font-mono"
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            Zero Trust (No Entities Granted)
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        {user.isActive ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            <span>Deactivated</span>
                          </span>
                        )}
                      </td>

                      {/* Linked Employee */}
                      <td className="py-3 px-3 text-slate-600">
                        {user.employee ? (
                          <div>
                            <span className="font-semibold block">{user.employee.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {user.employee.employeeId} {user.employee.department ? `• ${user.employee.department}` : ""}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Unlinked</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(user)}
                            className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                            title="Edit role and company permissions"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleResetPassword(user)}
                            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Generate password reset link"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleOpenHistory(user)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="View role and permission change history"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleToggleActive(user)}
                            disabled={user.role === "SUPER_ADMIN" && activeSuperAdminCount <= 1 && user.isActive}
                            className={`p-1.5 rounded-lg transition-colors ${
                              user.isActive
                                ? "text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                : "text-emerald-600 hover:bg-emerald-50"
                            } disabled:opacity-30 disabled:cursor-not-allowed`}
                            title={user.isActive ? "Deactivate account" : "Activate account"}
                          >
                            {user.isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Edit User Role & Permissions */}
      {isEditModalOpen && editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-brand-50 text-brand-600 rounded-lg">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Edit Permissions: {editingUser.name}
                  </h3>
                  <span className="text-[11px] font-mono text-slate-500">{editingUser.email}</span>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 text-xs">
              {editingUser.role === "SUPER_ADMIN" && activeSuperAdminCount <= 1 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Super Admin Protection:</strong> This is the only active Super Admin account. Role demotion and account deactivation are disabled to prevent lockout.
                  </span>
                </div>
              )}

              {/* Display Name */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
                />
              </div>

              {/* User Role */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">System Role</label>
                <select
                  value={editRole}
                  disabled={editingUser.role === "SUPER_ADMIN" && activeSuperAdminCount <= 1}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-brand-500 focus:outline-hidden disabled:opacity-50"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Controls module access, financial data visibility, and system management privileges.
                </p>
              </div>

              {/* Company Permissions */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 block">Grant All Companies Scope</span>
                    <span className="text-[11px] text-slate-500">
                      Unrestricted cross-company access across all current and future entities
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={editAllCompanies}
                    onChange={(e) => setEditAllCompanies(e.target.checked)}
                    className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
                  />
                </div>

                {!editAllCompanies && (
                  <div className="pt-2 border-t border-slate-200/80">
                    <label className="block font-semibold text-slate-700 mb-2">
                      Assign Specific Operating Entities
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {companies.map((c) => {
                        const isChecked = editAllowedCompanies.includes(c.code);
                        return (
                          <label
                            key={c.id}
                            className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                              isChecked
                                ? "bg-brand-50/50 border-brand-300 text-brand-900"
                                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() =>
                                toggleCompanySelection(c.code, editAllowedCompanies, setEditAllowedCompanies)
                              }
                              className="w-3.5 h-3.5 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
                            />
                            <span className="font-bold font-mono">{c.code}</span>
                            <span className="text-[10px] text-slate-400 truncate">({c.name})</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Linked Employee */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Link to Personnel Directory (Optional)
                </label>
                <select
                  value={editEmployeeId}
                  onChange={(e) => setEditEmployeeId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
                >
                  <option value="">-- No Linked Employee --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.employeeId} - {emp.company?.code || "Entity"})
                    </option>
                  ))}
                </select>
              </div>

              {/* Active Account Status */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="font-bold text-slate-800 block">Account Status</span>
                  <span className="text-[11px] text-slate-500">
                    Deactivated accounts immediately lose all authorized data access.
                  </span>
                </div>
                <button
                  type="button"
                  disabled={editingUser.role === "SUPER_ADMIN" && activeSuperAdminCount <= 1 && editIsActive}
                  onClick={() => setEditIsActive(!editIsActive)}
                  className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors disabled:opacity-40 ${
                    editIsActive
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                      : "bg-rose-50 text-rose-800 border-rose-300"
                  }`}
                >
                  {editIsActive ? "Active" : "Deactivated"}
                </button>
              </div>

              {/* Form Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-semibold shadow-2xs transition-colors disabled:opacity-50"
                >
                  {savingEdit ? "Saving Changes..." : "Apply Permissions"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Invite / Add New User */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-brand-50 text-brand-600 rounded-lg">
                  <Mail className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-slate-900">Invite New Platform User</h3>
              </div>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>Mandatory Zero-Trust Provisioning</span>
                </div>
                <p className="text-[11px] text-blue-700 leading-relaxed">
                  All newly invited users automatically receive the baseline <strong>EMPLOYEE</strong> role with <strong>zero company data access</strong>.
                  After inviting the user, you can elevate their role and grant specific operating entities (GMD, GMC, TEL, RCI) at any time through <strong>Edit Permissions</strong>.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Corporate Email Address *</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="e.g. Maya Indah"
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
                />
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingInvite}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-semibold shadow-2xs transition-colors disabled:opacity-50"
                >
                  {sendingInvite ? "Sending Invitation..." : "Send Secure Invitation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: User Role & Permission Change History */}
      {isHistoryModalOpen && historyUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-brand-600" />
                <h3 className="font-bold text-sm text-slate-900">
                  Audit History: {historyUser.name} ({historyUser.email})
                </h3>
              </div>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 max-h-96 overflow-y-auto space-y-3 text-xs">
              {loadingHistory ? (
                <div className="py-8 text-center text-slate-400">
                  <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-brand-500 border-t-transparent" />
                  <p className="mt-2 text-xs">Loading audit history...</p>
                </div>
              ) : roleHistory.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  <p className="font-semibold text-slate-700">No role modifications recorded</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Initial provisioned role: <strong className="font-mono">{historyUser.role}</strong>
                  </p>
                </div>
              ) : (
                roleHistory.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>{new Date(item.createdAt).toLocaleString("id-ID")}</span>
                      <span className="font-mono text-slate-400">{item.changedByName || "Super Admin"}</span>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      {item.oldRole && (
                        <>
                          <span className="px-1.5 py-0.2 rounded font-bold bg-slate-200 text-slate-700">
                            {item.oldRole}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        </>
                      )}
                      <span className="px-1.5 py-0.2 rounded font-bold bg-purple-100 text-purple-800">
                        {item.newRole}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-600">
                      <span>Scope: </span>
                      {item.newAllCompanies ? (
                        <strong className="text-emerald-700">All Entities</strong>
                      ) : (item.newAllowedCompanies || []).length > 0 ? (
                        <strong className="font-mono">{item.newAllowedCompanies.join(", ")}</strong>
                      ) : (
                        <strong className="text-slate-400">None (Zero Trust)</strong>
                      )}
                      <span className="mx-1">•</span>
                      <span>Status: {item.newIsActive ? "Active" : "Deactivated"}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50/50 text-right">
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

