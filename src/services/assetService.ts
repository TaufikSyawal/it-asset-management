import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { AssetDTO, AssetFilters, CompanyDTO, EmployeeDTO, AssetPhotoDTO } from "@/types";

/**
 * Transforms snake_case database record to camelCase AssetDTO
 */
export function mapRowToAssetDTO(row: any): AssetDTO {
  const photos: AssetPhotoDTO[] = (row.photos || []).map((p: any) => ({
    id: p.id,
    assetId: p.asset_id || row.id,
    category: p.category,
    fileKey: p.file_key,
    thumbnailKey: p.thumbnail_key,
    originalFilename: p.original_filename,
    mimeType: p.mime_type,
    fileSize: p.file_size,
    width: p.width,
    height: p.height,
    description: p.description,
    isPrimary: p.is_primary,
    assignmentId: p.assignment_id,
    uploadedBy: p.uploaded_by,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    url: p.file_key ? supabase.storage.from("asset-photos").getPublicUrl(p.file_key).data.publicUrl : "",
    thumbnailUrl: p.thumbnail_key
      ? supabase.storage.from("asset-photos").getPublicUrl(p.thumbnail_key).data.publicUrl
      : p.file_key
      ? supabase.storage.from("asset-photos").getPublicUrl(p.file_key).data.publicUrl
      : "",
  }));

  const primaryPhoto = photos.find((p) => p.isPrimary) || photos[0] || null;

  return {
    id: row.id,
    assetTag: row.asset_tag,
    isDuplicateTag: !!row.is_duplicate_tag,
    assetName: row.asset_name,
    companyId: row.company_id,
    company: row.company
      ? {
          id: row.company.id || row.company_id,
          code: row.company.code || "",
          name: row.company.name || "",
          description: row.company.description,
        }
      : ({ id: row.company_id, code: "", name: "" } as CompanyDTO),
    category: row.category,
    model: row.model,
    cpu: row.cpu,
    ram: row.ram,
    serialNumber: row.serial_number,
    macAddress: row.mac_address,
    status: row.status,
    physicalCondition: row.physical_condition,
    assignedEmployeeId: row.assigned_employee_id,
    assignedEmployee: row.assignedEmployee
      ? {
          id: row.assignedEmployee.id || row.assigned_employee_id,
          employeeId: row.assignedEmployee.employee_id || "",
          name: row.assignedEmployee.name || "",
          email: row.assignedEmployee.email,
          department: row.assignedEmployee.department,
          companyId: row.assignedEmployee.company_id || row.company_id,
          status: row.assignedEmployee.status || "ACTIVE",
        }
      : null,
    location: row.location,
    purchaseDate: row.purchase_date,
    purchaseCost: row.purchase_cost !== null && row.purchase_cost !== undefined ? Number(row.purchase_cost) : undefined,
    usefulLifeMonths: row.useful_life_months,
    depreciationMethod: row.depreciation_method,
    accumulatedDepreciation:
      row.accumulated_depreciation !== null && row.accumulated_depreciation !== undefined
        ? Number(row.accumulated_depreciation)
        : undefined,
    netBookValue:
      row.net_book_value !== null && row.net_book_value !== undefined ? Number(row.net_book_value) : undefined,
    depreciationStartDate: row.depreciation_start_date,
    laptopCode: row.laptop_code,
    laptopAccount: row.laptop_account,
    username: row.username,
    notes: row.notes,
    qrCodeToken: row.qr_code_token,
    isArchived: !!row.is_archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    photos,
    primaryPhoto,
    assignments: (row.assignments || []).map((a: any) => ({
      id: a.id,
      assetId: a.asset_id || row.id,
      employeeId: a.employee_id,
      employee: a.employee
        ? {
            id: a.employee.id || a.employee_id,
            employeeId: a.employee.employee_id || "",
            name: a.employee.name || "",
            email: a.employee.email,
            department: a.employee.department,
            companyId: a.employee.company_id || row.company_id,
            status: a.employee.status || "ACTIVE",
          }
        : null,
      actionType: a.action_type,
      conditionAtAction: a.condition_at_action,
      assignedAt: a.assigned_at,
      returnedAt: a.returned_at,
      performedBy: a.performed_by,
      handoverDocRef: a.handover_doc_ref,
      notes: a.notes,
    })),
    historyLogs: (row.historyLogs || []).map((h: any) => ({
      id: h.id,
      assetId: h.asset_id || row.id,
      action: h.action,
      changes: h.changes,
      notes: h.notes,
      performedBy: h.performed_by,
      createdAt: h.created_at,
    })),
  };
}

