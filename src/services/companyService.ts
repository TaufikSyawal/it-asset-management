import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { CompanyDTO } from "@/types";

export async function getCompanies(includeInactive: boolean = false): Promise<CompanyDTO[]> {
  if (isSupabaseConfigured()) {
    try {
      let query = supabase
        .from("companies")
        .select("id, code, name, description, is_active")
        .order("code", { ascending: true });

      if (!includeInactive) {
        query = query.eq("is_active", true);
      }

      const { data: companies, error } = await query;

      if (error) {
        console.error("Error fetching companies from Supabase:", error);
        throw error;
      }

      // Fetch asset count per company to display badge in TopNav
      const { data: assetCounts } = await supabase
        .from("assets")
        .select("company_id")
        .eq("is_archived", false);

      const countMap: Record<string, number> = {};
      if (assetCounts) {
        for (const item of assetCounts) {
          countMap[item.company_id] = (countMap[item.company_id] || 0) + 1;
        }
      }

      // Fetch employee count per company
      const { data: empCounts } = await supabase
        .from("employees")
        .select("company_id")
        .eq("status", "ACTIVE");

      const empCountMap: Record<string, number> = {};
      if (empCounts) {
        for (const item of empCounts) {
          empCountMap[item.company_id] = (empCountMap[item.company_id] || 0) + 1;
        }
      }

      return (companies || []).map((c) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        description: c.description,
        isActive: c.is_active !== false,
        is_active: c.is_active !== false,
        _count: {
          assets: countMap[c.id] || 0,
          employees: empCountMap[c.id] || 0,
        },
      }));
    } catch (err) {
      console.error("Failed to query companies via Supabase:", err);
    }
  }

  // Local development fallback
  try {
    const res = await fetch("/api/companies");
    if (res.ok) {
      const json = await res.json();
      return (json.companies || []).map((c: any) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        description: c.description,
        isActive: c.isActive !== false && c.is_active !== false,
        is_active: c.isActive !== false && c.is_active !== false,
        _count: c._count || { assets: 0, employees: 0 },
      }));
    }
  } catch (err) {
    console.warn("Fallback /api/companies error:", err);
  }

  return [];
}

export async function createCompany(data: {
  code: string;
  name: string;
  description?: string;
}): Promise<CompanyDTO> {
  const cleanCode = data.code.trim().toUpperCase();
  const cleanName = data.name.trim();

  if (!cleanCode || !cleanName) {
    throw new Error("Company Code and Name are required.");
  }

  if (isSupabaseConfigured()) {
    const { data: created, error } = await supabase
      .from("companies")
      .insert({
        code: cleanCode,
        name: cleanName,
        description: data.description?.trim() || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating company in Supabase:", error);
      throw error;
    }

    return {
      id: created.id,
      code: created.code,
      name: created.name,
      description: created.description,
      isActive: true,
      is_active: true,
      _count: { assets: 0, employees: 0 },
    };
  }

  throw new Error("Company creation requires active backend connection.");
}

export async function updateCompany(
  id: string,
  updates: {
    name?: string;
    description?: string;
    is_active?: boolean;
  }
): Promise<void> {
  if (isSupabaseConfigured()) {
    const patch: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.name !== undefined) patch.name = updates.name.trim();
    if (updates.description !== undefined) patch.description = updates.description.trim() || null;
    if (updates.is_active !== undefined) patch.is_active = updates.is_active;

    const { error } = await supabase
      .from("companies")
      .update(patch)
      .eq("id", id);

    if (error) {
      console.error("Error updating company in Supabase:", error);
      throw error;
    }
    return;
  }

  throw new Error("Company update requires active backend connection.");
}

export async function toggleCompanyStatus(id: string, isActive: boolean): Promise<void> {
  return updateCompany(id, { is_active: isActive });
}
