import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { medsquareEmail, infoTable, infoRow } from "../_shared/email-template.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
    const { session_id } = JSON.parse(text);

    if (!session_id || typeof session_id !== "string" || !UUID_REGEX.test(session_id)) {
      return new Response(JSON.stringify({ error: "Valid session_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Find the most recently promoted registration (status = registered, most recent update)
    const { data: promoted, error: promError } = await supabase
      .from("activity_registrations")
      .select("id, user_id, guest_name, guest_email, cancellation_token, session_id")
      .eq("session_id", session_id)
      .eq("status", "registered")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (promError || !promoted) {
      return new Response(JSON.stringify({ skipped: true, reason: "No promoted registration found" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Determine recipient email
    let recipientEmail = promoted.guest_email;
    let recipientName = promoted.guest_name || "Participant";

    if (!recipientEmail && promoted.user_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("contact_email, first_name, last_name")
        .eq("user_id", promoted.user_id)
        .single();

      if (profile?.contact_email) {
        recipientEmail = profile.contact_email;
        recipientName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Participant";
      }
    }

    if (!recipientEmail) {
      return new Response(JSON.stringify({ skipped: true, reason: "No email for promoted person" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get session details
    const { data: session } = await supabase
      .from("activity_sessions")
      .select("*, activities(title), rooms(name)")
      .eq("id", session_id)
      .single();

    if (!session) {
      return new Response(JSON.stringify({ error: "Session not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const startDate = new Date(session.start_time);
    const endDate = new Date(session.end_time);
    const formattedDate = startDate.toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Brussels" });
    const formattedTimeStart = startDate.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels" });
    const formattedTimeEnd = endDate.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels" });

    const activityTitle = session.activities?.title || "Activité";
    const roomName = session.rooms?.name || "À déterminer";

    const siteUrl = "https://medsquare-harmony.lovable.app";
    const cancellationUrl = promoted.cancellation_token
      ? `${siteUrl}/mon-inscription?token=${promoted.cancellation_token}`
      : null;

    const content = `
      <p>Bonjour <strong>${recipientName}</strong>,</p>
      <p>Bonne nouvelle ! 🎉 Une place s'est libérée et vous avez été automatiquement inscrit(e) :</p>

      ${infoTable(
        infoRow("Activité", activityTitle) +
        infoRow("Date", formattedDate) +
        infoRow("Horaire", `${formattedTimeStart} – ${formattedTimeEnd}`) +
        infoRow("Lieu", roomName)
      )}

      <div style="margin:20px 0;padding:16px;background:#ECFDF5;border-radius:10px;border-left:4px solid #059669;">
        <p style="margin:0;font-weight:700;color:#059669;font-size:14px;">✅ Vous êtes maintenant inscrit(e)</p>
        <p style="margin:8px 0 0;color:#555;font-size:13px;">Vous étiez en liste d'attente et une place s'est libérée. Votre inscription est confirmée !</p>
      </div>

      <div style="margin:20px 0;padding:16px;background:#FEF3C7;border-radius:10px;border-left:4px solid #F59E0B;">
        <p style="margin:0;font-weight:700;color:#B45309;font-size:13px;">💡 Conseil</p>
        <p style="margin:8px 0 0;color:#555;font-size:13px;">Rendez-vous 10 minutes avant le début de la séance.</p>
      </div>

      ${cancellationUrl ? `
      <div style="margin:20px 0;padding:16px;background:#F9FAFB;border-radius:10px;border:1px solid #E5E7EB;">
        <p style="margin:0 0 8px;font-weight:700;color:#374151;font-size:13px;">Besoin d'annuler ?</p>
        <p style="margin:0 0 12px;color:#555;font-size:13px;">Si vous ne pouvez pas venir, merci de libérer votre place :</p>
        <a href="${cancellationUrl}" style="display:inline-block;padding:10px 20px;background:#ffffff;color:#024D30;text-decoration:none;border-radius:8px;font-weight:600;font-size:13px;border:2px solid #024D30;">
          Gérer mon inscription
        </a>
      </div>
      ` : ""}
    `;

    const html = medsquareEmail({
      title: "Place disponible — Vous êtes inscrit(e) ! 🎉",
      preheader: `Une place s'est libérée pour ${activityTitle}`,
      content,
    });

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response(JSON.stringify({ skipped: true, reason: "RESEND_API_KEY not configured" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Medsquare <notifications@medsquare.be>",
        to: [recipientEmail],
        subject: `Place disponible — ${activityTitle}`,
        html,
      }),
    });

    const emailResult = await emailRes.json();
    return new Response(JSON.stringify({ sent: true, result: emailResult }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("notify-waitlist-promoted error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
