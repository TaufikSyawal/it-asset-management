"use client";

import React from "react";
import { AssetDTO, UserRole, CompanyDTO } from "@/types";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import {
  Search,
  Filter,
  Eye,
  Edit2,
  Trash2,
  UserCheck,
  AlertTriangle,
  Laptop,
  Monitor,
  Server,
  Printer,
  Wifi,
  Package,
  Layers,
  ChevronLeft,
  ChevronRight,
  QrCode,
  User,
  MapPin,
} from "lucide-react";

interface AssetTableProps {
  assets: AssetDTO[];
  totalAssets: number;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  search: string;
  onSearchChange: (search: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (category: string) => void;
  duplicateOnly: boolean;
  onDuplicateOnlyChange: (duplicateOnly: boolean) => void;
  currentRole: UserRole;
  companies: CompanyDTO[];
  onViewDetails: (asset: AssetDTO) => void;
  onEditAsset: (asset: AssetDTO) => void;
  onAssignAsset: (asset: AssetDTO) => void;
  onArchiveAsset: (asset: AssetDTO) => void;
  onPrintLabel?: (asset: AssetDTO) => void;
  onPrintBatchLabels?: (assets: AssetDTO[]) => void;
  loading?: boolean;
}

export default function AssetTable({
  assets,
  totalAssets,
  currentPage,
  totalPages,
  onPageChange,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  duplicateOnly,
  onDuplicateOnlyChange,
  currentRole,
  companies,
  onViewDetails,
  onEditAsset,
  onAssignAsset,
  onArchiveAsset,
  onPrintLabel,
  onPrintBatchLabels,
  loading = false,
}: AssetTableProps) {
  const permissions = ROLE_PERMISSIONS[currentRole];

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "LAPTOP":
        return <Laptop className="w-3.5 h-3.5 text-slate-500" />;
      case "DESKTOP":
        return <Monitor className="w-3.5 h-3.5 text-slate-500" />;
      case "SERVER":
        return <Server className="w-3.5 h-3.5 text-slate-500" />;
      case "PRINTER":
        return <Printer className="w-3.5 h-3.5 text-slate-500" />;
      case "NETWORK_EQUIPMENT":
        return <Wifi className="w-3.5 h-3.5 text-slate-500" />;
      default:
        return <Package className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "IN_USE":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            In Use
          </span>
        );
      case "AVAILABLE":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Available
          </span>
        );
      case "MAINTENANCE":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Maintenance
          </span>
        );
      case "DISPOSED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            Disposed
          </span>
        );
      case "ARCHIVED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            Archived
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
            {status}
          </span>
        );
    }
  };

  const getConditionBadge = (condition: string) => {
    switch (condition) {
      case "EXCELLENT":
        return <span className="text-[11px] font-medium text-emerald-700">Excellent</span>;
      case "GOOD":
        return <span className="text-[11px] font-medium text-slate-700">Good</span>;
      case "FAIR":
        return <span className="text-[11px] font-medium text-amber-700">Fair</span>;
      case "POOR":
      case "DAMAGED":
        return <span className="text-[11px] font-medium text-rose-700">Damaged</span>;
      default:
        return <span className="text-[11px] text-slate-500">{condition}</span>;
    }
  };

  const formatCurrency = (val?: number | null) => {
    if (val === undefined || val === null) return "—";
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Controls Bar: Search, Category, Status, Duplicate Toggle */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by tag, name, model, serial, employee, CPU, RAM..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all shadow-2xs"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-brand-500 shadow-2xs cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="IN_USE">In Use</option>
            <option value="AVAILABLE">Available</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="DISPOSED">Disposed</option>
            <option value="ARCHIVED">Archived</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => onCategoryFilterChange(e.target.value)}
            className="px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-brand-500 shadow-2xs cursor-pointer"
          >
            <option value="ALL">All Categories</option>
            <option value="LAPTOP">Laptops</option>
            <option value="DESKTOP">Desktops</option>
            <option value="SERVER">Servers</option>
            <option value="MONITOR">Monitors</option>
            <option value="PRINTER">Printers</option>
            <option value="NETWORK_EQUIPMENT">Networking</option>
          </select>

          {/* Duplicate Tags Quick Filter */}
          <button
            onClick={() => onDuplicateOnlyChange(!duplicateOnly)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              duplicateOnly
                ? "bg-rose-100 text-rose-800 border-rose-300 shadow-2xs"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 shadow-2xs"
            }`}
          >
            <AlertTriangle className={`w-3.5 h-3.5 ${duplicateOnly ? "text-rose-600" : "text-slate-400"}`} />
            <span>Duplicate Tags</span>
          </button>

          {/* Batch Print Labels */}
          {onPrintBatchLabels && (
            <button
              type="button"
              onClick={() => onPrintBatchLabels(assets)}
              className="px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-all shadow-2xs"
              title="Print QR labels for all assets on this page"
            >
              <QrCode className="w-3.5 h-3.5 text-indigo-600" />
              <span>Print Labels</span>
            </button>
          )}
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100/75 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
              <th className="py-3 px-4">Asset Tag</th>
              <th className="py-3 px-4">Name & Specs</th>
              <th className="py-3 px-3">Company</th>
              <th className="py-3 px-4">Serial / Identifiers</th>
              <th className="py-3 px-3">Status</th>
              <th className="py-3 px-3">Condition</th>
              <th className="py-3 px-4">Assigned To</th>
              {permissions.canViewFinancials && (
                <th className="py-3 px-4 text-right">Acquisition</th>
              )}
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={permissions.canViewFinancials ? 9 : 8} className="py-12 text-center text-slate-400">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-brand-500 border-t-transparent" />
                  <p className="mt-2 text-xs">Loading inventory records...</p>
                </td>
              </tr>
            ) : assets.length === 0 ? (
              <tr>
                <td colSpan={permissions.canViewFinancials ? 9 : 8} className="py-12 text-center text-slate-400">
                  <Package className="w-10 h-10 mx-auto text-slate-300 stroke-1" />
                  <p className="mt-2 text-sm font-semibold text-slate-700">No assets found</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Try adjusting your search criteria, company filter, or add a new asset.
                  </p>
                </td>
              </tr>
            ) : (
              assets.map((asset) => (
                <tr
                  key={asset.id}
                  className={`hover:bg-slate-50/80 transition-colors ${
                    asset.isDuplicateTag ? "bg-rose-50/30" : ""
                  }`}
                >
                  {/* Asset Tag */}
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">
                    <div className="flex items-center gap-1.5">
                      <span>{asset.assetTag}</span>
                      {asset.isDuplicateTag && (
                        <span
                          className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-0.5"
                          title="Preserved legacy duplicate Asset Tag. Flagged for review."
                        >
                          <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />
                          Duplicate
                        </span>
                      )}
                    </div>
                    {asset.laptopCode && (
                      <span className="text-[10px] text-slate-400 font-sans block">
                        Code: {asset.laptopCode}
                      </span>
                    )}
                  </td>

                  {/* Name & Specs */}
                  <td className="py-3 px-4">
                    <div className="flex items-start gap-2.5">
                      {asset.primaryPhoto?.thumbnailUrl ? (
                        <div
                          className="relative group cursor-pointer shrink-0 mt-0.5"
                          onClick={() => onViewDetails(asset)}
                          title="Click to view details and photos"
                        >
                          <img
                            src={asset.primaryPhoto.thumbnailUrl}
                            alt={asset.assetName}
                            className="w-9 h-9 rounded-lg object-cover border border-slate-200 shadow-2xs group-hover:ring-2 group-hover:ring-brand-500/50 transition-all"
                            loading="lazy"
                          />
                        </div>
                      ) : (
                        <div className="mt-0.5 p-1.5 rounded-lg bg-slate-100 shrink-0">
                          {getCategoryIcon(asset.category)}
                        </div>
                      )}
                      <div>
                        <span className="font-semibold text-slate-900 block hover:text-brand-600 cursor-pointer" onClick={() => onViewDetails(asset)}>
                          {asset.assetName}
                        </span>
                        <span className="text-slate-500 text-[11px] block">
                          {asset.model} • {asset.cpu} • {asset.ram}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Company */}
                  <td className="py-3 px-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                      {asset.company?.code || "GMD"}
                    </span>
                  </td>

                  {/* Serial / MAC */}
                  <td className="py-3 px-4">
                    {asset.serialNumber ? (
                      <span className="font-mono text-slate-800 text-[11px] font-medium block">
                        {asset.serialNumber}
                      </span>
                    ) : (
                      <span className="text-[10px] italic text-slate-400 px-1.5 py-0.5 bg-slate-100 rounded">
                        Unrecorded S/N
                      </span>
                    )}
                    {asset.macAddress && (
                      <span className="font-mono text-[10px] text-slate-400 block mt-0.5">
                        MAC: {asset.macAddress}
                      </span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="py-3 px-3 whitespace-nowrap">
                    {getStatusBadge(asset.status)}
                  </td>

                  {/* Physical Condition */}
                  <td className="py-3 px-3 whitespace-nowrap">
                    {getConditionBadge(asset.physicalCondition)}
                  </td>

                  {/* Assigned Employee & Location */}
                  <td className="py-3 px-4">
                    {asset.assignedEmployee ? (
                      <div>
                        <span className="font-medium text-slate-900 flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" />
                          {asset.assignedEmployee.name}
                        </span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {asset.location}
                        </span>
                      </div>
                    ) : (
                      <div>
                        <span className="text-slate-400 italic">Unassigned</span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {asset.location}
                        </span>
                      </div>
                    )}
                  </td>

                  {/* Financial (Purchase Cost) */}
                  {permissions.canViewFinancials && (
                    <td className="py-3 px-4 text-right font-medium text-slate-800">
                      {formatCurrency(asset.purchaseCost)}
                      {asset.netBookValue !== undefined && (
                        <span className="text-[10px] text-slate-400 block">
                          NBV: {formatCurrency(asset.netBookValue)}
                        </span>
                      )}
                    </td>
                  )}

                  {/* Actions */}
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      {/* View Details */}
                      <button
                        onClick={() => onViewDetails(asset)}
                        className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title="View Full Specifications & Audit Timeline"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {/* Print QR Label */}
                      {onPrintLabel && (
                        <button
                          onClick={() => onPrintLabel(asset)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Print 50×25mm / 60×40mm QR Label"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                      )}

                      {/* Handover / Assign / Transfer */}
                      {permissions.canAssignAssets && !asset.isArchived && (
                        <button
                          onClick={() => onAssignAsset(asset)}
                          className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Assign, Return, or Transfer Asset"
                        >
                          <UserCheck className="w-4 h-4" />
                        </button>
                      )}

                      {/* Edit */}
                      {(permissions.canEditAssets || permissions.canEditFinancials) && !asset.isArchived && (
                        <button
                          onClick={() => onEditAsset(asset)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit Asset Details"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}

                      {/* Archive */}
                      {permissions.canArchiveAssets && !asset.isArchived && (
                        <button
                          onClick={() => onArchiveAsset(asset)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Archive Asset"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-3 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
        <div>
          Showing <span className="font-semibold text-slate-700">{assets.length}</span> of{" "}
          <span className="font-semibold text-slate-700">{totalAssets}</span> assets
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1 || loading}
            className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-medium text-slate-700">
            Page {currentPage} of {Math.max(1, totalPages)}
          </span>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages || loading}
            className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

