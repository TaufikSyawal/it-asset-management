import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
        JSON.stringify({ error: "Edge function missing Supabase server credentials." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Verify Caller JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header." }),
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
        JSON.stringify({ error: "Invalid or expired session token." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Verify Caller Role in user_profiles
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: callerProfile, error: profileError } = await adminClient
      .from("user_profiles")
      .select("id, role, is_active")
      .eq("id", callerUser.id)
      .single();

    if (profileError || !callerProfile || callerProfile.role !== "SUPER_ADMIN" || callerProfile.is_active === false) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Only active Super Admins can manage users and authentication accounts." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Process Requested Action
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "invite_user": {
        const { email, name, role = "EMPLOYEE", allCompanies = false, allowedCompanies = [] } = body;
        if (!email || typeof email !== "string") {
          return new Response(
            JSON.stringify({ error: "Valid email address is required." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const cleanEmail = email.trim().toLowerCase();
        const cleanName = (name || cleanEmail.split("@")[0]).trim();

        // Check if user already exists
        const { data: existingProfiles } = await adminClient
          .from("user_profiles")
          .select("id, email")
          .eq("email", cleanEmail);

        if (existingProfiles && existingProfiles.length > 0) {
          return new Response(
            JSON.stringify({ error: `User with email ${cleanEmail} already exists.` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Invite via Supabase Auth Admin
        const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
          cleanEmail,
          {
            data: { name: cleanName },
          }
        );

        if (inviteError) {
          return new Response(
            JSON.stringify({ error: inviteError.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const newUserId = inviteData.user.id;

        // Upsert custom profile attributes (role, companies, active status)
        await adminClient
          .from("user_profiles")
          .upsert({
            id: newUserId,
            email: cleanEmail,
            name: cleanName,
            role,
            all_companies: allCompanies,
            allowed_companies: allowedCompanies,
            is_active: true,
            updated_at: new Date().toISOString(),
          });

        return new Response(
          JSON.stringify({
            success: true,
            message: `Invitation successfully sent to ${cleanEmail}.`,
            user: { id: newUserId, email: cleanEmail, name: cleanName, role },
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "reset_password": {
        const { email } = body;
        if (!email) {
          return new Response(
            JSON.stringify({ error: "Email address is required." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const cleanEmail = email.trim().toLowerCase();
        const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
          type: "recovery",
          email: cleanEmail,
        });

        if (linkError) {
          return new Response(
            JSON.stringify({ error: linkError.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: `Password recovery link generated for ${cleanEmail}.`,
            recoveryUrl: linkData?.properties?.action_link,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "toggle_user_status": {
        const { userId, isActive } = body;
        if (!userId) {
          return new Response(
            JSON.stringify({ error: "User ID is required." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Safety: Protect last active Super Admin from deactivation
        if (!isActive) {
          const { count: activeAdminCount } = await adminClient
            .from("user_profiles")
            .select("id", { count: "exact", head: true })
            .eq("role", "SUPER_ADMIN")
            .eq("is_active", true)
            .neq("id", userId);

          if ((activeAdminCount || 0) === 0) {
            return new Response(
              JSON.stringify({ error: "Operation denied: Cannot deactivate the last remaining active Super Admin." }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }

        // Ban or unban user in Supabase Auth
        const banDuration = isActive ? "none" : "876000h"; // ~100 years
        const { error: banError } = await adminClient.auth.admin.updateUserById(userId, {
          ban_duration: banDuration,
        });

        if (banError) {
          console.warn("Auth admin ban warning:", banError.message);
        }

        // Update is_active in user_profiles
        const { error: updateError } = await adminClient
          .from("user_profiles")
          .update({ is_active: isActive, updated_at: new Date().toISOString() })
          .eq("id", userId);

        if (updateError) {
          return new Response(
            JSON.stringify({ error: updateError.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: `User account ${isActive ? "activated" : "deactivated"} successfully.`,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unsupported admin action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error in Edge Function." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

