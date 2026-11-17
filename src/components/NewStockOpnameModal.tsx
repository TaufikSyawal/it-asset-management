"use client";

import React, { useState } from "react";
import { CompanyDTO, AssetCategory, AssetDTO } from "@/types";
import { createStockOpnameSession } from "@/services/stockOpnameService";
import { X, Layers, AlertCircle, CheckCircle2, Building, MapPin, Tag, User } from "lucide-react";

interface NewStockOpnameModalProps {
  isOpen: boolean;
  onClose: () => void;
  companies: CompanyDTO[];
  assets: AssetDTO[];
  currentUserName: string;
  onSuccess: () => void;
}

const CATEGORIES: AssetCategory[] = [
  "LAPTOP",
  "DESKTOP",
  "SERVER",
  "MONITOR",
  "PRINTER",
  "NETWORK_EQUIPMENT",
  "ACCESSORY",
  "OTHER",
];

export default function NewStockOpnameModal({
  isOpen,
  onClose,
  companies,
  assets,
  currentUserName,
  onSuccess,
}: NewStockOpnameModalProps) {
  const [title, setTitle] = useState("");
  const [companyId, setCompanyId] = useState("ALL");
  const [locationScope, setLocationScope] = useState("ALL");
  const [categoryScope, setCategoryScope] = useState("ALL");
  const [conductedBy, setConductedBy] = useState(currentUserName);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Extract unique locations from active assets
  const availableLocations = Array.from(
    new Set(assets.map((a) => a.location).filter(Boolean))
  ).sort();

  // Preview expected asset count based on current filter selections
  const matchingAssets = assets.filter((a) => {
    if (a.isArchived) return false;
    if (companyId !== "ALL" && a.companyId !== companyId) return false;
    if (locationScope !== "ALL" && a.location !== locationScope) return false;
    if (categoryScope !== "ALL" && a.category !== categoryScope) return false;
    return true;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please provide an audit session title.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await createStockOpnameSession({
        title: title.trim(),
        companyId,
        locationScope,
        categoryScope,
        notes: notes.trim() || undefined,
      });

      if (res.error) {
        throw new Error(res.error);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-50 rounded-xl text-brand-600 border border-brand-100">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">New Stock Opname Session</h2>
              <p className="text-xs text-slate-500">
                Initializes an audit scope and captures a permanent snapshot of expected assets
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Session Title */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Audit Session Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q1 2026 Audit - TEL Head Office Floor 4"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
            />
          </div>

          {/* Scope Grid: Company, Location, Category */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Company Scope */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-slate-400" />
                Company
              </label>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="w-full px-2.5 py-2 border border-slate-200 rounded-xl text-xs bg-white"
              >
                <option value="ALL">
                  All Entities {companies.length > 0 ? `(${companies.map((c) => c.code).join("/")})` : ""}
                </option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} - {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Location Scope */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                Location
              </label>
              <select
                value={locationScope}
                onChange={(e) => setLocationScope(e.target.value)}
                className="w-full px-2.5 py-2 border border-slate-200 rounded-xl text-xs bg-white"
              >
                <option value="ALL">All Locations</option>
                {availableLocations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Scope */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-slate-400" />
                Category
              </label>
              <select
                value={categoryScope}
                onChange={(e) => setCategoryScope(e.target.value)}
                className="w-full px-2.5 py-2 border border-slate-200 rounded-xl text-xs bg-white"
              >
                <option value="ALL">All Categories</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Scope Snapshot Preview Card */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="font-semibold text-slate-700">Expected Assets Snapshot</span>
              <p className="text-[11px] text-slate-500">
                Matching assets will be recorded into this session snapshot
              </p>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold font-mono text-brand-600">
                {matchingAssets.length}
              </span>
              <span className="text-[11px] text-slate-500 ml-1">Assets</span>
            </div>
          </div>

          {/* Auditor Name */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-slate-400" />
              Auditor / Lead Inspector
            </label>
            <input
              type="text"
              value={conductedBy}
              onChange={(e) => setConductedBy(e.target.value)}
              placeholder="Full name of auditor"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Audit Notes / Scope Details</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Quarterly compliance check for TEL HQ devices"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || matchingAssets.length === 0}
              className="px-5 py-2 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-50 transition-colors shadow-2xs"
            >
              {loading ? "Initializing..." : `Initialize Session (${matchingAssets.length} Assets)`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

