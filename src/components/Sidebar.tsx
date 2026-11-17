"use client";

import React from "react";
import {
  LayoutDashboard,
  Cpu,
  Package,
  Users,
  ArrowRightLeft,
  QrCode,
  Wrench,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

export type NavView =
  | "management"
  | "operations"
  | "inventory"
  | "employees"
  | "assignments"
  | "stock_opname"
  | "maintenance"
  | "reports"
  | "settings";

interface SidebarProps {
  activeView: NavView;
  onViewChange: (view: NavView) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  attentionCount?: number;
  maintenanceCount?: number;
}

export default function Sidebar({
  activeView,
  onViewChange,
  collapsed,
  onToggleCollapse,
  attentionCount = 0,
  maintenanceCount = 0,
}: SidebarProps) {
  const navItems = [
    {
      group: "Overview Dashboards",
      items: [
        {
          id: "management" as NavView,
          label: "Management Overview",
          icon: LayoutDashboard,
          badge: null,
          tooltip: "Executive summary, financial metrics, and high-level charts",
        },
        {
          id: "operations" as NavView,
          label: "IT Operations Overview",
          icon: Cpu,
          badge: attentionCount > 0 ? `${attentionCount}` : null,
          badgeColor: "bg-amber-100 text-amber-800",
          tooltip: "Daily IT workflows, quick actions, and task queues",
        },
      ],
    },
    {
      group: "Core Asset Management",
      items: [
        {
          id: "inventory" as NavView,
          label: "Asset Inventory",
          icon: Package,
          badge: null,
          tooltip: "Full asset inventory database table, search, and filters",
        },
        {
          id: "employees" as NavView,
          label: "Employees",
          icon: Users,
          badge: null,
          tooltip: "Employee directory and custody assignments",
        },
        {
          id: "assignments" as NavView,
          label: "Assignments & Transfers",
          icon: ArrowRightLeft,
          badge: null,
          tooltip: "Historical logs of all asset handovers and returns",
        },
      ],
    },
    {
      group: "Audits & Maintenance",
      items: [
        {
          id: "maintenance" as NavView,
          label: "Maintenance",
          icon: Wrench,
          badge: maintenanceCount > 0 ? `${maintenanceCount}` : null,
          badgeColor: "bg-rose-100 text-rose-800",
          tooltip: "Hardware under repair or diagnostic bench",
        },
        {
          id: "stock_opname" as NavView,
          label: "Stock Opname",
          icon: QrCode,
          badge: "Active",
          badgeColor: "bg-emerald-100 text-emerald-800 text-[9px]",
          tooltip: "Phase 2 mobile camera scanning and physical audit reconciliation",
        },
        {
          id: "reports" as NavView,
          label: "Reports",
          icon: BarChart3,
          badge: null,
          tooltip: "Valuation, depreciation, and inventory summary exports",
        },
      ],
    },
    {
      group: "System",
      items: [
        {
          id: "settings" as NavView,
          label: "Settings",
          icon: Settings,
          badge: null,
          tooltip: "Database connection diagnostics and role settings",
        },
      ],
    },
  ];

  return (
    <aside
      className={`bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 transition-all duration-300 z-30 shrink-0 select-none ${
        collapsed ? "w-18" : "w-64"
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800 bg-slate-950/60">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="h-9 w-9 rounded-xl bg-brand-600 flex items-center justify-center text-white shrink-0 shadow-sm shadow-brand-500/30">
            <Package className="w-5 h-5 stroke-[2.2]" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <span className="font-bold text-sm text-white tracking-tight block truncate">
                IT Asset Inventory
              </span>
              <span className="text-[10px] font-semibold tracking-wider uppercase text-brand-400 block truncate">
                GMD • GMC • TEL • RCI
              </span>
            </div>
          )}
        </div>
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto py-4 px-2 space-y-6">
        {navItems.map((group, gIdx) => (
          <div key={gIdx} className="space-y-1">
            {!collapsed && (
              <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {group.group}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onViewChange(item.id)}
                    title={collapsed ? item.label : item.tooltip}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group relative ${
                      isActive
                        ? "bg-brand-600 text-white shadow-sm shadow-brand-600/30"
                        : "text-slate-400 hover:text-white hover:bg-slate-800/70"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive ? "text-white" : "text-slate-400 group-hover:text-slate-200"
                      }`}
                    />
                    {!collapsed && (
                      <span className="flex-1 text-left truncate leading-tight">
                        {item.label}
                      </span>
                    )}
                    {!collapsed && item.badge && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full uppercase shrink-0 ${
                          item.badgeColor || "bg-slate-700 text-slate-300"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                    {collapsed && item.badge && (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40 text-[11px] text-slate-400">
        {!collapsed ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-medium text-slate-300">PostgreSQL</span>
            </div>
            <span className="text-[10px] text-slate-500">v1.2 Enterprise</span>
          </div>
        ) : (
          <div className="flex justify-center" title="PostgreSQL Active">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
        )}
      </div>
    </aside>
  );
}

