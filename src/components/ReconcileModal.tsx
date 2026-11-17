"use client";

import React, { useState } from "react";
import { StockOpnameSessionDTO } from "@/types";
import { X, CheckCircle2, AlertTriangle, ShieldCheck, HelpCircle } from "lucide-react";

interface ReconcileModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: StockOpnameSessionDTO;
  onSuccess: () => void;
}

export default function ReconcileModal({
  isOpen,
  onClose,
  session,
  onSuccess,
}: ReconcileModalProps) {
  const [applyLocationUpdates, setApplyLocationUpdates] = useState(true);
  const [applyConditionUpdates, setApplyConditionUpdates] = useState(true);
  const [markUnscannedAsMissing, setMarkUnscannedAsMissing] = useState(false);
  const [reconciliationNotes, setReconciliationNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const stats = session.stats || {
    totalExpected: 0,
    scannedCount: 0,
    verifiedCount: 0,
    locationMismatchCount: 0,
    userMismatchCount: 0,
    missingCount: 0,
    unexpectedCount: 0,
    duplicateScansCount: 0,
    progressPercentage: 0,
  };

  const handleReconcile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/stock-opname/sessions/${session.id}/reconcile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applyLocationUpdates,
          applyConditionUpdates,
          markUnscannedAsMissing,
          reconciliationNotes: reconciliationNotes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to reconcile audit session");
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
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-100">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Reconcile Stock Opname Inventory</h2>
              <p className="text-xs text-slate-500">
                Session {session.sessionNumber} • {session.title}
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

        {/* Body */}
        <form onSubmit={handleReconcile} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Variance Breakdown Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
            <span className="font-semibold text-slate-800 text-xs block">Audit Discrepancy Findings</span>
            <div className="grid grid-cols-2 gap-2 text-slate-600">
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span>Total Expected:</span>
                <strong className="font-mono text-slate-900">{stats.totalExpected}</strong>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span>Verified Match:</span>
                <strong className="font-mono text-emerald-600">{stats.verifiedCount}</strong>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span>Location Mismatches:</span>
                <strong className="font-mono text-amber-600">{stats.locationMismatchCount}</strong>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span>Assignee Mismatches:</span>
                <strong className="font-mono text-amber-600">{stats.userMismatchCount}</strong>
              </div>
              <div className="flex justify-between items-center py-1">
                <span>Unscanned / Missing:</span>
                <strong className="font-mono text-rose-600">
                  {stats.totalExpected - stats.scannedCount}
                </strong>
              </div>
              <div className="flex justify-between items-center py-1">
                <span>Unexpected Hardware:</span>
                <strong className="font-mono text-indigo-600">{stats.unexpectedCount}</strong>
              </div>
            </div>
          </div>

          {/* Reconciliation Options */}
          <div className="space-y-2.5">
            <span className="font-semibold text-slate-800 block">Inventory Update Actions</span>

            <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={applyLocationUpdates}
                onChange={(e) => setApplyLocationUpdates(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <div>
                <span className="font-semibold text-slate-800 block">
                  Update asset physical location
                </span>
                <p className="text-[11px] text-slate-500">
                  Syncs the verified room/office location into the permanent asset record for all location mismatches.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={applyConditionUpdates}
                onChange={(e) => setApplyConditionUpdates(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <div>
                <span className="font-semibold text-slate-800 block">
                  Update physical condition ratings
                </span>
                <p className="text-[11px] text-slate-500">
                  Records hardware wear or damage observed during the physical audit.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-rose-200 bg-rose-50/40 hover:bg-rose-50 cursor-pointer">
              <input
                type="checkbox"
                checked={markUnscannedAsMissing}
                onChange={(e) => setMarkUnscannedAsMissing(e.target.checked)}
                className="mt-0.5 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
              />
              <div>
                <span className="font-semibold text-rose-900 block">
                  Mark unscanned assets as MISSING
                </span>
                <p className="text-[11px] text-rose-700">
                  Updates status to MISSING for {stats.totalExpected - stats.scannedCount} assets that were not scanned.
                </p>
              </div>
            </label>
          </div>

          {/* Closure Notes */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Auditor Reconciliation Sign-Off Notes
            </label>
            <textarea
              rows={2}
              value={reconciliationNotes}
              onChange={(e) => setReconciliationNotes(e.target.value)}
              placeholder="e.g. Audit approved. Discrepancies verified with floor managers."
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
            />
          </div>

          {/* Footer Actions */}
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
              disabled={loading}
              className="px-5 py-2 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-2xs inline-flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              {loading ? "Reconciling..." : "Approve & Reconcile"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

