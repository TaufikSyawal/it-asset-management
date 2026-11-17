"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Database, RefreshCw, Terminal } from "lucide-react";

interface HealthData {
  connected: boolean;
  tablesReady?: boolean;
  databaseUrl?: string;
  error?: string;
  counts?: {
    companies: number;
    employees: number;
    assets: number;
  };
}

export default function DbStatusBanner({ onRefresh }: { onRefresh?: () => void }) {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  const checkHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      setHealth(data);
    } catch (err: any) {
      setHealth({
        connected: false,
        error: err.message || "Failed to reach health endpoint",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  if (loading && !health) return null;

  // Fully operational state
  if (health?.connected && health.tablesReady) {
    return (
      <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-1.5 text-xs text-emerald-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-medium">PostgreSQL Connected</span>
          <span className="text-emerald-600">|</span>
          <span className="text-emerald-700">
            {health.counts?.assets || 0} Assets • {health.counts?.employees || 0} Employees • {health.counts?.companies || 0} Companies (GMD, GMC, TEL)
          </span>
        </div>
        <button
          onClick={() => {
            checkHealth();
            if (onRefresh) onRefresh();
          }}
          className="text-emerald-700 hover:text-emerald-900 flex items-center gap-1 font-medium text-xs transition-colors"
          title="Refresh database connection status"
        >
          <RefreshCw className="w-3 h-3" /> Check Sync
        </button>
      </div>
    );
  }

  // Database requirement notification (NOT silently falling back)
  if (dismissed) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-300 px-4 py-3 text-amber-900 shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-100 rounded-lg text-amber-700 mt-0.5">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-amber-950">
                PostgreSQL Database Configuration Required
              </span>
              <span className="bg-amber-200 text-amber-800 text-[11px] font-medium px-2 py-0.5 rounded-full">
                Prisma ORM
              </span>
            </div>
            <p className="text-xs text-amber-800 mt-0.5">
              {health?.error ||
                "Cannot connect to PostgreSQL at the configured DATABASE_URL. Permanent database persistence is required."}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs bg-amber-100/70 p-2 rounded border border-amber-200 font-mono text-amber-900">
              <Terminal className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span>1. Configure <code className="bg-white px-1.5 py-0.5 rounded font-semibold text-amber-950">DATABASE_URL</code> in <code className="bg-white px-1.5 py-0.5 rounded font-semibold text-amber-950">.env</code></span>
              <span>&rarr;</span>
              <span>2. Run <code className="bg-white px-1.5 py-0.5 rounded font-semibold text-amber-950">npx prisma db push</code></span>
              <span>&rarr;</span>
              <span>3. Run <code className="bg-white px-1.5 py-0.5 rounded font-semibold text-amber-950">npm run prisma:seed</code></span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-center shrink-0">
          <button
            onClick={() => {
              checkHealth();
              if (onRefresh) onRefresh();
            }}
            disabled={loading}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Checking..." : "Retry Connection"}
          </button>
        </div>
      </div>
    </div>
  );
}

