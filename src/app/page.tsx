"use client";

import React, { useState, useEffect, useCallback } from "react";
import Sidebar, { NavView } from "@/components/Sidebar";
import TopNav from "@/components/TopNav";
import DbStatusBanner from "@/components/DbStatusBanner";

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

import { AssetDTO, CompanyDTO, EmployeeDTO, UserRole, AssignmentAction } from "@/types";

export default function AppShell() {
  // Navigation & Layout
  const [activeView, setActiveView] = useState<NavView>("management");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Metadata & Tenant
  const [companies, setCompanies] = useState<CompanyDTO[]>([]);
  const [employees, setEmployees] = useState<EmployeeDTO[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("ALL");
  const [currentRole, setCurrentRole] = useState<UserRole>("SUPER_ADMIN");

  // Assets & Stats
  const [assets, setAssets] = useState<AssetDTO[]>([]);
  const [totalAssets, setTotalAssets] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Filters for Asset Inventory
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [duplicateOnly, setDuplicateOnly] = useState(false);

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

  // 1. Fetch metadata (companies, role, employees)
  const fetchMetadata = async () => {
    try {
      const [compRes, roleRes, empRes] = await Promise.all([
        fetch("/api/companies"),
        fetch("/api/auth/role"),
        fetch("/api/employees"),
      ]);

      if (compRes.ok) {
        const compData = await compRes.json();
        setCompanies(compData.companies || []);
      }

      if (roleRes.ok) {
        const roleData = await roleRes.json();
        if (roleData.user?.role) {
          setCurrentRole(roleData.user.role);
        }
      }

      if (empRes.ok) {
        const empData = await empRes.json();
        setEmployees(empData.employees || []);
      }
    } catch (err) {
      console.error("Error fetching metadata:", err);
    }
  };

  // 2. Fetch assets & statistics
  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (selectedCompanyId && selectedCompanyId !== "ALL") params.set("companyId", selectedCompanyId);
      if (statusFilter && statusFilter !== "ALL") params.set("status", statusFilter);
      if (categoryFilter && categoryFilter !== "ALL") params.set("category", categoryFilter);
      if (duplicateOnly) params.set("isDuplicateTag", "true");
      params.set("page", String(currentPage));
      params.set("limit", "15");

      const res = await fetch(`/api/assets?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAssets(data.assets || []);
        setTotalAssets(data.total || 0);
        setTotalPages(data.totalPages || 1);
        setStats(data.stats || null);
      }
    } catch (err) {
      console.error("Error fetching assets:", err);
    } finally {
      setLoading(false);
    }
  }, [search, selectedCompanyId, statusFilter, categoryFilter, duplicateOnly, currentPage]);

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets, currentRole]);

  // Handlers
  const handleRoleChange = (newRole: UserRole) => {
    setCurrentRole(newRole);
    setCurrentPage(1);
  };

  const handleCompanyChange = (companyId: string) => {
    setSelectedCompanyId(companyId);
    setCurrentPage(1);
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
    try {
      const res = await fetch(`/api/assets/${assetId}`);
      if (res.ok) {
        const data = await res.json();
        handleViewDetails(data.asset);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleArchiveAsset = async (asset: AssetDTO) => {
    const confirmMsg = `Are you sure you want to archive asset ${asset.assetTag} (${asset.assetName})?\n\nThis will soft-archive the record in PostgreSQL and preserve its entire audit history.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/assets/${asset.id}`, { method: "DELETE" });
      if (res.ok) {
        fetchAssets();
        fetchMetadata();
      } else {
        const errData = await res.json();
        alert(errData.error || "Failed to archive asset");
      }
    } catch (err: any) {
      alert("Error archiving asset: " + err.message);
    }
  };

  const activeCompanyName =
    selectedCompanyId === "ALL"
      ? "All Entities (GMD • GMC • TEL)"
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
        />

        {/* Page Content View Router */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl w-full mx-auto">
          {activeView === "management" && (
            <ManagementOverview
              stats={stats}
              currentRole={currentRole}
              selectedCompanyName={activeCompanyName}
              onNavigateToInventory={handleNavigateToInventory}
              onNavigateToMaintenance={handleNavigateToMaintenance}
            />
          )}

          {activeView === "operations" && (
            <ITOperationsOverview
              stats={stats}
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
              currentUserName={currentRole.replace("_", " ")}
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
            />
          )}
        </main>
      </div>

      {/* Global Modals & Drawers */}
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
