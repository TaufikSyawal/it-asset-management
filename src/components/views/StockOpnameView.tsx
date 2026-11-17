"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AssetDTO, CompanyDTO, UserRole, StockOpnameSessionDTO, StockOpnameItemDTO, PhysicalCondition } from "@/types";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import {
  getStockOpnameSessions,
  getStockOpnameSessionDetails,
  recordScan,
  deleteStockOpnameSession,
  exportStockOpnameToExcel,
} from "@/services/stockOpnameService";
import { parseQRScanInput } from "@/lib/qrcode";
import QRCameraScanner from "@/components/QRCameraScanner";
import NewStockOpnameModal from "@/components/NewStockOpnameModal";
import ReconcileModal from "@/components/ReconcileModal";
import {
  QrCode,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Printer,
  Plus,
  ArrowLeft,
  Download,
  AlertTriangle,
  MapPin,
  Building,
  User,
  Filter,
  Layers,
  Search,
  RefreshCw,
  Trash2,
  Check,
  AlertCircle,
  HelpCircle,
} from "lucide-react";

interface StockOpnameViewProps {
  assets: AssetDTO[];
  companies: CompanyDTO[];
  currentRole: UserRole;
  currentUserName?: string;
  onViewDetails: (asset: AssetDTO) => void;
  onOpenLabelModal: (assets: AssetDTO[]) => void;
}

