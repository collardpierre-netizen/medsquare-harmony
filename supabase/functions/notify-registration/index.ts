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
    // Auth check
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

    const callerUserId = claimsData.claims.sub;

    // Input validation
    const text = await req.text();
    if (text.length > 1024) {
      return new Response(JSON.stringify({ error: "Request too large" }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { registration_id, session_id } = JSON.parse(text);

    if (!session_id || typeof session_id !== "string" || !UUID_REGEX.test(session_id)) {
      return new Response(JSON.stringify({ error: "Valid session_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (registration_id && (typeof registration_id !== "string" || !UUID_REGEX.test(registration_id))) {
      return new Response(JSON.stringify({ error: "Invalid registration_id format" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Authorization: verify caller is the practitioner owning the activity or is admin
    const { data: session, error: sessionError } = await supabase
      .from("activity_sessions")
      .select(
        "*, activities(title, practitioner_id, profiles(first_name, last_name, contact_email, user_id)), rooms(name)"
      )
      .eq("id", session_id)
      .single();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: "Session not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const practitioner = session.activities?.profiles;
    const practitionerUserId = practitioner?.user_id;

    // Check: caller must be the registrant, the practitioner, or an admin
    let authorized = practitionerUserId === callerUserId;
    if (!authorized && registration_id) {
      const { data: reg } = await supabase
        .from("activity_registrations")
        .select("user_id")
        .eq("id", registration_id)
        .single();
      if (reg?.user_id === callerUserId) authorized = true;
    }
    if (!authorized) {
      const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: callerUserId, _role: "admin" });
      if (isAdmin) authorized = true;
    }
    if (!authorized) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const contactEmail = practitioner?.contact_email;
    if (!contactEmail) {
      return new Response(JSON.stringify({ skipped: true, reason: "No contact_email configured" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let registrantName = "Un participant";
    let registrantDetails = "";
    if (registration_id) {
      const { data: reg } = await supabase
        .from("activity_registrations")
        .select("user_id, guest_name, guest_email, guest_phone")
        .eq("id", registration_id)
        .single();

      if (reg) {
        if (reg.guest_name) {
          registrantName = reg.guest_name;
          registrantDetails = [reg.guest_email, reg.guest_phone].filter(Boolean).join(" • ");
        } else if (reg.user_id) {
          registrantName = "Un utilisateur inscrit";
        }
      }
    }

    const startDate = new Date(session.start_time);
    const formattedDate = startDate.toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const formattedTime = startDate.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" });

    const roomName = session.rooms?.name || "Non définie";
    const activityTitle = session.activities?.title || "Activité";
    const practitionerName = `${practitioner?.first_name || ""} ${practitioner?.last_name || ""}`.trim();

    const { count } = await supabase
      .from("activity_registrations")
      .select("id", { count: "exact", head: true })
      .eq("session_id", session_id)
      .eq("status", "registered");

    const maxP = session.max_participants;
    const capacityLine = maxP ? `${count || 0}/${maxP} places occupées` : `${count || 0} inscrits`;

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response(JSON.stringify({ skipped: true, reason: "RESEND_API_KEY not configured" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const content = `
      <p>Bonjour <strong>${practitionerName}</strong>,</p>
      <p>Une nouvelle inscription vient d'être enregistrée pour votre activité.</p>
      
      <div style="margin:20px 0;padding:16px;background:#ECFDF5;border-radius:10px;border-left:4px solid #059669;">
        <p style="margin:0 0 4px;font-weight:700;color:#059669;font-size:15px;">🎉 ${registrantName}</p>
        ${registrantDetails ? `<p style="margin:0;color:#555;font-size:13px;">${registrantDetails}</p>` : ""}
      </div>

      ${infoTable(
        infoRow("Activité", activityTitle) +
        infoRow("Salle", roomName) +
        infoRow("Date", formattedDate) +
        infoRow("Horaire", formattedTime) +
        infoRow("Capacité", capacityLine)
      )}
    `;

    const html = medsquareEmail({
      title: "Nouvelle inscription 🎉",
      preheader: `${registrantName} s'est inscrit à ${activityTitle}`,
      content,
    });

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Medsquare <noreply@medsquare.be>",
        to: [contactEmail],
        subject: `Nouvelle inscription — ${activityTitle}`,
        html,
      }),
    });

    const emailResult = await emailRes.json();

    return new Response(JSON.stringify({ sent: true, result: emailResult }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("notify-registration error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
