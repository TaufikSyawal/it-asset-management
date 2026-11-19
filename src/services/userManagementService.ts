import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { UserRole, UserProfileDTO, UserRoleHistoryDTO } from "@/types";
import { getUserProfile } from "./authService";

/**
 * Fetch all enterprise user profiles
 */
export async function getUsers(): Promise<UserProfileDTO[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("user_profiles")
      .select(`
        id,
        email,
        name,
        role,
        all_companies,
        allowed_companies,
        employee_id,
        created_at,
        updated_at,
        employee:employees (
          id,
          employee_id,
          name,
          department
        )
      `)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching user profiles:", error);
      throw error;
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role as UserRole,
      allCompanies: row.all_companies || false,
      allowedCompanies: row.allowed_companies || [],
      employeeId: row.employee_id,
      isActive: row.is_active !== false,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      employee: row.employee
        ? {
            id: row.employee.id,
            employeeId: row.employee.employee_id,
            name: row.employee.name,
            department: row.employee.department,
          }
        : null,
    }));
  } catch (err) {
    console.error("Failed to fetch users from database:", err);
    throw err;
  }
}

/**
 * Update user role, company scope, and profile attributes
 */
export async function updateUserProfile(
  userId: string,
  updates: {
    name?: string;
    role?: UserRole;
    allCompanies?: boolean;
    allowedCompanies?: string[];
    employeeId?: string | null;
    isActive?: boolean;
  },
  currentUserId?: string
): Promise<{ success: boolean; error?: string | null }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: "Database is not configured." };
  }

  try {
    // 1. Safety check: protect last active Super Admin
    if (updates.role && updates.role !== "SUPER_ADMIN") {
      const { data: targetUser } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", userId)
        .single();

      if (targetUser?.role === "SUPER_ADMIN") {
        const { count: adminCount } = await supabase
          .from("user_profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "SUPER_ADMIN")
          .neq("id", userId);

        if ((adminCount || 0) === 0) {
          return {
            success: false,
            error: "Security Protection: Cannot demote the last remaining Super Admin account.",
          };
        }
      }
    }

    if (updates.isActive === false) {
      const { data: targetUser } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", userId)
        .single();

      if (targetUser?.role === "SUPER_ADMIN") {
        const { count: activeAdminCount } = await supabase
          .from("user_profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "SUPER_ADMIN")
          .neq("id", userId);

        if ((activeAdminCount || 0) === 0) {
          return {
            success: false,
            error: "Security Protection: Cannot deactivate the last remaining Super Admin account.",
          };
        }
      }
    }

    // 2. Fetch old profile for audit logging
    const { data: oldProfile } = await supabase
      .from("user_profiles")
      .select("role, all_companies, allowed_companies, is_active")
      .eq("id", userId)
      .single();

    // 3. Build update payload
    const payload: any = {
      updated_at: new Date().toISOString(),
    };
    if (updates.name !== undefined) payload.name = updates.name.trim();
    if (updates.role !== undefined) payload.role = updates.role;
    if (updates.allCompanies !== undefined) payload.all_companies = updates.allCompanies;
    if (updates.allowedCompanies !== undefined) payload.allowed_companies = updates.allowedCompanies;
    if (updates.employeeId !== undefined) payload.employee_id = updates.employeeId;
    if (updates.isActive !== undefined) payload.is_active = updates.isActive;

    const { error: updateError } = await supabase
      .from("user_profiles")
      .update(payload)
      .eq("id", userId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // 4. Log role change history if role or company scope changed
    const roleChanged = updates.role && oldProfile && updates.role !== oldProfile.role;
    const scopeChanged =
      (updates.allCompanies !== undefined && updates.allCompanies !== oldProfile?.all_companies) ||
      (updates.allowedCompanies !== undefined &&
        JSON.stringify(updates.allowedCompanies.sort()) !== JSON.stringify((oldProfile?.allowed_companies || []).sort()));

    if (roleChanged || scopeChanged || updates.isActive !== undefined) {
      try {
        await supabase.from("user_role_history").insert({
          user_id: userId,
          changed_by: currentUserId || null,
          old_role: oldProfile?.role || null,
          new_role: updates.role || oldProfile?.role,
          old_all_companies: oldProfile?.all_companies ?? false,
          new_all_companies: updates.allCompanies !== undefined ? updates.allCompanies : (oldProfile?.all_companies ?? false),
          old_allowed_companies: oldProfile?.allowed_companies || [],
          new_allowed_companies: updates.allowedCompanies || oldProfile?.allowed_companies || [],
          old_is_active: oldProfile?.is_active ?? true,
          new_is_active: updates.isActive !== undefined ? updates.isActive : (oldProfile?.is_active ?? true),
          notes: "Updated by Super Admin via User Management console",
        });
      } catch (auditErr) {
        // Table may not exist yet if migration pending approval
        console.warn("User role audit log notice:", auditErr);
      }
    }

    // 5. Invalidate current session cache if the user modified their own profile
    if (currentUserId && currentUserId === userId) {
      await getUserProfile(userId);
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update user profile." };
  }
}

/**
 * Invite / Create new user via secure backend Edge Function
 * Administrative operations strictly require Super Admin authorization on backend
 */
export async function inviteUser(payload: {
  email: string;
  name?: string;
  role: UserRole;
  allCompanies: boolean;
  allowedCompanies: string[];
}): Promise<{ success: boolean; message?: string; error?: string | null }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: "Database is not configured." };
  }

  const cleanEmail = payload.email.trim().toLowerCase();
  const cleanName = payload.name?.trim() || cleanEmail.split("@")[0];

  try {
    const { data: edgeRes, error: edgeErr } = await supabase.functions.invoke("admin-user-ops", {
      body: {
        action: "invite_user",
        email: cleanEmail,
        name: cleanName,
        role: payload.role,
        allCompanies: payload.allCompanies,
        allowedCompanies: payload.allowedCompanies,
      },
    });

    if (edgeErr || !edgeRes || edgeRes.error) {
      const errMsg = edgeRes?.error || edgeErr?.message || "Failed to invite user via administrative Edge Function.";
      console.error("Administrative Edge Function error during invite:", errMsg);
      return {
        success: false,
        error: errMsg,
      };
    }

    return {
      success: true,
      message: edgeRes.message || `Invitation successfully sent to ${cleanEmail}.`,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to invite user via administrative Edge Function." };
  }
}

/**
 * Initiate administrative password reset for a user via secure backend Edge Function
 */
export async function resetUserPassword(email: string): Promise<{ success: boolean; message?: string; error?: string | null }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: "Database is not configured." };
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    const { data: edgeRes, error: edgeErr } = await supabase.functions.invoke("admin-user-ops", {
      body: {
        action: "reset_password",
        email: cleanEmail,
      },
    });

    if (edgeErr || !edgeRes || edgeRes.error) {
      const errMsg = edgeRes?.error || edgeErr?.message || "Administrative password reset failed.";
      console.error("Administrative Edge Function error during password reset:", errMsg);
      return {
        success: false,
        error: errMsg,
      };
    }

    return {
      success: true,
      message: edgeRes.message || `Password recovery email dispatched for ${cleanEmail}.`,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to initiate administrative password reset." };
  }
}

