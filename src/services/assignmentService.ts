import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { AssignmentAction, PhysicalCondition, AssetAssignmentDTO } from "@/types";

export interface PerformAssignmentParams {
  assetId: string;
  actionType: AssignmentAction;
  employeeId?: string | null;
  condition?: PhysicalCondition;
  handoverDocRef?: string | null;
  notes?: string | null;
}

export async function performAssignment(
  params: PerformAssignmentParams
): Promise<{ success: boolean; data?: any; error: string | null }> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.rpc("perform_asset_assignment", {
        p_asset_id: params.assetId,
        p_action_type: params.actionType,
        p_employee_id: params.employeeId || null,
        p_condition: params.condition || "GOOD",
        p_handover_doc_ref: params.handoverDocRef || null,
        p_notes: params.notes || null,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data, error: null };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to execute assignment RPC" };
    }
  }

  // Fallback to local API
  try {
    const res = await fetch(`/api/assets/${params.assetId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actionType: params.actionType,
        employeeId: params.employeeId,
        conditionAtAction: params.condition,
        handoverDocRef: params.handoverDocRef,
        notes: params.notes,
      }),
    });

    const json = await res.json();
    if (res.ok) {
      return { success: true, data: json, error: null };
    }
    return { success: false, error: json.error || "Failed to execute assignment" };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getAssignments(assetId?: string, limit = 50): Promise<AssetAssignmentDTO[]> {
  if (isSupabaseConfigured()) {
    try {
      let query = supabase
        .from("asset_assignments")
        .select(`
          *,
          employee:employees (id, employee_id, name, department),
          asset:assets (id, asset_tag, asset_name)
        `)
        .order("assigned_at", { ascending: false })
        .limit(limit);

      if (assetId) {
        query = query.eq("asset_id", assetId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((a: any) => ({
        id: a.id,
        assetId: a.asset_id,
        employeeId: a.employee_id,
        employee: a.employee,
        actionType: a.action_type,
        conditionAtAction: a.condition_at_action,
        assignedAt: a.assigned_at,
        returnedAt: a.returned_at,
        performedBy: a.performed_by,
        handoverDocRef: a.handover_doc_ref,
        notes: a.notes,
      }));
    } catch (err) {
      console.error("Error querying assignments from Supabase:", err);
    }
  }

  return [];
}

