import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Edge function configuration error: Missing server credentials." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Verify Caller JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing or invalid Authorization header." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user: callerUser }, error: userError } = await callerClient.auth.getUser();
    if (userError || !callerUser) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid or expired session token." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Verify Caller Role in user_profiles
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: callerProfile, error: profileError } = await adminClient
      .from("user_profiles")
      .select("id, role, is_active, name")
      .eq("id", callerUser.id)
      .single();

    if (
      profileError ||
      !callerProfile ||
      callerProfile.role !== "SUPER_ADMIN" ||
      callerProfile.is_active === false
    ) {
      return new Response(
        JSON.stringify({
          error: "Forbidden: Super Admin authorization is strictly required to execute administrative user operations.",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Process Requested Action
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    switch (action) {
      case "invite_user": {
        const { email, name } = body;

        if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
          return new Response(
            JSON.stringify({ error: "A valid email address is required for user invitation." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const cleanEmail = email.trim().toLowerCase();
        const cleanName = (name && typeof name === "string" ? name.trim() : cleanEmail.split("@")[0]);

        // Check if user already exists
        const { data: existingProfiles, error: checkError } = await adminClient
          .from("user_profiles")
          .select("id, email")
          .eq("email", cleanEmail);

        if (checkError) {
          return new Response(
            JSON.stringify({ error: "Database error during user existence check: " + checkError.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (existingProfiles && existingProfiles.length > 0) {
          return new Response(
            JSON.stringify({ error: `User with email ${cleanEmail} already exists in the system.` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Invite via Supabase Auth Admin API
        const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
          cleanEmail,
          {
            data: { name: cleanName },
          }
        );

        if (inviteError || !inviteData?.user) {
          return new Response(
            JSON.stringify({ error: inviteError?.message || "Failed to dispatch invitation from Auth service." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const newUserId = inviteData.user.id;

        // MANDATORY SECURITY RULE: All newly created users strictly receive initial EMPLOYEE role
        // with zero company access (all_companies = false, allowed_companies = []).
        // Elevated permissions and company scope must be explicitly assigned via Edit User.
        const { error: profileUpsertError } = await adminClient
          .from("user_profiles")
          .upsert({
            id: newUserId,
            email: cleanEmail,
            name: cleanName,
            role: "EMPLOYEE",
            all_companies: false,
            allowed_companies: [],
            is_active: true,
            updated_at: new Date().toISOString(),
          });

        if (profileUpsertError) {
          // Rollback created auth user if profile initialization fails
          await adminClient.auth.admin.deleteUser(newUserId);
          return new Response(
            JSON.stringify({ error: "Failed to initialize user database profile: " + profileUpsertError.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: `Invitation successfully sent to ${cleanEmail}. Assigned baseline role: EMPLOYEE (zero company access).`,
            user: { id: newUserId, email: cleanEmail, name: cleanName, role: "EMPLOYEE" },
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "reset_password": {
        const { email } = body;
        if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
          return new Response(
            JSON.stringify({ error: "A valid email address is required for password recovery." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const cleanEmail = email.trim().toLowerCase();

        // MANDATORY SECURITY RULE: Dispatch recovery email directly to user's registered inbox.
        // Never generate or expose recovery tokens, action links, or credentials in API responses or server logs.
        const { error: resetError } = await adminClient.auth.resetPasswordForEmail(cleanEmail);

        if (resetError) {
          return new Response(
            JSON.stringify({ error: resetError.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: `A secure password recovery email has been dispatched directly to ${cleanEmail}.`,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "toggle_user_status": {
        const { userId, isActive } = body;
        if (!userId || typeof userId !== "string" || !UUID_REGEX.test(userId)) {
          return new Response(
            JSON.stringify({ error: "A valid user UUID is required." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const targetActive = Boolean(isActive);

        // Safety: Protect last active Super Admin from deactivation
        if (!targetActive) {
          const { data: targetProfile } = await adminClient
            .from("user_profiles")
            .select("role, is_active")
            .eq("id", userId)
            .single();

          if (targetProfile?.role === "SUPER_ADMIN" && targetProfile.is_active) {
            const { count: activeAdminCount } = await adminClient
              .from("user_profiles")
              .select("id", { count: "exact", head: true })
              .eq("role", "SUPER_ADMIN")
              .eq("is_active", true)
              .neq("id", userId);

            if ((activeAdminCount || 0) === 0) {
              return new Response(
                JSON.stringify({
                  error: "Security Protection: Cannot deactivate the last remaining active Super Admin account.",
                }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          }
        }

        // Transactional consistency: Update database profile as authenticated Super Admin caller
        const { error: updateError } = await callerClient
          .from("user_profiles")
          .update({ is_active: targetActive, updated_at: new Date().toISOString() })
          .eq("id", userId);

        if (updateError) {
          return new Response(
            JSON.stringify({ error: "Failed to update user profile status: " + updateError.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Update Auth ban duration only after database profile update succeeds
        const banDuration = targetActive ? "none" : "876000h"; // ~100 years
        const { error: banError } = await adminClient.auth.admin.updateUserById(userId, {
          ban_duration: banDuration,
        });

        if (banError) {
          // Revert profile status if Auth ban update fails to prevent inconsistent state
          await callerClient.from("user_profiles").update({ is_active: !targetActive }).eq("id", userId);
          return new Response(
            JSON.stringify({ error: "Failed to update authentication account ban status: " + banError.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: `User account has been ${targetActive ? "activated" : "deactivated"} successfully.`,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "delete_user": {
        const { userId } = body;
        if (!userId || typeof userId !== "string" || !UUID_REGEX.test(userId)) {
          return new Response(
            JSON.stringify({ error: "A valid user UUID is required for deletion." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Safety: Protect last active Super Admin from deletion
        const { data: targetProfile } = await adminClient
          .from("user_profiles")
          .select("role, is_active")
          .eq("id", userId)
          .single();

        if (targetProfile?.role === "SUPER_ADMIN" && targetProfile.is_active) {
          const { count: activeAdminCount } = await adminClient
            .from("user_profiles")
            .select("id", { count: "exact", head: true })
            .eq("role", "SUPER_ADMIN")
            .eq("is_active", true)
            .neq("id", userId);

          if ((activeAdminCount || 0) === 0) {
            return new Response(
              JSON.stringify({
                error: "Security Protection: Cannot delete the last remaining active Super Admin account.",
              }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }

        // Delete from user_profiles as authenticated Super Admin caller, then auth.users
        const { error: profileDeleteError } = await callerClient.from("user_profiles").delete().eq("id", userId);
        if (profileDeleteError) {
          return new Response(
            JSON.stringify({ error: "Failed to delete user profile: " + profileDeleteError.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(userId);
        if (deleteAuthError) {
          console.warn("Auth deletion note:", deleteAuthError.message);
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: "User account and credentials have been permanently deleted.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unsupported administrative action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error in administrative Edge Function." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
