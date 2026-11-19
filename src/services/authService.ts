import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { UserRole, UserSession } from "@/types";

export interface LoginCredentials {
  email: string;
  password: string;
}

const CACHE_KEY = "itams_user_session_cache";

function getStoredProfile(): UserSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function setStoredProfile(profile: UserSession | null) {
  if (typeof window === "undefined") return;
  try {
    if (profile) {
      localStorage.setItem(CACHE_KEY, JSON.stringify(profile));
    } else {
      localStorage.removeItem(CACHE_KEY);
    }
  } catch {}
}

let memoryProfile: UserSession | null = null;

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

  memoryProfile = profile;
  setStoredProfile(profile);

  return { user: profile, error: null };
}

/**
 * Sign out current session
 */
export async function signOut(): Promise<void> {
  memoryProfile = null;
  setStoredProfile(null);
  if (isSupabaseConfigured()) {
    await supabase.auth.signOut();
  }
}

/**
 * Get current authenticated user profile
 * Resilient against temporary network drops and database glitches:
 * if an active Supabase Auth session exists, falls back to cached profile
 * to NEVER log the user out due to a transient database query failure.
 */
export async function getUserProfile(userId?: string): Promise<UserSession | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    let targetId = userId;
    if (!targetId) {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.warn("Error checking session:", sessionError.message);
      }
      if (!session?.user) {
        memoryProfile = null;
        setStoredProfile(null);
        return null;
      }
      targetId = session.user.id;
    }

    const { data, error } = await supabase
      .from("user_profiles")
      .select("id, email, name, role, all_companies, allowed_companies, employee_id")
      .eq("id", targetId)
      .single();

    if (error || !data) {
      console.warn("Could not retrieve user profile from DB, falling back to cache:", error?.message);
      const cached = memoryProfile || getStoredProfile();
      if (cached && cached.id === targetId) {
        return cached;
      }
      return null;
    }

    const profile: UserSession = {
      id: data.id,
      email: data.email,
      name: data.name,
      role: data.role as UserRole,
      allCompanies: data.all_companies,
      allowedCompanies: data.allowed_companies || [],
      employeeId: data.employee_id,
    };

    memoryProfile = profile;
    setStoredProfile(profile);
    return profile;
  } catch (err) {
    console.error("Error fetching user profile:", err);
    const cached = memoryProfile || getStoredProfile();
    if (cached) return cached;
    return null;
  }
}

/**
 * Listen to auth state changes (sign in, sign out, token refresh)
 * Decoupled from synchronous event dispatch to prevent lock contention.
 */
export function onAuthStateChange(callback: (user: UserSession | null, event: string) => void) {
  if (!isSupabaseConfigured()) {
    return { unsubscribe: () => {} };
  }

  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    // Non-blocking dispatch outside synchronous auth handler to prevent Supabase lock contention
    setTimeout(async () => {
      try {
        if (event === "SIGNED_OUT" || !session) {
          memoryProfile = null;
          setStoredProfile(null);
          callback(null, event);
          return;
        }

        if (session.user) {
          const cached = memoryProfile || getStoredProfile();
          // On TOKEN_REFRESHED, reuse existing valid profile without redundant DB queries
          if (event === "TOKEN_REFRESHED" && cached && cached.id === session.user.id) {
            callback(cached, event);
            return;
          }

          const profile = await getUserProfile(session.user.id);
          if (profile) {
            callback(profile, event);
          } else if (cached && cached.id === session.user.id) {
            // Transient DB error; preserve current session
            callback(cached, event);
          }
        }
      } catch (err) {
        console.error("Error in onAuthStateChange handler:", err);
      }
    }, 0);
  });

  return {
    unsubscribe: () => subscription.unsubscribe(),
  };
}