export interface AssetsQueryResult {
  assets: AssetDTO[];
  total: number;
  page: number;
  totalPages: number;
  stats: any;
}

/**
 * Fetch paginated assets with filtering and executive stats
 */
export async function getAssets(filters: AssetFilters): Promise<AssetsQueryResult> {
  const page = filters.page || 1;
  const limit = filters.limit || 15;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  if (isSupabaseConfigured()) {
    try {
      // Build main query on assets_view
      let query = supabase
        .from("assets_view")
        .select(
          `
          *,
          company:companies (id, code, name),
          assignedEmployee:employees (id, employee_id, name, department),
          photos:asset_photos (*)
        `,
          { count: "exact" }
        )
        .eq("is_archived", false);

      if (filters.companyId && filters.companyId !== "ALL") {
        query = query.eq("company_id", filters.companyId);
      }
      if (filters.status && filters.status !== "ALL") {
        query = query.eq("status", filters.status);
      }
      if (filters.category && filters.category !== "ALL") {
        query = query.eq("category", filters.category);
      }
      if (filters.isDuplicateTag) {
        query = query.eq("is_duplicate_tag", true);
      }
      if (filters.search && filters.search.trim()) {
        const s = `%${filters.search.trim()}%`;
        query = query.or(`asset_name.ilike.${s},asset_tag.ilike.${s},model.ilike.${s},serial_number.ilike.${s}`);
      }

      query = query.order("created_at", { ascending: false }).range(from, to);

      const { data, count, error } = await query;
      if (error) {
        console.error("Supabase assets query error:", error);
        throw error;
      }

      const total = count || 0;
      const totalPages = Math.ceil(total / limit) || 1;
      const assets = (data || []).map(mapRowToAssetDTO);

      // Compute statistics over current company scope
      const stats = await computeStats(filters.companyId);

      return {
        assets,
        total,
        page,
        totalPages,
        stats,
      };
    } catch (err) {
      console.error("Failed to fetch assets from Supabase:", err);
    }
  }

  // Fallback to local Next.js route handler
  try {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.companyId && filters.companyId !== "ALL") params.set("companyId", filters.companyId);
    if (filters.status && filters.status !== "ALL") params.set("status", filters.status);
    if (filters.category && filters.category !== "ALL") params.set("category", filters.category);
    if (filters.isDuplicateTag) params.set("isDuplicateTag", "true");
    params.set("page", String(page));
    params.set("limit", String(limit));

    const res = await fetch(`/api/assets?${params.toString()}`);
    if (res.ok) {
      const json = await res.json();
      return {
        assets: json.assets || [],
        total: json.total || 0,
        page: json.page || 1,
        totalPages: json.totalPages || 1,
        stats: json.stats || null,
      };
    }
  } catch (err) {
    console.warn("Fallback /api/assets error:", err);
  }

  return {
    assets: [],
    total: 0,
    page: 1,
    totalPages: 1,
    stats: null,
  };
}

/**
 * Fetch single asset with assignment history, photos, and immutable audit logs
 */
export async function getAssetById(id: string): Promise<AssetDTO | null> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from("assets_view")
        .select(`
          *,
          company:companies (id, code, name),
          assignedEmployee:employees (id, employee_id, name, department),
          photos:asset_photos (*),
          assignments:asset_assignments (*, employee:employees(id, employee_id, name, department)),
          historyLogs:asset_histories (*)
        `)
        .eq("id", id)
        .single();

      if (error || !data) {
        console.error("Error fetching asset by id from Supabase:", error);
        return null;
      }

      // Sort assignments and history logs by date descending
      if (Array.isArray(data.assignments)) {
        data.assignments.sort(
          (a: any, b: any) => new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime()
        );
      }
      if (Array.isArray(data.historyLogs)) {
        data.historyLogs.sort(
          (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }

      return mapRowToAssetDTO(data);
    } catch (err) {
      console.error("Failed to query asset details:", err);
    }
  }

  // Fallback
  try {
    const res = await fetch(`/api/assets/${id}`);
    if (res.ok) {
      const json = await res.json();
      return json.asset || null;
    }
  } catch (err) {
    console.warn("Fallback /api/assets/[id] error:", err);
  }

  return null;
}

/**
 * Create a new asset record
 */
