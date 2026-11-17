"use client";

import React from "react";
import AssetTable from "@/components/AssetTable";
import { AssetDTO, UserRole, CompanyDTO } from "@/types";

interface AssetInventoryViewProps {
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

export default function AssetInventoryView(props: AssetInventoryViewProps) {
  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      <div className="flex items-center justify-between pb-1 border-b border-slate-200">
        <div>
          <h2 className="text-sm font-bold text-slate-800">
            Hardware Asset Repository
          </h2>
          <p className="text-xs text-slate-500">
            Persistent PostgreSQL inventory records across GMD, GMC, and TEL entities
          </p>
        </div>
      </div>

      <AssetTable {...props} />
    </div>
  );
}

