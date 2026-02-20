import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { medsquareEmail } from "../_shared/email-template.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify caller is authenticated admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authSupabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authSupabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const text = await req.text();
    if (text.length > 1024) {
      return new Response(JSON.stringify({ error: "Request too large" }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { practitioner_user_id } = JSON.parse(text);

    if (!practitioner_user_id || typeof practitioner_user_id !== "string" || !UUID_REGEX.test(practitioner_user_id)) {
      return new Response(JSON.stringify({ error: "Valid practitioner_user_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify caller is admin
    const { data: callerRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", claimsData.claims.sub)
      .eq("role", "admin")
      .single();

    if (!callerRole) {
      return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get practitioner profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name, contact_email, user_id")
      .eq("user_id", practitioner_user_id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "Practitioner not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get practitioner email from auth
    const { data: authUser } = await supabase.auth.admin.getUserById(practitioner_user_id);
    const recipientEmail = profile.contact_email || authUser?.user?.email;

    if (!recipientEmail) {
      return new Response(JSON.stringify({ skipped: true, reason: "No email found for practitioner" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const fullName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Professionnel";

    const content = `
      <p>Bonjour <strong>${fullName}</strong>,</p>
      <p>Bonne nouvelle ! 🎉 Votre compte professionnel sur <strong>Medsquare</strong> a été validé par notre équipe.</p>

      <div style="margin:20px 0;padding:16px;background:#ECFDF5;border-radius:10px;border-left:4px solid #059669;">
        <p style="margin:0;font-weight:700;color:#059669;font-size:14px;">✅ Compte activé</p>
        <p style="margin:8px 0 0;color:#555;font-size:13px;">Vous pouvez dès maintenant vous connecter à votre espace praticien pour gérer votre profil, vos activités et vos réservations.</p>
      </div>

      <div style="margin:20px 0;padding:16px;background:#F9FAFB;border-radius:10px;border:1px solid #E5E7EB;">
        <p style="margin:0 0 8px;font-weight:700;color:#374151;font-size:13px;">📋 Prochaines étapes</p>
        <ul style="margin:0;padding-left:20px;color:#555;font-size:13px;line-height:1.8;">
          <li>Complétez votre profil (photo, biographie, spécialité)</li>
          <li>Configurez vos horaires de disponibilité</li>
          <li>Réservez vos créneaux dans nos espaces</li>
        </ul>
      </div>
    `;

    const html = medsquareEmail({
      title: "Votre compte Medsquare est activé ! 🎉",
      preheader: "Votre compte professionnel a été validé",
      content,
      ctaLabel: "Accéder à mon espace",
      ctaUrl: "https://medsquare-harmony.lovable.app/login",
    });

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response(JSON.stringify({ skipped: true, reason: "RESEND_API_KEY not configured" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Medsquare <noreply@medsquare.be>",
        to: [recipientEmail],
        subject: `Votre compte Medsquare est activé — Bienvenue ${fullName} !`,
        html,
      }),
    });

    const emailResult = await emailRes.json();
    return new Response(JSON.stringify({ sent: true, result: emailResult }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("notify-account-activated error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});