export default function StockOpnameView({
  assets,
  companies,
  currentRole,
  currentUserName = "IT Auditor",
  onViewDetails,
  onOpenLabelModal,
}: StockOpnameViewProps) {
  const permissions = ROLE_PERMISSIONS[currentRole];

  // Sessions state
  const [sessions, setSessions] = useState<StockOpnameSessionDTO[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<StockOpnameSessionDTO | null>(null);
  const [loadingActiveSession, setLoadingActiveSession] = useState(false);

  // Modals state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isReconcileModalOpen, setIsReconcileModalOpen] = useState(false);

  // Active Session Filter & Scan Controls
  const [itemTab, setItemTab] = useState<"ALL" | "VERIFIED" | "LOCATION_MISMATCH" | "USER_MISMATCH" | "MISSING" | "UNEXPECTED">("ALL");
  const [itemSearch, setItemSearch] = useState("");
  const [currentScanLocation, setCurrentScanLocation] = useState<string>("");
  const [currentScanCondition, setCurrentScanCondition] = useState<PhysicalCondition>("GOOD");

  // Fetch all sessions
  const fetchSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const list = await getStockOpnameSessions();
      setSessions(list || []);
    } catch (err) {
      console.error("Error loading Stock Opname sessions:", err);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  // Fetch single active session detail
  const fetchActiveSession = useCallback(async (id: string) => {
    setLoadingActiveSession(true);
    try {
      const session = await getStockOpnameSessionDetails(id);
      if (session) {
        setActiveSession(session);
        if (session.locationScope && session.locationScope !== "ALL" && !currentScanLocation) {
          setCurrentScanLocation(session.locationScope);
        }
      }
    } catch (err) {
      console.error("Error loading active session details:", err);
    } finally {
      setLoadingActiveSession(false);
    }
  }, [currentScanLocation]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    if (activeSessionId) {
      fetchActiveSession(activeSessionId);
    } else {
      setActiveSession(null);
    }
  }, [activeSessionId, fetchActiveSession]);

  // Handle Scan Submission
  const handleScanSubmit = async (scannedRaw: string, isOfflineSync?: boolean) => {
    if (!activeSessionId) return { success: false, message: "No active session selected" };

    try {
      const parsed = parseQRScanInput(scannedRaw);
      let targetAssetId = parsed.assetId;

      if (!targetAssetId) {
        const tagToMatch = (parsed.assetTag || scannedRaw).trim().toLowerCase();
        const matched = assets.find(
          (a) =>
            a.id === scannedRaw.trim() ||
            a.assetTag.toLowerCase() === tagToMatch ||
            (a.serialNumber && a.serialNumber.toLowerCase() === scannedRaw.trim().toLowerCase())
        );
        if (matched) {
          targetAssetId = matched.id;
        }
      }

      if (!targetAssetId) {
        targetAssetId = scannedRaw.trim();
      }

      const res = await recordScan(activeSessionId, targetAssetId, {
        location: currentScanLocation || "HQ",
        condition: currentScanCondition,
        notes: `Scanned by ${currentUserName}`,
      });

      if (res.error) {
        return {
          success: false,
          message: res.error,
        };
      }

      fetchActiveSession(activeSessionId);
      return {
        success: true,
        message: res.isOffline
          ? "Scan queued in offline storage."
          : `Scanned: ${targetAssetId}`,
      };
    } catch (err: any) {
      return { success: false, message: err.message || "Failed to communicate with audit server" };
    }
  };

  // Delete an in-progress session
  const handleDeleteSession = async (session: StockOpnameSessionDTO, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete audit session ${session.sessionNumber} (${session.title})?`)) return;

    const res = await deleteStockOpnameSession(session.id);
    if (res.success) {
      if (activeSessionId === session.id) setActiveSessionId(null);
      fetchSessions();
    } else {
      alert(res.error || "Failed to delete session");
    }
  };

  // Unique locations from assets
  const availableLocations = Array.from(new Set(assets.map((a) => a.location).filter(Boolean))).sort();

  // -------------------------------------------------------------
  // VIEW: ACTIVE SESSION DETAIL
  // -------------------------------------------------------------
  if (activeSessionId && activeSession) {
    const stats = activeSession.stats || {
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

    // Filter items according to tab & search
    const filteredItems = (activeSession.items || []).filter((item) => {
      // Tab filter
      if (itemTab === "VERIFIED" && item.verificationStatus !== "VERIFIED") return false;
      if (itemTab === "LOCATION_MISMATCH" && item.verificationStatus !== "MISMATCH_LOCATION") return false;
      if (itemTab === "USER_MISMATCH" && item.verificationStatus !== "MISMATCH_USER") return false;
      if (itemTab === "MISSING" && item.verificationStatus !== "MISSING" && !(activeSession.status === "COMPLETED" && item.verificationStatus === "PENDING")) return false;
      if (itemTab === "UNEXPECTED" && !item.isUnexpected) return false;

      // Search filter
      if (!itemSearch) return true;
      const q = itemSearch.toLowerCase();
      return (
        item.asset.assetTag.toLowerCase().includes(q) ||
        item.asset.assetName.toLowerCase().includes(q) ||
        (item.asset.serialNumber && item.asset.serialNumber.toLowerCase().includes(q)) ||
        (item.discrepancyNotes && item.discrepancyNotes.toLowerCase().includes(q))
      );
    });

    const isCompleted = activeSession.status === "COMPLETED";

    return (
      <div className="space-y-6 animate-in fade-in duration-150">
        {/* Top Breadcrumb & Control Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveSessionId(null)}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 transition-colors shadow-2xs"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-900 text-white">
                  {activeSession.sessionNumber}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    isCompleted
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-blue-100 text-blue-800"
                  }`}
                >
                  {activeSession.status}
                </span>
                {activeSession.company && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                    Entity: {activeSession.company.code}
                  </span>
                )}
              </div>
              <h2 className="text-base font-bold text-slate-900 mt-1">{activeSession.title}</h2>
              <p className="text-xs text-slate-500">
                Auditor: <strong>{activeSession.conductedBy || currentUserName}</strong> • Scope:{" "}
                {activeSession.locationScope || "All Locations"} • {activeSession.categoryScope || "All Categories"}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const sessionAssets = (activeSession.items || []).map((i) => i.asset);
                onOpenLabelModal(sessionAssets);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              Print QR Labels
            </button>

            <button
              type="button"
              onClick={() => exportStockOpnameToExcel(activeSession.id)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              Export Excel
            </button>

            {!isCompleted && permissions.canReconcileStockOpname && (
              <button
                type="button"
                onClick={() => setIsReconcileModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-2xs"
              >
                <ShieldCheck className="w-4 h-4" />
                Reconcile Inventory
              </button>
            )}
          </div>
        </div>

        {/* Progress & Discrepancy KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-tight block">
              Audit Progress
            </span>
            <div className="text-lg font-bold font-mono text-brand-600 mt-1">
              {stats.progressPercentage}%
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1.5 overflow-hidden">
              <div
                className="bg-brand-600 h-1.5 rounded-full transition-all"
                style={{ width: `${stats.progressPercentage}%` }}
              />
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-tight block">
              Expected
            </span>
            <div className="text-lg font-bold font-mono text-slate-800 mt-1">{stats.totalExpected}</div>
            <span className="text-[10px] text-slate-400">Snapshot scope</span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-tight block">
              Scanned
            </span>
            <div className="text-lg font-bold font-mono text-blue-600 mt-1">{stats.scannedCount}</div>
            <span className="text-[10px] text-slate-400">Physical scans</span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-2xs">
            <span className="text-[10px] font-semibold text-emerald-700 uppercase tracking-tight block">
              Verified
            </span>
            <div className="text-lg font-bold font-mono text-emerald-600 mt-1">{stats.verifiedCount}</div>
            <span className="text-[10px] text-emerald-600/80">Matched 100%</span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-amber-200 bg-amber-50/20 shadow-2xs">
            <span className="text-[10px] font-semibold text-amber-700 uppercase tracking-tight block">
              Location Diff
            </span>
            <div className="text-lg font-bold font-mono text-amber-600 mt-1">
              {stats.locationMismatchCount}
            </div>
            <span className="text-[10px] text-amber-600/80">Room mismatch</span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-amber-200 bg-amber-50/20 shadow-2xs">
            <span className="text-[10px] font-semibold text-amber-700 uppercase tracking-tight block">
              User Diff
            </span>
            <div className="text-lg font-bold font-mono text-amber-600 mt-1">{stats.userMismatchCount}</div>
            <span className="text-[10px] text-amber-600/80">Custodian diff</span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-rose-200 bg-rose-50/20 shadow-2xs">
            <span className="text-[10px] font-semibold text-rose-700 uppercase tracking-tight block">
              Missing
            </span>
            <div className="text-lg font-bold font-mono text-rose-600 mt-1">
              {stats.totalExpected - stats.scannedCount}
            </div>
            <span className="text-[10px] text-rose-600/80">Unscanned</span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-indigo-200 bg-indigo-50/20 shadow-2xs">
            <span className="text-[10px] font-semibold text-indigo-700 uppercase tracking-tight block">
              Unexpected
            </span>
            <div className="text-lg font-bold font-mono text-indigo-600 mt-1">{stats.unexpectedCount}</div>
            <span className="text-[10px] text-indigo-600/80">Extra found</span>
          </div>
        </div>

        {/* Live Scanner Dock & Configuration */}
        {!isCompleted && (
          <div className="space-y-3">
            {/* Auditor Field Configuration Banner */}
            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  <span className="font-semibold text-slate-700">Scan Location:</span>
                  <input
                    type="text"
                    value={currentScanLocation}
                    onChange={(e) => setCurrentScanLocation(e.target.value)}
                    placeholder="e.g. Floor 4 Server Room"
                    className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-700">Observed Condition:</span>
                  <select
                    value={currentScanCondition}
                    onChange={(e) => setCurrentScanCondition(e.target.value as PhysicalCondition)}
                    className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="EXCELLENT">EXCELLENT</option>
                    <option value="GOOD">GOOD</option>
                    <option value="FAIR">FAIR</option>
                    <option value="POOR">POOR</option>
                    <option value="DAMAGED">DAMAGED</option>
                  </select>
                </div>
              </div>

              <div className="text-[11px] text-slate-500">
                Auditing as: <strong className="text-slate-800">{activeSession.conductedBy || currentUserName}</strong>
              </div>
            </div>

            {/* Camera & Barcode Scanner Component */}
            <QRCameraScanner
              onScan={handleScanSubmit}
              activeSessionId={activeSession.id}
              defaultLocation={currentScanLocation}
              placeholder="Scan QR or enter Asset Tag (e.g. GMD-NB-001) / Serial / Asset ID..."
            />
          </div>
        )}

        {/* Audit Discrepancy Matrix Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Tabs & Search */}
          <div className="p-3.5 sm:p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => setItemTab("ALL")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  itemTab === "ALL"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                All Scope ({activeSession.items?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setItemTab("VERIFIED")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  itemTab === "VERIFIED"
                    ? "bg-emerald-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Verified ({stats.verifiedCount})
              </button>
              <button
                type="button"
                onClick={() => setItemTab("LOCATION_MISMATCH")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  itemTab === "LOCATION_MISMATCH"
                    ? "bg-amber-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Location Diff ({stats.locationMismatchCount})
              </button>
              <button
                type="button"
                onClick={() => setItemTab("USER_MISMATCH")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  itemTab === "USER_MISMATCH"
                    ? "bg-amber-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                User Diff ({stats.userMismatchCount})
              </button>
              <button
                type="button"
                onClick={() => setItemTab("MISSING")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  itemTab === "MISSING"
                    ? "bg-rose-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Missing ({stats.totalExpected - stats.scannedCount})
              </button>
              <button
                type="button"
                onClick={() => setItemTab("UNEXPECTED")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  itemTab === "UNEXPECTED"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Unexpected ({stats.unexpectedCount})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder="Search audit items..."
                className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Asset Tag</th>
                  <th className="py-2.5 px-3">Device & Entity</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Location (Expected vs Actual)</th>
                  <th className="py-2.5 px-3">Custodian</th>
                  <th className="py-2.5 px-3">Condition</th>
                  <th className="py-2.5 px-3">Audit Details</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                      No audit items found matching the selected tab and filters.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const isLocationDiff = item.verificationStatus === "MISMATCH_LOCATION";
                    const isUserDiff = item.verificationStatus === "MISMATCH_USER";
                    const isMissing = item.verificationStatus === "MISSING" || (!item.scannedAt && isCompleted);
                    const isVerified = item.verificationStatus === "VERIFIED";

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Asset Tag */}
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          <div>{item.asset.assetTag}</div>
                          {item.scanCount > 1 && (
                            <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                              Scanned {item.scanCount}x
                            </span>
                          )}
                        </td>

                        {/* Device & Entity */}
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-slate-800">{item.asset.assetName}</div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <span className="font-bold text-slate-700">{item.asset.company.code}</span>
                            <span>•</span>
                            <span>{item.asset.category}</span>
                            <span>•</span>
                            <span>SN: {item.asset.serialNumber || "N/A"}</span>
                          </div>
                        </td>

                        {/* Verification Status Badge */}
                        <td className="py-2.5 px-3">
                          {isVerified ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Verified
                            </span>
                          ) : isLocationDiff ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                              Location Diff
                            </span>
                          ) : isUserDiff ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                              Assignee Diff
                            </span>
                          ) : item.isUnexpected ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                              <Layers className="w-3.5 h-3.5 text-indigo-600" />
                              Unexpected
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              Pending
                            </span>
                          )}
                        </td>

                        {/* Location */}
                        <td className="py-2.5 px-3">
                          <div className="space-y-0.5">
                            <div className="text-[11px] text-slate-500">
                              Exp: <span className="font-medium text-slate-700">{item.expectedLocation || "N/A"}</span>
                            </div>
                            {item.scannedAt && (
                              <div
                                className={`text-[11px] font-medium ${
                                  isLocationDiff ? "text-amber-700 font-semibold" : "text-slate-800"
                                }`}
                              >
                                Act: {item.actualLocation || "Same"}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Custodian */}
                        <td className="py-2.5 px-3">
                          <div className="text-slate-700 font-medium">
                            {item.asset.assignedEmployee?.name || "Unassigned"}
                          </div>
                          {item.actualEmployee && item.actualEmployee.name !== item.asset.assignedEmployee?.name && (
                            <div className="text-[10px] text-amber-700 font-semibold">
                              Found with: {item.actualEmployee.name}
                            </div>
                          )}
                        </td>

                        {/* Condition */}
                        <td className="py-2.5 px-3">
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                              item.actualCondition === "DAMAGED" || item.actualCondition === "POOR"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {item.actualCondition || item.expectedCondition || "GOOD"}
                          </span>
                        </td>

                        {/* Audit Details */}
                        <td className="py-2.5 px-3">
                          {item.scannedAt ? (
                            <div className="space-y-0.5 text-[10px] text-slate-500">
                              <div>Scanned: {new Date(item.scannedAt).toLocaleTimeString()}</div>
                              <div>By: {item.scannedBy || "Auditor"}</div>
                              {item.discrepancyNotes && (
                                <div className="text-amber-700 font-medium line-clamp-1" title={item.discrepancyNotes}>
                                  {item.discrepancyNotes}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Unscanned</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => onViewDetails(item.asset)}
                            className="text-xs font-semibold text-brand-600 hover:text-brand-800 mr-2"
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Reconcile Modal */}
        <ReconcileModal
          isOpen={isReconcileModalOpen}
          onClose={() => setIsReconcileModalOpen(false)}
          session={activeSession}
          onSuccess={() => {
            fetchActiveSession(activeSession.id);
            fetchSessions();
          }}
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW: ALL SESSIONS LISTING
  // -------------------------------------------------------------
  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-sm border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/10">
            <QrCode className="w-8 h-8 text-indigo-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-base text-white">Stock Opname & QR Physical Audit</h2>
              <span className="bg-emerald-500/30 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border border-emerald-500/30">
                Phase 2 Active
              </span>
            </div>
            <p className="text-xs text-indigo-200/80 mt-1 max-w-xl leading-relaxed">
              Conduct scheduled physical hardware audits across all operating entities. Generate industrial 50×25mm and 60×40mm QR labels, capture expected inventory snapshots, and reconcile variances in real-time.
            </p>
          </div>
        </div>

        {/* Global Quick Actions */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onOpenLabelModal(assets)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-semibold transition-all backdrop-blur-xs"
          >
            <Printer className="w-4 h-4 text-indigo-300" />
            Print All QR Labels
          </button>

          {permissions.canManageStockOpname && (
            <button
              type="button"
              onClick={() => setIsNewModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold transition-all shadow-xs"
            >
              <Plus className="w-4 h-4" />
              New Audit Session
            </button>
          )}
        </div>
      </div>

      {/* Audit Pipeline Feature Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
            <Printer className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
            1. Industrial QR Labels
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Permanent cryptographic QR codes in standard 50×25mm thermal roll and 60×40mm badge formats.
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <QrCode className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
            2. Mobile Optical Scanning
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Scan using phone cameras or USB barcode readers with instant offline caching and duplicate detection.
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
            3. Automated Reconciliation
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Resolve room mismatches and missing hardware with full audit trails and downloadable Excel workbooks.
          </p>
        </div>
      </div>

      {/* Sessions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
              Audit Sessions ({sessions.length})
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">PostgreSQL Backed</span>
          </div>
          <button
            type="button"
            onClick={fetchSessions}
            disabled={loadingSessions}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title="Refresh sessions list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingSessions ? "animate-spin" : ""}`} />
          </button>
        </div>

        {loadingSessions ? (
          <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mb-2" />
            Loading audit sessions...
          </div>
        ) : sessions.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs space-y-3">
            <p>No Stock Opname audit sessions initialized yet.</p>
            {permissions.canManageStockOpname && (
              <button
                type="button"
                onClick={() => setIsNewModalOpen(true)}
                className="px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-semibold hover:bg-brand-700 transition-colors shadow-2xs"
              >
                Create First Audit Session
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Session Number</th>
                  <th className="py-3 px-4">Title & Scope</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Audit Progress</th>
                  <th className="py-3 px-4">Discrepancies</th>
                  <th className="py-3 px-4">Auditor</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sessions.map((s) => {
                  const isCompleted = s.status === "COMPLETED";
                  const stats = s.stats || {
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

                  return (
                    <tr
                      key={s.id}
                      onClick={() => setActiveSessionId(s.id)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {s.sessionNumber}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{s.title}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Loc: {s.locationScope || "ALL"} • Cat: {s.categoryScope || "ALL"}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-700">
                          {s.company ? s.company.code : "ALL"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            isCompleted
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="w-28 space-y-1">
                          <div className="flex justify-between text-[10px] text-slate-500">
                            <span>{stats.scannedCount} of {stats.totalExpected}</span>
                            <strong>{stats.progressPercentage}%</strong>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-brand-600 h-1.5 rounded-full"
                              style={{ width: `${stats.progressPercentage}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 text-[11px]">
                          {stats.locationMismatchCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 font-bold border border-amber-200">
                              {stats.locationMismatchCount} Loc
                            </span>
                          )}
                          {stats.userMismatchCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 font-bold border border-amber-200">
                              {stats.userMismatchCount} User
                            </span>
                          )}
                          {stats.totalExpected - stats.scannedCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 font-bold border border-rose-200">
                              {stats.totalExpected - stats.scannedCount} Miss
                            </span>
                          )}
                          {stats.locationMismatchCount === 0 &&
                            stats.userMismatchCount === 0 &&
                            stats.totalExpected - stats.scannedCount === 0 && (
                              <span className="text-emerald-600 font-semibold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                None
                              </span>
                            )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {s.conductedBy || "Auditor"}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveSessionId(s.id);
                          }}
                          className="text-xs font-semibold text-brand-600 hover:text-brand-800"
                        >
                          Open Audit
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            exportStockOpnameToExcel(s.id);
                          }}
                          className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                        >
                          Excel
                        </button>
                        {!isCompleted && permissions.canManageStockOpname && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteSession(s, e)}
                            className="text-xs font-semibold text-rose-500 hover:text-rose-700"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Session Modal */}
      <NewStockOpnameModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        companies={companies}
        assets={assets}
        currentUserName={currentUserName}
        onSuccess={() => {
          fetchSessions();
        }}
      />
    </div>
  );
}
