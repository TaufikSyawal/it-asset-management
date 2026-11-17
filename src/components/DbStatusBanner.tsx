"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Cloud, Database, RefreshCw, Terminal, ExternalLink } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

interface HealthData {
  connected: boolean;
  type: "supabase" | "local";
  error?: string;
  isPaused?: boolean;
}

export default function DbStatusBanner({ onRefresh }: { onRefresh?: () => void }) {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  const checkHealth = async () => {
    setLoading(true);

    if (isSupabaseConfigured()) {
      try {
        const { error, status } = await supabase
          .from("companies")
          .select("id", { count: "exact", head: true });

        if (error) {
          const isPaused = status === 503 || error.message.toLowerCase().includes("paused");
          setHealth({
            connected: false,
            type: "supabase",
            error: error.message,
            isPaused,
          });
        } else {
          setHealth({
            connected: true,
            type: "supabase",
          });
        }
      } catch (err: any) {
        setHealth({
          connected: false,
          type: "supabase",
          error: err.message,
        });
      } finally {
        setLoading(false);
      }
      return;
    }

    // Local development mode check
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      setHealth({
        connected: data.connected && data.tablesReady,
        type: "local",
        error: data.error,
      });
    } catch (err: any) {
      setHealth({
        connected: false,
        type: "local",
        error: process.env.NODE_ENV === "production"
          ? "Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY) are not configured."
          : err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  if (loading && !health) return null;

  // Supabase operational state
  if (health?.connected && health.type === "supabase") {
    return (
      <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-1 text-xs text-emerald-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold">Supabase Cloud Connected</span>
          <span className="text-emerald-500">•</span>
          <span className="text-emerald-700">Managed PostgreSQL & Private Storage Active</span>
        </div>
        <button
          onClick={() => {
            checkHealth();
            if (onRefresh) onRefresh();
          }}
          className="text-emerald-700 hover:text-emerald-900 flex items-center gap-1 font-medium text-xs transition-colors"
          title="Verify Supabase live connection"
        >
          <RefreshCw className="w-3 h-3" /> Sync Status
        </button>
      </div>
    );
  }

  // Local development operational state
  if (health?.connected && health.type === "local") {
    return (
      <div className="bg-slate-100 border-b border-slate-200 px-4 py-1 text-xs text-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
          <span className="font-medium text-slate-800">Local Development Database Active</span>
          <span className="text-slate-400">•</span>
          <span className="text-slate-600">PostgreSQL 16 via Prisma ORM</span>
        </div>
        <button
          onClick={() => {
            checkHealth();
            if (onRefresh) onRefresh();
          }}
          className="text-slate-600 hover:text-slate-900 flex items-center gap-1 font-medium text-xs transition-colors"
        >
          <RefreshCw className="w-3 h-3" /> Re-check
        </button>
      </div>
    );
  }

  if (dismissed) return null;

  // Supabase paused notification
  if (health?.type === "supabase" && health.isPaused) {
    return (
      <div className="bg-amber-50 border-b border-amber-300 px-4 py-3 text-amber-900">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-xs text-amber-950">
                Supabase Free Project Paused (Official 7-Day Inactivity Rule)
              </p>
              <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                Supabase free projects automatically pause after 7 days of inactivity. Simply click "Restore Project" in your Supabase dashboard to resume immediately at zero cost.
              </p>
            </div>
          </div>
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shrink-0"
          >
            <span>Open Supabase Dashboard</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    );
  }

  // Missing configuration or connection failure
  return (
    <div className="bg-amber-50 border-b border-amber-300 px-4 py-2 text-amber-900 text-xs">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="font-medium text-amber-950">Backend Connectivity Notice:</span>
          <span className="text-amber-800 text-[11px]">{health?.error || "Awaiting database connection."}</span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-[11px] font-semibold text-amber-700 hover:text-amber-900 px-2 py-0.5 rounded border border-amber-300 hover:bg-amber-100"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
