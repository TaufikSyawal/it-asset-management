"use client";

import React, { useState, useEffect } from "react";
import { AssetDTO, CompanyDTO, EmployeeDTO, UserRole, AssetCategory, AssetStatus, PhysicalCondition, DepreciationMethod } from "@/types";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import { createAsset, updateAsset } from "@/services/assetService";
import { X, Save, AlertCircle, Laptop, Cpu, ShieldAlert } from "lucide-react";

interface AssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  assetToEdit?: AssetDTO | null;
  companies: CompanyDTO[];
  employees: EmployeeDTO[];
  currentRole: UserRole;
  onSuccess: () => void;
}

export default function AssetModal({
  isOpen,
  onClose,
  assetToEdit,
  companies,
  employees,
  currentRole,
  onSuccess,
}: AssetModalProps) {
  const permissions = ROLE_PERMISSIONS[currentRole];
  const isEditing = !!assetToEdit;

  const [formData, setFormData] = useState({
    assetTag: "",
    assetName: "",
    companyId: "",
    category: "LAPTOP" as AssetCategory,
    model: "",
    cpu: "",
    ram: "",
    serialNumber: "",
    macAddress: "",
    status: "AVAILABLE" as AssetStatus,
    physicalCondition: "GOOD" as PhysicalCondition,
    assignedEmployeeId: "",
    location: "Head Office",
    purchaseDate: "",
    purchaseCost: "",
    usefulLifeMonths: "36",
    depreciationMethod: "STRAIGHT_LINE" as DepreciationMethod,
    laptopCode: "",
    laptopAccount: "",
    username: "",
    notes: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (assetToEdit) {
      setFormData({
        assetTag: assetToEdit.assetTag || "",
        assetName: assetToEdit.assetName || "",
        companyId: assetToEdit.companyId || (companies[0]?.id || ""),
        category: assetToEdit.category || "LAPTOP",
        model: assetToEdit.model || "",
        cpu: assetToEdit.cpu || "",
        ram: assetToEdit.ram || "",
        serialNumber: assetToEdit.serialNumber || "",
        macAddress: assetToEdit.macAddress || "",
        status: assetToEdit.status || "AVAILABLE",
        physicalCondition: assetToEdit.physicalCondition || "GOOD",
        assignedEmployeeId: assetToEdit.assignedEmployeeId || "",
        location: assetToEdit.location || "Head Office",
        purchaseDate: assetToEdit.purchaseDate ? assetToEdit.purchaseDate.split("T")[0] : "",
        purchaseCost: assetToEdit.purchaseCost !== undefined && assetToEdit.purchaseCost !== null ? String(assetToEdit.purchaseCost) : "",
        usefulLifeMonths: assetToEdit.usefulLifeMonths ? String(assetToEdit.usefulLifeMonths) : "36",
        depreciationMethod: assetToEdit.depreciationMethod || "STRAIGHT_LINE",
        laptopCode: assetToEdit.laptopCode || "",
        laptopAccount: assetToEdit.laptopAccount || "",
        username: assetToEdit.username || "",
        notes: assetToEdit.notes || "",
      });
    } else {
      // Default new asset
      setFormData({
        assetTag: "",
        assetName: "",
        companyId: companies[0]?.id || "",
        category: "LAPTOP",
        model: "",
        cpu: "",
        ram: "",
        serialNumber: "",
        macAddress: "",
        status: "AVAILABLE",
        physicalCondition: "GOOD",
        assignedEmployeeId: "",
        location: "Head Office",
        purchaseDate: new Date().toISOString().split("T")[0],
        purchaseCost: "",
        usefulLifeMonths: "36",
        depreciationMethod: "STRAIGHT_LINE",
        laptopCode: "",
        laptopAccount: "",
        username: "",
        notes: "",
      });
    }
    setError(null);
  }, [assetToEdit, companies, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        ...formData,
        serialNumber: formData.serialNumber.trim() === "" ? null : formData.serialNumber.trim(),
        macAddress: formData.macAddress.trim() === "" ? null : formData.macAddress.trim(),
        assignedEmployeeId: formData.assignedEmployeeId === "" ? null : formData.assignedEmployeeId,
        purchaseCost: formData.purchaseCost ? parseFloat(formData.purchaseCost) : null,
        usefulLifeMonths: formData.usefulLifeMonths ? parseInt(formData.usefulLifeMonths, 10) : null,
      };

      const result = isEditing && assetToEdit
        ? await updateAsset(assetToEdit.id, payload)
        : await createAsset(payload);

      if (result.error) {
        throw new Error(result.error);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-brand-100 rounded-lg text-brand-700">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">
                {isEditing ? `Edit Asset: ${assetToEdit.assetTag}` : "Register New IT Asset"}
              </h3>
              <p className="text-xs text-slate-500">
                PostgreSQL persistent record • Multi-entity: GMD, GMC, TEL
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Identification */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <span>1. Asset Identification & Entity</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Asset Tag *
                </label>
                <input
                  type="text"
                  required
                  value={formData.assetTag}
                  onChange={(e) => setFormData({ ...formData, assetTag: e.target.value })}
                  placeholder="e.g. GMD-LPT-001"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-medium focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Company Entity *
                </label>
                <select
                  required
                  value={formData.companyId}
                  onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Category *
                </label>
                <select
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as AssetCategory })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
                >
                  <option value="LAPTOP">Laptop</option>
                  <option value="DESKTOP">Desktop</option>
                  <option value="SERVER">Server</option>
                  <option value="MONITOR">Monitor</option>
                  <option value="PRINTER">Printer</option>
                  <option value="NETWORK_EQUIPMENT">Network Equipment</option>
                  <option value="ACCESSORY">Accessory</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Laptop / Barcode
                </label>
                <input
                  type="text"
                  value={formData.laptopCode}
                  onChange={(e) => setFormData({ ...formData, laptopCode: e.target.value })}
                  placeholder="e.g. GMD-DEV-04"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Asset Name / Description *
                </label>
                <input
                  type="text"
                  required
                  value={formData.assetName}
                  onChange={(e) => setFormData({ ...formData, assetName: e.target.value })}
                  placeholder="e.g. ThinkPad T14 Gen 4 / MacBook Pro 16 M3 Max"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Hardware Specifications */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <span>2. Hardware Specifications</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Model / Machine Type *
                </label>
                <input
                  type="text"
                  required
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  placeholder="e.g. 21AH001NUS / A2485"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  CPU / Processor *
                </label>
                <input
                  type="text"
                  required
                  value={formData.cpu}
                  onChange={(e) => setFormData({ ...formData, cpu: e.target.value })}
                  placeholder="e.g. Intel Core i7-1365U / M3 Pro"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  RAM / Memory *
                </label>
                <input
                  type="text"
                  required
                  value={formData.ram}
                  onChange={(e) => setFormData({ ...formData, ram: e.target.value })}
                  placeholder="e.g. 32 GB DDR5"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Serial Number <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.serialNumber}
                  onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                  placeholder="Leave empty if unrecorded"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  MAC Address <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.macAddress}
                  onChange={(e) => setFormData({ ...formData, macAddress: e.target.value })}
                  placeholder="e.g. 3C:52:82:11:45:90"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Physical Condition
                </label>
                <select
                  value={formData.physicalCondition}
                  onChange={(e) => setFormData({ ...formData, physicalCondition: e.target.value as PhysicalCondition })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
                >
                  <option value="EXCELLENT">Excellent (Like New)</option>
                  <option value="GOOD">Good (Normal Wear)</option>
                  <option value="FAIR">Fair (Minor Issues)</option>
                  <option value="POOR">Poor (Needs Attention)</option>
                  <option value="DAMAGED">Damaged / Non-functional</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Status, Location & Assignment */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <span>3. Status & Employee Assignment</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Operational Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as AssetStatus })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
                >
                  <option value="AVAILABLE">Available (In Storage)</option>
                  <option value="IN_USE">In Use (Assigned)</option>
                  <option value="MAINTENANCE">Maintenance / Repair</option>
                  <option value="DISPOSED">Disposed</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assigned Employee
                </label>
                <select
                  value={formData.assignedEmployeeId}
                  onChange={(e) => {
                    const empId = e.target.value;
                    setFormData({
                      ...formData,
                      assignedEmployeeId: empId,
                      status: empId ? "IN_USE" : formData.status === "IN_USE" ? "AVAILABLE" : formData.status,
                    });
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
                >
                  <option value="">— Unassigned (Available in Pool) —</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.employeeId} - {emp.company?.code || "Entity"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Location / Room *
                </label>
                <input
                  type="text"
                  required
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g. HQ Floor 3 - Software Lab"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Machine Account Identifiers (Zero Passwords) */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
              <span>4. System Accounts (Non-sensitive Identifiers)</span>
              <span className="text-[10px] text-amber-600 font-semibold flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" /> No device passwords stored
              </span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Laptop Account / Hostname
                </label>
                <input
                  type="text"
                  value={formData.laptopAccount}
                  onChange={(e) => setFormData({ ...formData, laptopAccount: e.target.value })}
                  placeholder="e.g. LOCAL-ADMIN / GMD-WKS-02"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assigned User Login / Domain Username
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="e.g. sarah.wijaya"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Financial Data (Restricted to Finance & Super Admin) */}
          {permissions.canViewFinancials && (
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center justify-between">
                <span>5. Asset Finance & Depreciation Schema</span>
                <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-semibold">
                  Restricted to Finance
                </span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Purchase Date
                  </label>
                  <input
                    type="date"
                    value={formData.purchaseDate}
                    onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Purchase Cost (IDR)
                  </label>
                  <input
                    type="number"
                    value={formData.purchaseCost}
                    onChange={(e) => setFormData({ ...formData, purchaseCost: e.target.value })}
                    placeholder="e.g. 24500000"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Useful Life (Months)
                  </label>
                  <input
                    type="number"
                    value={formData.usefulLifeMonths}
                    onChange={(e) => setFormData({ ...formData, usefulLifeMonths: e.target.value })}
                    placeholder="e.g. 36 or 48"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Section 6: Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Asset Notes / Remarks
            </label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="e.g. Dual-monitor dock included; charger replacement provided."
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm shadow-brand-200 flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {loading ? "Saving to PostgreSQL..." : isEditing ? "Save Changes" : "Register Asset"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

