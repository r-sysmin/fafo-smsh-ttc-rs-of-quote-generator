import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userError } = await userClient.auth.getUser();
    const user = userData?.user;
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const proposalId: unknown = body?.proposal_id;
    const password: unknown = body?.password ?? null;
    const expiresAt: unknown = body?.expires_at ?? null;

    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (typeof proposalId !== "string" || !uuidRe.test(proposalId)) {
      return new Response(JSON.stringify({ error: "Invalid proposal id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (password !== null && (typeof password !== "string" || password.length < 4 || password.length > 128)) {
      return new Response(JSON.stringify({ error: "Password must be 4-128 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (expiresAt !== null && (typeof expiresAt !== "string" || Number.isNaN(Date.parse(expiresAt)))) {
      return new Response(JSON.stringify({ error: "Invalid expiration date" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Ownership check
    const { data: proposal } = await admin
      .from("proposals")
      .select("id, user_id")
      .eq("id", proposalId)
      .single();

    if (!proposal || proposal.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const updates: Record<string, unknown> = {
      share_expires_at: expiresAt,
    };

    if (typeof password === "string") {
      const { data: hash, error: hashError } = await admin.rpc("hash_share_password", {
        _password: password,
      });
      if (hashError) throw hashError;
      updates.share_password_hash = hash;
    } else if (body?.remove_password === true) {
      updates.share_password_hash = null;
    }

    const { error: updateError } = await admin
      .from("proposals")
      .update(updates)
      .eq("id", proposalId);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        success: true,
        share_expires_at: updates.share_expires_at ?? null,
        password_protected: updates.share_password_hash !== null && updates.share_password_hash !== undefined
          ? true
          : updates.share_password_hash === null
            ? false
            : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
