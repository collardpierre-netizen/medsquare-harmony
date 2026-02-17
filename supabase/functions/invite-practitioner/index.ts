import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { medsquareEmail } from "../_shared/email-template.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the caller is admin using their JWT
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error("Not authenticated");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: isAdmin } = await adminClient.rpc("has_role", {
      _user_id: caller.id,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Admin access required");

    const { email, first_name, last_name } = await req.json();
    if (!email) throw new Error("Email is required");

    // Generate invite link
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        data: {
          first_name: first_name || "",
          last_name: last_name || "",
        },
      },
    });

    if (linkError) throw linkError;

    // Build the redirect URL from the hashed token
    const properties = linkData.properties;
    const siteUrl = Deno.env.get("SITE_URL") || "https://medsquare-harmony.lovable.app";
    const confirmUrl = `${supabaseUrl}/auth/v1/verify?token=${properties.hashed_token}&type=invite&redirect_to=${siteUrl}/login`;

    // Send branded email via Resend
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey) {
      const htmlBody = medsquareEmail({
        title: "Bienvenue chez Medsquare !",
        preheader: "Vous avez été invité(e) à rejoindre Medsquare",
        content: `
          <p>Bonjour <strong>${first_name || ""} ${last_name || ""}</strong>,</p>
          <p>Vous avez été invité(e) à rejoindre la plateforme <strong>Medsquare</strong> en tant que praticien(ne).</p>
          <p>Cliquez sur le bouton ci-dessous pour activer votre compte et compléter votre profil :</p>
        `,
        ctaLabel: "Activer mon compte",
        ctaUrl: confirmUrl,
        footer: "Si vous n'avez pas demandé cette invitation, vous pouvez ignorer cet email.",
      });

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: "Medsquare <noreply@updates.medsquare.be>",
          to: [email],
          subject: "Bienvenue chez Medsquare — Activez votre compte",
          html: htmlBody,
        }),
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