export async function createAsset(payload: any): Promise<{ asset: AssetDTO | null; error: string | null }> {
  if (isSupabaseConfigured()) {
    try {
      const assetId = `ast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const insertData = {
        id: assetId,
        asset_tag: payload.assetTag.trim(),
        is_duplicate_tag: !!payload.isDuplicateTag,
        asset_name: payload.assetName.trim(),
        company_id: payload.companyId,
        category: payload.category,
        model: payload.model.trim(),
        cpu: payload.cpu.trim(),
        ram: payload.ram.trim(),
        serial_number: payload.serialNumber?.trim() || null,
        mac_address: payload.macAddress?.trim() || null,
        status: payload.status || "AVAILABLE",
        physical_condition: payload.physicalCondition || "GOOD",
        assigned_employee_id: payload.assignedEmployeeId || null,
        location: payload.location.trim(),
        purchase_date: payload.purchaseDate || null,
        purchase_cost: payload.purchaseCost ? Number(payload.purchaseCost) : null,
        useful_life_months: payload.usefulLifeMonths ? Number(payload.usefulLifeMonths) : null,
        depreciation_method: payload.depreciationMethod || "STRAIGHT_LINE",
        laptop_code: payload.laptopCode?.trim() || null,
        laptop_account: payload.laptopAccount?.trim() || null,
        username: payload.username?.trim() || null,
        notes: payload.notes?.trim() || null,
        qr_code_token: `QR-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        is_archived: false,
      };

      const { data, error } = await supabase.from("assets").insert(insertData).select().single();
      if (error) {
        return { asset: null, error: error.message };
      }

      // Add audit history log
      await supabase.from("asset_histories").insert({
        id: `hst_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        asset_id: assetId,
        action: "CREATE",
        changes: insertData,
        notes: "Asset registered into inventory",
      });

      const fullAsset = await getAssetById(assetId);
      return { asset: fullAsset, error: null };
    } catch (err: any) {
      return { asset: null, error: err.message || "Failed to create asset" };
    }
  }

  // Fallback
  try {
    const res = await fetch("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (res.ok) {
      return { asset: json.asset, error: null };
    }
    return { asset: null, error: json.error || "Failed to create asset" };
  } catch (err: any) {
    return { asset: null, error: err.message };
  }
}

/**
 * Update an existing asset record
 */
export async function updateAsset(id: string, payload: any): Promise<{ asset: AssetDTO | null; error: string | null }> {
  if (isSupabaseConfigured()) {
    try {
      const updateData: any = {};
      if (payload.assetTag !== undefined) updateData.asset_tag = payload.assetTag.trim();
      if (payload.isDuplicateTag !== undefined) updateData.is_duplicate_tag = payload.isDuplicateTag;
      if (payload.assetName !== undefined) updateData.asset_name = payload.assetName.trim();
      if (payload.companyId !== undefined) updateData.company_id = payload.companyId;
      if (payload.category !== undefined) updateData.category = payload.category;
      if (payload.model !== undefined) updateData.model = payload.model.trim();
      if (payload.cpu !== undefined) updateData.cpu = payload.cpu.trim();
      if (payload.ram !== undefined) updateData.ram = payload.ram.trim();
      if (payload.serialNumber !== undefined) updateData.serial_number = payload.serialNumber?.trim() || null;
      if (payload.macAddress !== undefined) updateData.mac_address = payload.macAddress?.trim() || null;
      if (payload.status !== undefined) updateData.status = payload.status;
      if (payload.physicalCondition !== undefined) updateData.physical_condition = payload.physicalCondition;
      if (payload.assignedEmployeeId !== undefined) updateData.assigned_employee_id = payload.assignedEmployeeId || null;
      if (payload.location !== undefined) updateData.location = payload.location.trim();
      if (payload.purchaseDate !== undefined) updateData.purchase_date = payload.purchaseDate || null;
      if (payload.purchaseCost !== undefined) updateData.purchase_cost = payload.purchaseCost ? Number(payload.purchaseCost) : null;
      if (payload.usefulLifeMonths !== undefined) updateData.useful_life_months = payload.usefulLifeMonths ? Number(payload.usefulLifeMonths) : null;
      if (payload.depreciationMethod !== undefined) updateData.depreciation_method = payload.depreciationMethod;
      if (payload.laptopCode !== undefined) updateData.laptop_code = payload.laptopCode?.trim() || null;
      if (payload.laptopAccount !== undefined) updateData.laptop_account = payload.laptopAccount?.trim() || null;
      if (payload.username !== undefined) updateData.username = payload.username?.trim() || null;
      if (payload.notes !== undefined) updateData.notes = payload.notes?.trim() || null;

      const { error } = await supabase.from("assets").update(updateData).eq("id", id);
      if (error) {
        return { asset: null, error: error.message };
      }

      // Record audit log
      await supabase.from("asset_histories").insert({
        id: `hst_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        asset_id: id,
        action: "UPDATE",
        changes: updateData,
        notes: "Asset specifications updated",
      });

      const updated = await getAssetById(id);
      return { asset: updated, error: null };
    } catch (err: any) {
      return { asset: null, error: err.message || "Failed to update asset" };
    }
  }

  // Fallback
  try {
    const res = await fetch(`/api/assets/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (res.ok) {
      return { asset: json.asset, error: null };
    }
    return { asset: null, error: json.error || "Failed to update asset" };
  } catch (err: any) {
    return { asset: null, error: err.message };
  }
}

/**
 * Soft-archive asset record (never permanently delete)
 */
export async function archiveAsset(id: string): Promise<{ success: boolean; error: string | null }> {
  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase
        .from("assets")
        .update({ is_archived: true, status: "ARCHIVED" })
        .eq("id", id);

      if (error) {
        return { success: false, error: error.message };
      }

      await supabase.from("asset_histories").insert({
        id: `hst_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        asset_id: id,
        action: "ARCHIVE",
        notes: "Asset soft-archived from active inventory",
      });

      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // Fallback
  try {
    const res = await fetch(`/api/assets/${id}`, { method: "DELETE" });
    if (res.ok) {
      return { success: true, error: null };
    }
    const json = await res.json();
    return { success: false, error: json.error || "Failed to archive asset" };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Compute executive & operational stats across active company scope
 */
async function computeStats(companyId?: string) {
  try {
    let query = supabase
      .from("assets_view")
      .select("id, status, physical_condition, is_duplicate_tag, category, purchase_cost, net_book_value")
      .eq("is_archived", false);

    if (companyId && companyId !== "ALL") {
      query = query.eq("company_id", companyId);
    }

    const { data: rows, error } = await query;
    if (error || !rows) return null;

    let inUse = 0;
    let available = 0;
    let maintenance = 0;
    let archived = 0;
    let disposed = 0;
    let missing = 0;

    let excellent = 0;
    let good = 0;
    let fair = 0;
    let poor = 0;
    let damaged = 0;

    let totalPurchaseCost = 0;
    let totalNetBookValue = 0;
    let hasFinancials = false;

    const categoryMap: Record<string, number> = {};
    const attentionAssetIds = new Set<string>();

    for (const r of rows) {
      // Status
      if (r.status === "IN_USE") inUse++;
      else if (r.status === "AVAILABLE") available++;
      else if (r.status === "MAINTENANCE") maintenance++;
      else if (r.status === "ARCHIVED") archived++;
      else if (r.status === "DISPOSED") disposed++;
      else if (r.status === "MISSING") missing++;

      // Condition
      if (r.physical_condition === "EXCELLENT") excellent++;
      else if (r.physical_condition === "GOOD") good++;
      else if (r.physical_condition === "FAIR") fair++;
      else if (r.physical_condition === "POOR") poor++;
      else if (r.physical_condition === "DAMAGED") damaged++;

      // Category
      categoryMap[r.category] = (categoryMap[r.category] || 0) + 1;

      // Attention required (distinct count)
      if (
        r.status === "MAINTENANCE" ||
        r.physical_condition === "POOR" ||
        r.physical_condition === "DAMAGED" ||
        r.is_duplicate_tag
      ) {
        attentionAssetIds.add(r.id);
      }

      // Financials (if permitted)
      if (r.purchase_cost !== null && r.purchase_cost !== undefined) {
        hasFinancials = true;
        totalPurchaseCost += Number(r.purchase_cost);
      }
      if (r.net_book_value !== null && r.net_book_value !== undefined) {
        hasFinancials = true;
        totalNetBookValue += Number(r.net_book_value);
      }
    }

    const byCategory = Object.entries(categoryMap).map(([category, count]) => ({
      category,
      count,
    }));

    return {
      totalAssets: rows.length,
      inUse,
      available,
      maintenance,
      archived,
      disposed,
      missing,
      requiringAttention: attentionAssetIds.size,
      byCondition: {
        EXCELLENT: excellent,
        GOOD: good,
        FAIR: fair,
        POOR: poor,
        DAMAGED: damaged,
      },
      byCategory,
      financials: hasFinancials
        ? {
            totalPurchaseCost,
            totalNetBookValue,
          }
        : null,
    };
  } catch (err) {
    console.error("Error computing stats:", err);
    return null;
  }
}
