"use client";

import React, { useState } from "react";
import { ArrowRightLeft, UserCheck, CornerDownLeft, RefreshCw, FileText, Calendar, Search } from "lucide-react";

interface AssignmentsViewProps {
  stats: any;
  onViewAssetDetails: (assetId: string) => void;
}

export default function AssignmentsView({ stats, onViewAssetDetails }: AssignmentsViewProps) {
  const [filterType, setFilterType] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  const rawList: any[] = stats?.recentAssignments || [];

  const filteredList = rawList.filter((item) => {
    if (filterType !== "ALL" && item.actionType !== filterType) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (item.asset?.assetTag && item.asset.assetTag.toLowerCase().includes(q)) ||
      (item.asset?.assetName && item.asset.assetName.toLowerCase().includes(q)) ||
      (item.employee?.name && item.employee.name.toLowerCase().includes(q)) ||
      (item.handoverDocRef && item.handoverDocRef.toLowerCase().includes(q))
    );
  });

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("id-ID", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-brand-600" />
            <span>Assignments, Transfers & Handover Log</span>
          </h2>
          <p className="text-xs text-slate-500">
            Immutable custody timeline preserved permanently in PostgreSQL
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Action Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-brand-500 shadow-2xs cursor-pointer"
          >
            <option value="ALL">All Actions</option>
            <option value="ASSIGN">Assignments</option>
            <option value="TRANSFER">Transfers</option>
            <option value="RETURN">Returns</option>
            <option value="REPLACEMENT">Replacements</option>
          </select>

          {/* Search */}
          <div className="relative w-48 sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tag, employee, BAST..."
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500 focus:outline-hidden shadow-2xs"
            />
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100/75 text-slate-600 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Asset Tag & Device</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">Assigned Personnel</th>
                <th className="py-3 px-4">BAST / Handover Ref</th>
                <th className="py-3 px-4">Condition</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                    No assignment or transfer records found matching the filter.
                  </td>
                </tr>
              ) : (
                filteredList.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          item.actionType === "ASSIGN"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : item.actionType === "TRANSFER"
                            ? "bg-blue-100 text-blue-800 border border-blue-200"
                            : item.actionType === "RETURN"
                            ? "bg-amber-100 text-amber-800 border border-amber-200"
                            : "bg-rose-100 text-rose-800 border border-rose-200"
                        }`}
                      >
                        {item.actionType}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        onClick={() => item.asset?.id && onViewAssetDetails(item.asset.id)}
                        className="font-bold text-slate-900 font-mono hover:text-brand-600 cursor-pointer block"
                      >
                        {item.asset?.assetTag}
                      </span>
                      <span className="text-[11px] text-slate-500 block truncate max-w-xs">
                        {item.asset?.assetName}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                        {item.asset?.company?.code || "-"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {item.employee ? (
                        <div>
                          <span className="font-semibold text-slate-800 block">{item.employee.name}</span>
                          <span className="text-[10px] font-mono text-slate-400">{item.employee.employeeId}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Storage Pool (Returned)</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                      {item.handoverDocRef || "—"}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[11px] font-medium text-slate-700">
                        {item.conditionAtAction}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {formatDate(item.assignedAt)}
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px] max-w-xs truncate">
                      {item.notes || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

