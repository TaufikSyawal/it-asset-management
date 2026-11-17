import { UserRole, AssetDTO } from "@/types";

export interface RolePermissions {
  canViewAssets: boolean;
  canCreateAssets: boolean;
  canEditAssets: boolean;
  canArchiveAssets: boolean;
  canAssignAssets: boolean;
  canViewFinancials: boolean;
  canEditFinancials: boolean;
  canImportAssets: boolean;
  canViewAuditLogs: boolean;
  canManageUsers: boolean;
  canManageStockOpname: boolean;
  canReconcileStockOpname: boolean;
  canManagePhotos: boolean;
  restrictedToOwnAssets: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  SUPER_ADMIN: {
    canViewAssets: true,
    canCreateAssets: true,
    canEditAssets: true,
    canArchiveAssets: true,
    canAssignAssets: true,
    canViewFinancials: true,
    canEditFinancials: true,
    canImportAssets: true,
    canViewAuditLogs: true,
    canManageUsers: true,
    canManageStockOpname: true,
    canReconcileStockOpname: true,
    canManagePhotos: true,
    restrictedToOwnAssets: false,
  },
  MANAGEMENT: {
    canViewAssets: true,
    canCreateAssets: false,
    canEditAssets: false,
    canArchiveAssets: false,
    canAssignAssets: false,
    canViewFinancials: true, // Executive portfolio & NBV oversight
    canEditFinancials: false,
    canImportAssets: false,
    canViewAuditLogs: true,
    canManageUsers: false,
    canManageStockOpname: false,
    canReconcileStockOpname: false,
    canManagePhotos: false,
    restrictedToOwnAssets: false,
  },
  IT_ADMIN: {
    canViewAssets: true,
    canCreateAssets: true,
    canEditAssets: true,
    canArchiveAssets: true,
    canAssignAssets: true,
    canViewFinancials: false, // Masked
    canEditFinancials: false,
    canImportAssets: true,
    canViewAuditLogs: true,
    canManageUsers: false,
    canManageStockOpname: true,
    canReconcileStockOpname: true,
    canManagePhotos: true,
    restrictedToOwnAssets: false,
  },
  FINANCE: {
    canViewAssets: true,
    canCreateAssets: false,
    canEditAssets: false,
    canArchiveAssets: false,
    canAssignAssets: false,
    canViewFinancials: true,
    canEditFinancials: true,
    canImportAssets: false,
    canViewAuditLogs: true,
    canManageUsers: false,
    canManageStockOpname: false,
    canReconcileStockOpname: false,
    canManagePhotos: false,
    restrictedToOwnAssets: false,
  },
  AUDITOR: {
    canViewAssets: true,
    canCreateAssets: false,
    canEditAssets: false,
    canArchiveAssets: false,
    canAssignAssets: false,
    canViewFinancials: false, // Strictly masked for non-finance/management
    canEditFinancials: false,
    canImportAssets: false,
    canViewAuditLogs: true,
    canManageUsers: false,
    canManageStockOpname: true,
    canReconcileStockOpname: true,
    canManagePhotos: false,
    restrictedToOwnAssets: false,
  },
  EMPLOYEE: {
    canViewAssets: true,
    canCreateAssets: false,
    canEditAssets: false,
    canArchiveAssets: false,
    canAssignAssets: false,
    canViewFinancials: false,
    canEditFinancials: false,
    canImportAssets: false,
    canViewAuditLogs: false,
    canManageUsers: false,
    canManageStockOpname: false,
    canReconcileStockOpname: false,
    canManagePhotos: false,
    restrictedToOwnAssets: true, // Only sees assets assigned to themselves
  },
};

/**
 * Filter and mask asset fields according to user role permissions
 */
export function sanitizeAssetForRole(asset: any, role: UserRole): AssetDTO {
  const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.EMPLOYEE;

  // Clone object
  const sanitized = { ...asset };

  // Convert Prisma Decimals to numbers
  if (sanitized.purchaseCost !== undefined && sanitized.purchaseCost !== null) {
    sanitized.purchaseCost = Number(sanitized.purchaseCost);
  }
  if (sanitized.accumulatedDepreciation !== undefined && sanitized.accumulatedDepreciation !== null) {
    sanitized.accumulatedDepreciation = Number(sanitized.accumulatedDepreciation);
  }
  if (sanitized.netBookValue !== undefined && sanitized.netBookValue !== null) {
    sanitized.netBookValue = Number(sanitized.netBookValue);
  }

  // Mask financial data if role does not have financial view permissions
  if (!permissions.canViewFinancials) {
    delete sanitized.purchaseCost;
    delete sanitized.accumulatedDepreciation;
    delete sanitized.netBookValue;
    delete sanitized.usefulLifeMonths;
    delete sanitized.depreciationMethod;
    delete sanitized.depreciationStartDate;
  }

  // Format photos with secure relative streaming URLs
  if (Array.isArray(sanitized.photos)) {
    sanitized.photos = sanitized.photos.map((p: any) => ({
      ...p,
      createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
      updatedAt: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : p.updatedAt,
      url: `/api/assets/${sanitized.id}/photos/${p.id}`,
      thumbnailUrl: `/api/assets/${sanitized.id}/photos/${p.id}?thumb=true`,
    }));
    sanitized.primaryPhoto =
      sanitized.photos.find((p: any) => p.isPrimary) || sanitized.photos[0] || null;
  } else {
    sanitized.photos = [];
    sanitized.primaryPhoto = null;
  }

  return sanitized as AssetDTO;
}

