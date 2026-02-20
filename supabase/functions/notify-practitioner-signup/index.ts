import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { medsquareEmail } from "../_shared/email-template.ts";

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
    const text = await req.text();
    if (text.length > 2048) {
      return new Response(JSON.stringify({ error: "Request too large" }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { first_name, last_name, email } = JSON.parse(text);
    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "email required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get admin emails
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (!adminRoles?.length) {
      return new Response(JSON.stringify({ skipped: true, reason: "No admins found" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminUserIds = adminRoles.map((r: any) => r.user_id);
    const { data: adminProfiles } = await supabase
      .from("profiles")
      .select("contact_email")
      .in("user_id", adminUserIds);

    const adminEmails = (adminProfiles || [])
      .map((p: any) => p.contact_email)
      .filter(Boolean);

    if (!adminEmails.length) {
      return new Response(JSON.stringify({ skipped: true, reason: "No admin contact emails" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response(JSON.stringify({ skipped: true, reason: "RESEND_API_KEY not configured" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const fullName = `${first_name || ""} ${last_name || ""}`.trim() || "Inconnu";

    const content = `
      <p>Bonjour,</p>
      <p>Un nouveau professionnel souhaite rejoindre Medsquare :</p>
      <ul style="margin:16px 0;padding-left:20px;">
        <li><strong>Nom :</strong> ${fullName}</li>
        <li><strong>Email :</strong> ${email}</li>
      </ul>
      <p>Son compte est <strong>en attente de validation</strong>. Connectez-vous à votre espace d'administration pour activer son accès.</p>
    `;

    const html = medsquareEmail({
      title: "Nouveau professionnel inscrit 👤",
      preheader: `${fullName} souhaite rejoindre Medsquare`,
      content,
      ctaLabel: "Gérer les praticiens",
      ctaUrl: "https://medsquare-harmony.lovable.app/dashboard/admin/practitioners",
    });

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Medsquare <noreply@medsquare.be>",
        to: adminEmails,
        subject: `Nouveau professionnel — ${fullName}`,
        html,
      }),
    });

    const emailResult = await emailRes.json();
    return new Response(JSON.stringify({ sent: true, result: emailResult }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("notify-practitioner-signup error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
