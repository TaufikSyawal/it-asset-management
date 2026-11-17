"use client";

import React, { useState, useEffect } from "react";
import { UserRole, CompanyDTO } from "@/types";
import { Settings, Database, ShieldCheck, RefreshCw, Terminal, CheckCircle2, Cloud, ExternalLink } from "lucide-react";
import RoleSelector from "@/components/RoleSelector";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

interface SettingsViewProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  companies: CompanyDTO[];
}

export default function SettingsView({
  currentRole,
  onRoleChange,
  companies,
}: SettingsViewProps) {
  const [healthData, setHealthData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const isCloud = isSupabaseConfigured();

  const checkHealth = async () => {
    setLoading(true);

    if (isCloud) {
      try {
        const { count, error } = await supabase
          .from("assets")
          .select("id", { count: "exact", head: true })
          .eq("is_archived", false);

        setHealthData({
          connected: !error,
          type: "supabase",
          assetCount: count || 0,
          error: error?.message,
        });
      } catch (err: any) {
        setHealthData({
          connected: false,
          type: "supabase",
          error: err.message,
        });
      } finally {
        setLoading(false);
      }
      return;
    }

    // Local dev health check
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      setHealthData({
        ...data,
        type: "local",
      });
    } catch (err: any) {
      setHealthData({ connected: false, type: "local", error: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-150 max-w-4xl">
      {/* Header */}
      <div className="pb-2 border-b border-slate-200">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <Settings className="w-4 h-4 text-brand-600" />
          <span>System & Governance Settings</span>
        </h2>
        <p className="text-xs text-slate-500">
          Database connectivity diagnostics, multi-entity tenant scopes, and RBAC governance
        </p>
      </div>

      {/* Database Diagnostic Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              {isCloud ? <Cloud className="w-5 h-5" /> : <Database className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                {isCloud ? "Supabase Cloud PostgreSQL" : "Local Development Database"}
              </h3>
              <p className="text-[11px] text-slate-500">
                {isCloud
                  ? "Managed PostgreSQL 15 • Row Level Security & Private Storage"
                  : "Prisma ORM engine & live schema on localhost"}
              </p>
            </div>
          </div>

          <button
            onClick={checkHealth}
            disabled={loading}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Test Connection</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-400 block text-[11px]">Connection Status</span>
            {healthData?.connected ? (
              <span className="font-bold text-emerald-600 flex items-center gap-1 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Active & Persistent
              </span>
            ) : (
              <span className="font-bold text-rose-600">Disconnected</span>
            )}
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-400 block text-[11px]">Backend Architecture</span>
            <span className="font-bold text-slate-800 mt-0.5 block">
              {isCloud ? "Supabase Free Tier ($0/mo)" : "PostgreSQL 16 Local"}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-400 block text-[11px]">Active Entities</span>
            <span className="font-bold text-slate-800 mt-0.5 block">
              GMD • GMC • TEL ({companies.length} Configured)
            </span>
          </div>
        </div>

        {isCloud ? (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-800">Supabase Free Tier Compliance Policy:</p>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Target monthly cost: <strong>$0.00 / month</strong>. Database quota: 500 MB. Storage quota: 1 GB (Canvas client-side WebP optimization fits 12,000+ asset photos). Bandwidth egress: 2 GB/mo. Free projects pause after 7 days of inactivity; restore with 1-click in the official Supabase dashboard.
            </p>
          </div>
        ) : healthData?.databaseUrl ? (
          <div className="p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px] flex items-center gap-2 overflow-x-auto">
            <Terminal className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>DATABASE_URL: {healthData.databaseUrl}</span>
          </div>
        ) : null}
      </div>

      {/* RBAC Role Governance Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                Active Role-Based Access Control (RBAC) Persona
              </h3>
              <p className="text-[11px] text-slate-500">
                Simulate permission enforcement, multi-company filtering, and financial masking
              </p>
            </div>
          </div>

          <RoleSelector currentRole={currentRole} onRoleChange={onRoleChange} />
        </div>

        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 space-y-1">
          <p>
            Current active persona: <strong className="text-slate-900">{currentRole}</strong>
          </p>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Financial capital and net book values are automatically masked at the database level for IT Admin, Auditor, and Employee roles, while being fully visible to Super Admin, Management, and Finance.
          </p>
        </div>
      </div>
    </div>
  );
}
