import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { UserRole, UserSession } from "@/types";

export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Sign in using Supabase Auth (Email + Password)
 */
export async function signIn(credentials: LoginCredentials): Promise<{ user: UserSession | null; error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { user: null, error: "Supabase credentials are not configured in environment." };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: credentials.email.trim().toLowerCase(),
    password: credentials.password,
  });

  if (error || !data.user) {
    return { user: null, error: error?.message || "Invalid email or password." };
  }

  // Retrieve user profile with multi-company scopes and role
  const profile = await getUserProfile(data.user.id);
  if (!profile) {
    return { user: null, error: "Authenticated user has no matching system profile. Contact your Super Admin." };
  }

  return { user: profile, error: null };
}

/**
 * Sign out current session
 */
export async function signOut(): Promise<void> {
  if (isSupabaseConfigured()) {
    await supabase.auth.signOut();
  }
}

/**
 * Get current authenticated user profile
 */
export async function getUserProfile(userId?: string): Promise<UserSession | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    let targetId = userId;
    if (!targetId) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return null;
      targetId = session.user.id;
    }

    const { data, error } = await supabase
      .from("user_profiles")
      .select("id, email, name, role, all_companies, allowed_companies, employee_id")
      .eq("id", targetId)
      .single();

    if (error || !data) {
      console.warn("Could not retrieve user profile:", error);
      return null;
    }

    return {
      id: data.id,
      email: data.email,
      name: data.name,
      role: data.role as UserRole,
      allCompanies: data.all_companies,
      allowedCompanies: data.allowed_companies || [],
      employeeId: data.employee_id,
    };
  } catch (err) {
    console.error("Error fetching user profile:", err);
    return null;
  }
}

/**
 * Listen to auth state changes (sign in, sign out, token refresh)
 */
export function onAuthStateChange(callback: (user: UserSession | null) => void) {
  if (!isSupabaseConfigured()) {
    return { unsubscribe: () => {} };
  }

  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      const profile = await getUserProfile(session.user.id);
      callback(profile);
    } else {
      callback(null);
    }
  });

  return {
    unsubscribe: () => subscription.unsubscribe(),
  };
}

