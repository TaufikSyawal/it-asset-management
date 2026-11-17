import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { CompanyDTO } from "@/types";

export async function getCompanies(): Promise<CompanyDTO[]> {
  if (isSupabaseConfigured()) {
    try {
      const { data: companies, error } = await supabase
        .from("companies")
        .select("id, code, name, description")
        .order("code", { ascending: true });

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

      return (companies || []).map((c) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        description: c.description,
        _count: {
          assets: countMap[c.id] || 0,
          employees: 0,
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
      return json.companies || [];
    }
  } catch (err) {
    console.warn("Fallback /api/companies error:", err);
  }

  return [];
}

