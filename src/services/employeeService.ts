import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { EmployeeDTO } from "@/types";

export async function getEmployees(companyId?: string): Promise<EmployeeDTO[]> {
  if (isSupabaseConfigured()) {
    try {
      let query = supabase
        .from("employees")
        .select(`
          id,
          employee_id,
          name,
          email,
          department,
          company_id,
          status,
          company:companies (
            code,
            name
          )
        `)
        .order("name", { ascending: true });

      if (companyId && companyId !== "ALL") {
        query = query.eq("company_id", companyId);
      }

      const { data, error } = await query;
      if (error) {
        console.error("Error fetching employees from Supabase:", error);
        throw error;
      }

      return (data || []).map((e: any) => ({
        id: e.id,
        employeeId: e.employee_id,
        name: e.name,
        email: e.email,
        department: e.department,
        companyId: e.company_id,
        status: e.status || "ACTIVE",
        company: e.company ? { code: e.company.code, name: e.company.name } : undefined,
      }));
    } catch (err) {
      console.error("Failed to query employees via Supabase:", err);
    }
  }

  // Local development fallback
  try {
    const params = new URLSearchParams();
    if (companyId && companyId !== "ALL") params.set("companyId", companyId);
    const res = await fetch(`/api/employees?${params.toString()}`);
    if (res.ok) {
      const json = await res.json();
      return json.employees || [];
    }
  } catch (err) {
    console.warn("Fallback /api/employees error:", err);
  }

  return [];
}

export async function createEmployee(payload: {
  employeeId: string;
  name: string;
  email?: string;
  department?: string;
  companyId: string;
}): Promise<{ employee: EmployeeDTO | null; error: string | null }> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from("employees")
        .insert({
          id: `emp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          employee_id: payload.employeeId.trim(),
          name: payload.name.trim(),
          email: payload.email?.trim() || null,
          department: payload.department?.trim() || null,
          company_id: payload.companyId,
          status: "ACTIVE",
        })
        .select(`
          id,
          employee_id,
          name,
          email,
          department,
          company_id,
          status,
          company:companies (
            code,
            name
          )
        `)
        .single();

      if (error) {
        return { employee: null, error: error.message };
      }

      const comp = Array.isArray(data.company) ? data.company[0] : data.company;
      return {
        employee: {
          id: data.id,
          employeeId: data.employee_id,
          name: data.name,
          email: data.email,
          department: data.department,
          companyId: data.company_id,
          status: data.status,
          company: comp ? { code: comp.code, name: comp.name } : undefined,
        },
        error: null,
      };
    } catch (err: any) {
      return { employee: null, error: err.message || "Failed to create employee" };
    }
  }

  // Fallback
  try {
    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (res.ok) {
      return { employee: json.employee, error: null };
    }
    return { employee: null, error: json.error || "Failed to create employee" };
  } catch (err: any) {
    return { employee: null, error: err.message };
  }
}
