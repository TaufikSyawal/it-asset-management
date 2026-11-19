import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { UserRole, UserSession, ApprovalStatus } from "@/types";

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignUpParams {
  email: string;
  password: string;
  name: string;
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
 * Validates active status and approval status
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

  // Enforce account approval status
  if (profile.approvalStatus === "PENDING") {
    await signOut();
    return {
      user: null,
      error: "Your registration is currently pending Super Admin approval. You cannot access company assets or operational data until an administrator approves your account.",
    };
  }

  if (profile.approvalStatus === "REJECTED") {
    await signOut();
    return {
      user: null,
      error: "Your account registration has been declined by the Super Admin. Please contact your IT Administrator.",
    };
  }

  memoryProfile = profile;
  setStoredProfile(profile);

  return { user: profile, error: null };
}

/**
 * Register a new user account (Sign Up)
 * Automatically defaults to EMPLOYEE role with PENDING approval status and zero company access
 */
export async function signUp(params: SignUpParams): Promise<{ success: boolean; message?: string; error?: string | null }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: "Supabase credentials are not configured in environment." };
  }

  const cleanEmail = params.email.trim().toLowerCase();
  const cleanName = params.name.trim();

  if (!cleanName || cleanName.length < 2) {
    return { success: false, error: "Please enter your full name (minimum 2 characters)." };
  }

  if (!cleanEmail || !cleanEmail.includes("@") || !cleanEmail.includes(".")) {
    return { success: false, error: "Please enter a valid corporate email address." };
  }

  if (!params.password || params.password.length < 6) {
    return { success: false, error: "Password must be at least 6 characters in length." };
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: params.password,
      options: {
        data: {
          name: cleanName,
        },
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    // Automatically sign out immediately after signup so unapproved session does not remain active in browser
    await supabase.auth.signOut();
    memoryProfile = null;
    setStoredProfile(null);

    return {
      success: true,
      message: "Registration submitted successfully! Please check your email to verify your email address. Once verified, your account will be pending Super Admin approval before you can access the system.",
    };
  } catch (err: any) {
    return { success: false, error: err.message || "An unexpected error occurred during user registration." };
  }
}

/**
 * Request password recovery email
 */
export async function requestPasswordReset(email: string): Promise<{ success: boolean; message?: string; error?: string | null }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: "Supabase credentials are not configured in environment." };
  }

  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    return { success: false, error: "Please enter a valid corporate email address." };
  }

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail);
    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      message: `If an account is registered with ${cleanEmail}, a secure password reset link has been dispatched to your email address.`,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to initiate password reset request." };
  }
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
 * When forceRefresh is true, queries the database directly to ensure
 * up-to-date roles and multi-company scopes.
 */
export async function getUserProfile(userId?: string, forceRefresh: boolean = false): Promise<UserSession | null> {
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

    // Try fetching latest profile from database with resilient fallback
    // Core columns are guaranteed to exist across all migration states
    let { data, error } = await supabase
      .from("user_profiles")
      .select("id, email, name, role, all_companies, allowed_companies, employee_id")
      .eq("id", targetId)
      .single();

    if (error || !data) {
      // If profile is genuinely missing (PGRST116: row not found), immediately invalidate cache
      if (error?.code === "PGRST116") {
        console.warn("User profile not found in database (PGRST116). Invalidating session cache.");
        memoryProfile = null;
        setStoredProfile(null);
        return null;
      }

      // For network errors or database connection drops, preserve valid cached session
      const cached = memoryProfile || getStoredProfile();
      if (cached && cached.id === targetId && cached.isActive !== false) {
        console.warn("Transient database error while fetching profile, retaining active cache:", error?.message);
        return cached;
      }
      return null;
    }

    // Check is_active non-blockingly (resilient against missing is_active column on unmigrated databases)
    let isUserActive = true;
    try {
      const { data: activeCheck, error: activeErr } = await supabase
        .from("user_profiles")
        .select("is_active")
        .eq("id", targetId)
        .single();

      if (!activeErr && activeCheck && activeCheck.is_active === false) {
        isUserActive = false;
      }
    } catch {
      isUserActive = true;
    }

    // Immediate deactivation enforcement: if is_active is explicitly false, terminate session
    if (!isUserActive) {
      console.warn(`User account ${data.email} is deactivated. Revoking session access immediately.`);
      memoryProfile = null;
      setStoredProfile(null);
      await signOut();
      return null;
    }

    // Check approval_status non-blockingly (defaults to 'APPROVED' on unmigrated databases)
    let approvalStatus: ApprovalStatus = "APPROVED";
    try {
      const { data: statusCheck, error: statusErr } = await supabase
        .from("user_profiles")
        .select("approval_status")
        .eq("id", targetId)
        .single();

      if (!statusErr && statusCheck && statusCheck.approval_status) {
        approvalStatus = statusCheck.approval_status as ApprovalStatus;
      }
    } catch {
      approvalStatus = "APPROVED";
    }

    const profile: UserSession = {
      id: data.id,
      email: data.email,
      name: data.name,
      role: data.role as UserRole,
      allCompanies: data.all_companies || false,
      allowedCompanies: data.allowed_companies || [],
      employeeId: data.employee_id,
      isActive: isUserActive,
      approvalStatus,
    };

    memoryProfile = profile;
    setStoredProfile(profile);
    return profile;
  } catch (err) {
    console.error("Error fetching user profile:", err);
    if (!forceRefresh && typeof navigator !== "undefined" && !navigator.onLine) {
      const cached = memoryProfile || getStoredProfile();
      if (cached && cached.isActive !== false) return cached;
    }
    return null;
  }
}

/**
 * Force refresh the active user profile from database to eliminate stale cache
 */
export async function refreshCurrentSession(): Promise<UserSession | null> {
  return getUserProfile(undefined, true);
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