/**
 * Toggle user active/deactivated status
 * Coordinates with Edge Function for Auth ban duration and database profile status
 */
export async function toggleUserStatus(
  userId: string,
  isActive: boolean,
  currentUserId?: string
): Promise<{ success: boolean; error?: string | null }> {
  try {
    const { data: edgeRes, error: edgeErr } = await supabase.functions.invoke("admin-user-ops", {
      body: {
        action: "toggle_user_status",
        userId,
        isActive,
      },
    });

    if (edgeErr || !edgeRes || edgeRes.error) {
      const errMsg = edgeRes?.error || edgeErr?.message;
      // If error indicates last Super Admin protection, abort immediately
      if (errMsg && errMsg.toLowerCase().includes("super admin")) {
        return { success: false, error: errMsg };
      }
    }
  } catch (err: any) {
    console.warn("Edge function status sync note:", err.message);
  }

  return updateUserProfile(userId, { isActive }, currentUserId);
}

/**
 * Fetch role and permission change history for a user
 */
export async function getUserRoleHistory(userId: string): Promise<UserRoleHistoryDTO[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("user_role_history")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Could not fetch user role history (table may be pending migration):", error.message);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      changedBy: row.changed_by,
      changedByName: row.changed_by_name,
      oldRole: row.old_role as UserRole,
      newRole: row.new_role as UserRole,
      oldAllCompanies: row.old_all_companies,
      newAllCompanies: row.new_all_companies,
      oldAllowedCompanies: row.old_allowed_companies || [],
      newAllowedCompanies: row.new_allowed_companies || [],
      oldIsActive: row.old_is_active,
      newIsActive: row.new_is_active,
      notes: row.notes,
      createdAt: row.created_at,
    }));
  } catch {
    return [];
  }
}
