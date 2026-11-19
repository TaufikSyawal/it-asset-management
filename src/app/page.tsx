"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Sidebar, { NavView } from "@/components/Sidebar";
import TopNav from "@/components/TopNav";
import DbStatusBanner from "@/components/DbStatusBanner";
import AuthModal from "@/components/AuthModal";

// Views
import ManagementOverview from "@/components/views/ManagementOverview";
import ITOperationsOverview from "@/components/views/ITOperationsOverview";
import AssetInventoryView from "@/components/views/AssetInventoryView";
import EmployeesView from "@/components/views/EmployeesView";
import AssignmentsView from "@/components/views/AssignmentsView";
import MaintenanceView from "@/components/views/MaintenanceView";
import StockOpnameView from "@/components/views/StockOpnameView";
import ReportsView from "@/components/views/ReportsView";
import SettingsView from "@/components/views/SettingsView";

// Modals & Drawers
import AssetModal from "@/components/AssetModal";
import AssetAssignModal from "@/components/AssetAssignModal";
import AssetDetailDrawer from "@/components/AssetDetailDrawer";
import ExcelImportModal from "@/components/ExcelImportModal";
import QRLabelModal from "@/components/QRLabelModal";

// Types & Services
import { AssetDTO, CompanyDTO, EmployeeDTO, UserRole, AssignmentAction, UserSession } from "@/types";
import { getCompanies } from "@/services/companyService";
import { getEmployees } from "@/services/employeeService";
import { getAssets, getAssetById, archiveAsset, createEmptyStats } from "@/services/assetService";
import { getUserProfile, signOut, onAuthStateChange } from "@/services/authService";
import { registerAutoSyncListener, getOfflineScans, syncOfflineScans } from "@/services/offlineSyncService";
import { isSupabaseConfigured } from "@/lib/supabase";

export default function AppShell() {
  // Navigation & Layout
  const [activeView, setActiveView] = useState<NavView>("management");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Authentication & RBAC
  const [authenticatedUser, setAuthenticatedUser] = useState<UserSession | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [currentRole, setCurrentRole] = useState<UserRole>("SUPER_ADMIN");

  // Metadata & Tenant
  const [companies, setCompanies] = useState<CompanyDTO[]>([]);
  const [employees, setEmployees] = useState<EmployeeDTO[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("ALL");

  // Assets & Stats
  const [assets, setAssets] = useState<AssetDTO[]>([]);
  const [totalAssets, setTotalAssets] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState<any>(createEmptyStats());
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filters for Asset Inventory
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [duplicateOnly, setDuplicateOnly] = useState(false);

  // Debounce search input to prevent rapid request loops
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page to 1 when filters or debounced search change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedCompanyId, statusFilter, categoryFilter, duplicateOnly]);

  // Offline Audit Queue
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);

  // Modals
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [assetToEdit, setAssetToEdit] = useState<AssetDTO | null>(null);

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assetToAssign, setAssetToAssign] = useState<AssetDTO | null>(null);
  const [assignInitialAction, setAssignInitialAction] = useState<AssignmentAction>("ASSIGN");
  const [assignInitialEmployeeId, setAssignInitialEmployeeId] = useState<string | undefined>(undefined);

  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<AssetDTO | null>(null);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [assetsToPrint, setAssetsToPrint] = useState<AssetDTO[]>([]);

  // 1. Fetch metadata (companies, employees) - completely stable reference
  const fetchMetadata = useCallback(async () => {
    try {
      const [compData, empData] = await Promise.all([
        getCompanies(),
        getEmployees(),
      ]);
      setCompanies(compData || []);
      setEmployees(empData || []);
    } catch (err) {
      console.error("Error fetching metadata:", err);
    }
  }, []);

  // 2. Fetch assets & statistics with in-flight request tracking
  const activeRequestIdRef = useRef(0);

  const fetchAssets = useCallback(async () => {
    const reqId = ++activeRequestIdRef.current;
    setLoading(true);
    setFetchError(null);
    try {
      const result = await getAssets({
        search: debouncedSearch,
        companyId: selectedCompanyId,
        status: statusFilter,
        category: categoryFilter,
        isDuplicateTag: duplicateOnly,
        page: currentPage,
        limit: 15,
      });

      // Discard stale in-flight responses
      if (reqId === activeRequestIdRef.current) {
        setAssets(result.assets || []);
        setTotalAssets(result.total || 0);
        setTotalPages(result.totalPages || 1);
        if (result.stats) {
          setStats(result.stats);
        }
        setFetchError(null);
      }
    } catch (err: any) {
      if (reqId === activeRequestIdRef.current) {
        console.error("Error fetching assets:", err);
        setFetchError(err.message || "Failed to load inventory assets. Please check connection.");
      }
    } finally {
      if (reqId === activeRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [debouncedSearch, selectedCompanyId, statusFilter, categoryFilter, duplicateOnly, currentPage]);

  // 3. SINGLE, permanent Auth subscription mounted once on app load
  useEffect(() => {
    let mounted = true;

    if (isSupabaseConfigured()) {
      getUserProfile()
        .then((user) => {
          if (!mounted) return;
          if (user) {
            setAuthenticatedUser(user);
            setCurrentRole(user.role);
            setIsAuthModalOpen(false);
          } else {
            setIsAuthModalOpen(true);
          }
        })
        .catch((err) => {
          console.warn("Initial auth check warning:", err);
        });

      const authSub = onAuthStateChange((user, event) => {
        if (!mounted) return;
        if (event === "SIGNED_OUT" || !user) {
          setAuthenticatedUser(null);
          setIsAuthModalOpen(true);
        } else {
          setAuthenticatedUser(user);
          setCurrentRole(user.role);
          setIsAuthModalOpen(false);
        }
      });

      return () => {
        mounted = false;
        authSub.unsubscribe();
      };
    } else {
      // Local dev role fetch
      fetch("/api/auth/role")
        .then((res) => res.json())
        .then((data) => {
          if (!mounted) return;
          if (data.user?.role) setCurrentRole(data.user.role);
        })
        .catch(() => {});
    }
  }, []); // Run ONCE on mount! Never tears down during active user session!

  // 4. Initial metadata fetch on mount
  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  // 5. Data fetch effect - strictly triggered by filter/page/role changes
  useEffect(() => {
    fetchAssets();
  }, [fetchAssets, currentRole]);

  // 6. Offline sync listener - registered with stable fetchAssets callback
  useEffect(() => {
    const updateOfflineCount = async () => {
      const queued = await getOfflineScans();
      setOfflineQueueCount(queued.length);
    };

    updateOfflineCount();
    const unregister = registerAutoSyncListener(async (res) => {
      if (res.synced > 0) {
        updateOfflineCount();
        fetchAssets();
      }
    });

    return () => unregister();
  }, [fetchAssets]);

  // Handlers
  const handleRoleChange = (newRole: UserRole) => {
    setCurrentRole(newRole);
    setCurrentPage(1);
  };

  const handleCompanyChange = (companyId: string) => {
    setSelectedCompanyId(companyId);
    setCurrentPage(1);
  };

  const handleSignOut = async () => {
    await signOut();
    setAuthenticatedUser(null);
    if (isSupabaseConfigured()) {
      setIsAuthModalOpen(true);
    }
  };

  const handleAddAsset = () => {
    setAssetToEdit(null);
    setIsAssetModalOpen(true);
  };

  const handleEditAsset = (asset: AssetDTO) => {
    setAssetToEdit(asset);
    setIsAssetModalOpen(true);
  };

  const handleAssignAsset = (
    actionOrAsset?: AssignmentAction | AssetDTO,
    maybeAsset?: AssetDTO,
    maybeEmployeeId?: string
  ) => {
    let action: AssignmentAction = "ASSIGN";
    let targetAsset: AssetDTO | null = null;
    if (typeof actionOrAsset === "string") {
      action = actionOrAsset;
      targetAsset = maybeAsset || null;
    } else if (actionOrAsset) {
      targetAsset = actionOrAsset;
    }
    setAssignInitialAction(action);
    setAssetToAssign(targetAsset);
    setAssignInitialEmployeeId(maybeEmployeeId);
    setIsAssignModalOpen(true);
  };

  const handleAssignToEmployee = (employeeId: string) => {
    const unassigned = assets.find((a) => !a.assignedEmployeeId && a.status === "AVAILABLE");
    setAssignInitialAction("ASSIGN");
    setAssetToAssign(unassigned || null);
    setAssignInitialEmployeeId(employeeId);
    setIsAssignModalOpen(true);
  };

  const handleViewDetails = (asset: AssetDTO) => {
    setSelectedAsset(asset);
    setIsDetailDrawerOpen(true);
  };

  const handleViewAssetById = async (assetId: string) => {
    const found = assets.find((a) => a.id === assetId);
    if (found) {
      handleViewDetails(found);
      return;
    }
    const asset = await getAssetById(assetId);
    if (asset) {
      handleViewDetails(asset);
    }
  };

  const handleArchiveAsset = async (asset: AssetDTO) => {
    const confirmMsg = `Are you sure you want to archive asset ${asset.assetTag} (${asset.assetName})?\n\nThis will soft-archive the record and preserve its entire audit history.`;
    if (!window.confirm(confirmMsg)) return;

    const res = await archiveAsset(asset.id);
    if (res.success) {
      fetchAssets();
      fetchMetadata();
    } else {
      alert(res.error || "Failed to archive asset");
    }
  };

  const activeCompanyName =
    selectedCompanyId === "ALL"
      ? companies.length > 0
        ? `All Entities (${companies.map((c) => c.code).join(" • ")})`
        : "All Entities"
      : companies.find((c) => c.id === selectedCompanyId)?.name || "Selected Entity";

  // Navigation shortcuts from Overview pages
  const handleNavigateToInventory = (filter?: { status?: string; duplicateOnly?: boolean }) => {
    if (filter?.status) setStatusFilter(filter.status);
    if (filter?.duplicateOnly !== undefined) setDuplicateOnly(filter.duplicateOnly);
    setActiveView("inventory");
  };

  const handleNavigateToMaintenance = () => {
    setActiveView("maintenance");
  };

  const handlePrintSingleLabel = (asset: AssetDTO) => {
    setAssetsToPrint([asset]);
    setIsLabelModalOpen(true);
  };

  const handlePrintBatchLabels = (batch: AssetDTO[]) => {
    setAssetsToPrint(batch && batch.length > 0 ? batch : assets);
    setIsLabelModalOpen(true);
  };

  const handleNavigateToStockOpname = () => {
    setActiveView("stock_opname");
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900 font-sans antialiased">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex shrink-0">
        <Sidebar
          activeView={activeView}
          onViewChange={setActiveView}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          attentionCount={stats?.requiringAttention || 0}
          maintenanceCount={stats?.maintenance || 0}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative z-10 w-72 bg-slate-900 flex flex-col">
            <Sidebar
              activeView={activeView}
              onViewChange={(v) => {
                setActiveView(v);
                setMobileSidebarOpen(false);
              }}
              collapsed={false}
              onToggleCollapse={() => setMobileSidebarOpen(false)}
              attentionCount={stats?.requiringAttention || 0}
              maintenanceCount={stats?.maintenance || 0}
            />
          </div>
        </div>
      )}

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto h-screen">
        {/* Database Sync Banner */}
        <DbStatusBanner onRefresh={() => { fetchMetadata(); fetchAssets(); }} />

        {/* Offline Scans Synchronizing Badge */}
        {offlineQueueCount > 0 && (
          <div className="bg-sky-50 border-b border-sky-200 px-4 py-1.5 text-xs text-sky-800 flex items-center justify-between">
            <span>Offline Audit Mode: <strong>{offlineQueueCount}</strong> scan(s) queued locally.</span>
            <button
              onClick={async () => {
                const res = await syncOfflineScans();
                if (res.synced > 0) {
                  const queued = await getOfflineScans();
                  setOfflineQueueCount(queued.length);
                  fetchAssets();
                }
              }}
              className="px-2 py-0.5 bg-sky-600 hover:bg-sky-700 text-white rounded text-[11px] font-semibold"
            >
              Sync Now
            </button>
          </div>
        )}

        {/* Top Navigation */}
        <TopNav
          activeView={activeView}
          companies={companies}
          selectedCompanyId={selectedCompanyId}
          onCompanyChange={handleCompanyChange}
          currentRole={currentRole}
          onRoleChange={handleRoleChange}
          onAddAsset={handleAddAsset}
          onOpenImport={() => setIsImportModalOpen(true)}
          onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          authenticatedUser={authenticatedUser}
          onSignOut={handleSignOut}
        />

        {/* Page Content View Router */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl w-full mx-auto">
          {activeView === "management" && (
            <ManagementOverview
              stats={stats}
              loading={loading}
              currentRole={currentRole}
              selectedCompanyName={activeCompanyName}
              onNavigateToInventory={handleNavigateToInventory}
              onNavigateToMaintenance={handleNavigateToMaintenance}
            />
          )}

          {activeView === "operations" && (
            <ITOperationsOverview
              stats={stats}
              loading={loading}
              currentRole={currentRole}
              selectedCompanyName={activeCompanyName}
              onAddAsset={handleAddAsset}
              onOpenImport={() => setIsImportModalOpen(true)}
              onAssignAsset={handleAssignAsset}
              onNavigateToInventory={handleNavigateToInventory}
              onNavigateToMaintenance={handleNavigateToMaintenance}
              onNavigateToStockOpname={handleNavigateToStockOpname}
              onViewAssetDetails={handleViewAssetById}
            />
          )}

          {activeView === "inventory" && (
            <AssetInventoryView
              assets={assets}
              totalAssets={totalAssets}
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              search={search}
              onSearchChange={(s) => {
                setSearch(s);
                setCurrentPage(1);
              }}
              statusFilter={statusFilter}
              onStatusFilterChange={(st) => {
                setStatusFilter(st);
                setCurrentPage(1);
              }}
              categoryFilter={categoryFilter}
              onCategoryFilterChange={(cat) => {
                setCategoryFilter(cat);
                setCurrentPage(1);
              }}
              duplicateOnly={duplicateOnly}
              onDuplicateOnlyChange={(dup) => {
                setDuplicateOnly(dup);
                setCurrentPage(1);
              }}
              currentRole={currentRole}
              companies={companies}
              onViewDetails={handleViewDetails}
              onEditAsset={handleEditAsset}
              onAssignAsset={handleAssignAsset}
              onArchiveAsset={handleArchiveAsset}
              onPrintLabel={handlePrintSingleLabel}
              onPrintBatchLabels={handlePrintBatchLabels}
              loading={loading}
              error={fetchError}
              onRetry={fetchAssets}
            />
          )}

          {activeView === "employees" && (
            <EmployeesView
              employees={employees}
              assets={assets}
              companies={companies}
              currentRole={currentRole}
              onViewAssetDetails={handleViewDetails}
              onAssignToEmployee={handleAssignToEmployee}
              onRefreshMetadata={() => {
                fetchMetadata();
                fetchAssets();
              }}
            />
          )}

          {activeView === "assignments" && (
            <AssignmentsView
              stats={stats}
              onViewAssetDetails={handleViewAssetById}
            />
          )}

          {activeView === "maintenance" && (
            <MaintenanceView
              assets={assets}
              currentRole={currentRole}
              onViewDetails={handleViewDetails}
              onAssignAsset={handleAssignAsset}
              onSendToMaintenance={() => handleAssignAsset("REPLACEMENT")}
              onRefresh={() => {
                fetchAssets();
              }}
            />
          )}

          {activeView === "stock_opname" && (
            <StockOpnameView
              assets={assets}
              companies={companies}
              currentRole={currentRole}
              currentUserName={authenticatedUser?.name || currentRole.replace("_", " ")}
              onViewDetails={handleViewDetails}
              onOpenLabelModal={handlePrintBatchLabels}
            />
          )}

          {activeView === "reports" && (
            <ReportsView
              stats={stats}
              assets={assets}
              currentRole={currentRole}
              companies={companies}
              selectedCompanyName={activeCompanyName}
            />
          )}

          {activeView === "settings" && (
            <SettingsView
              currentRole={currentRole}
              onRoleChange={handleRoleChange}
              companies={companies}
              onRefreshCompanies={fetchMetadata}
            />
          )}
        </main>
      </div>

      {/* Global Modals & Drawers */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onSuccess={(user) => {
          setAuthenticatedUser(user);
          setCurrentRole(user.role);
          setIsAuthModalOpen(false);
          fetchMetadata();
          fetchAssets();
        }}
      />

      <AssetModal
        isOpen={isAssetModalOpen}
        onClose={() => setIsAssetModalOpen(false)}
        assetToEdit={assetToEdit}
        companies={companies}
        employees={employees}
        currentRole={currentRole}
        onSuccess={() => {
          fetchAssets();
          fetchMetadata();
        }}
      />

      <AssetAssignModal
        isOpen={isAssignModalOpen}
        onClose={() => {
          setIsAssignModalOpen(false);
          setAssignInitialEmployeeId(undefined);
        }}
        asset={assetToAssign}
        allAssets={assets}
        initialActionType={assignInitialAction}
        initialEmployeeId={assignInitialEmployeeId}
        employees={employees}
        onSuccess={() => {
          fetchAssets();
          fetchMetadata();
        }}
      />

      <AssetDetailDrawer
        isOpen={isDetailDrawerOpen}
        onClose={() => setIsDetailDrawerOpen(false)}
        asset={selectedAsset}
        currentRole={currentRole}
        onEdit={() => {
          if (selectedAsset) {
            setIsDetailDrawerOpen(false);
            handleEditAsset(selectedAsset);
          }
        }}
        onAssign={() => {
          if (selectedAsset) {
            setIsDetailDrawerOpen(false);
            handleAssignAsset(selectedAsset);
          }
        }}
        onPrintLabel={handlePrintSingleLabel}
        onAssetUpdated={fetchAssets}
      />

      <ExcelImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => {
          fetchAssets();
          fetchMetadata();
        }}
      />

      <QRLabelModal
        isOpen={isLabelModalOpen}
        onClose={() => setIsLabelModalOpen(false)}
        assets={assetsToPrint}
      />
    </div>
  );
}
