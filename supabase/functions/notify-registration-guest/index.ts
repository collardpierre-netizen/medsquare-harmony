import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { medsquareEmail, infoTable, infoRow } from "../_shared/email-template.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ADDRESS = "25 rue de la Procession, 7822 Meslin-l'Évêque, Belgique";
const GOOGLE_MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ADDRESS)}`;
const WAZE_URL = `https://waze.com/ul?q=${encodeURIComponent(ADDRESS)}&navigate=yes`;

function generateICS(activityTitle: string, startDate: Date, endDate: Date, roomName: string, description: string): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const toICSDate = (d: Date) => {
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  };
  const uid = crypto.randomUUID();
  const now = toICSDate(new Date());

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Medsquare//Activity//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${toICSDate(startDate)}`,
    `DTEND:${toICSDate(endDate)}`,
    `SUMMARY:${activityTitle}`,
    `LOCATION:${roomName ? roomName + " — " : ""}${ADDRESS}`,
    `DESCRIPTION:${description.replace(/\n/g, "\\n").substring(0, 200)}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

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

    const callerUserId = claimsData.claims.sub;

    const text = await req.text();
    if (text.length > 1024) {
      return new Response(JSON.stringify({ error: "Request too large" }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { registration_id } = JSON.parse(text);

    if (!registration_id || typeof registration_id !== "string" || !UUID_REGEX.test(registration_id)) {
      return new Response(JSON.stringify({ error: "Valid registration_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: registration, error: regError } = await supabase
      .from("activity_registrations")
      .select("user_id, guest_name, guest_email, session_id, cancellation_token")
      .eq("id", registration_id)
      .single();

    if (regError || !registration) {
      return new Response(JSON.stringify({ error: "Registration not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Authorization
    let authorized = registration.user_id === callerUserId;
    if (!authorized) {
      const { data: session } = await supabase
        .from("activity_sessions")
        .select("activities(practitioner_id, profiles(user_id))")
        .eq("id", registration.session_id)
        .single();
      const practitionerUserId = (session?.activities as any)?.profiles?.user_id;
      if (practitionerUserId === callerUserId) authorized = true;
    }
    if (!authorized) {
      const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: callerUserId, _role: "admin" });
      if (isAdmin) authorized = true;
    }
    if (!authorized) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let recipientEmail = registration.guest_email;
    let recipientName = registration.guest_name || "Participant";

    if (!recipientEmail && registration.user_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("contact_email, first_name, last_name")
        .eq("user_id", registration.user_id)
        .single();

      if (profile?.contact_email) {
        recipientEmail = profile.contact_email;
        recipientName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Participant";
      }
    }

    if (!recipientEmail) {
      return new Response(JSON.stringify({ skipped: true, reason: "No email found for recipient" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: session, error: sessionError } = await supabase
      .from("activity_sessions")
      .select("*, activities(title, description), rooms(name)")
      .eq("id", registration.session_id)
      .single();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: "Session not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const startDate = new Date(session.start_time);
    const endDate = new Date(session.end_time);
    const formattedDate = startDate.toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const formattedTimeStart = startDate.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" });
    const formattedTimeEnd = endDate.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" });

    const activityTitle = session.activities?.title || "Activité";
    const activityDescription = session.activities?.description || "";
    const roomName = session.rooms?.name || "À déterminer";

    const siteUrl = "https://medsquare-harmony.lovable.app";
    const cancellationUrl = registration.cancellation_token
      ? `${siteUrl}/mon-inscription?token=${registration.cancellation_token}`
      : null;

    // Generate ICS
    const icsContent = generateICS(activityTitle, startDate, endDate, roomName, activityDescription);
    const icsBase64 = btoa(icsContent);

    const content = `
      <p>Bonjour <strong>${recipientName}</strong>,</p>
      <p>Votre inscription a été confirmée ! 🎉</p>
      
      <p>Nous vous attendons pour la séance suivante :</p>

      ${infoTable(
        infoRow("Activité", activityTitle) +
        infoRow("Date", formattedDate) +
        infoRow("Horaire", `${formattedTimeStart} – ${formattedTimeEnd}`) +
        infoRow("Lieu", `${roomName} — ${ADDRESS}`)
      )}

      <!-- Maps links -->
      <div style="margin:20px 0;text-align:center;">
        <a href="${GOOGLE_MAPS_URL}" style="display:inline-block;padding:10px 18px;background:#4285F4;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:13px;margin-right:8px;">
          📍 Google Maps
        </a>
        <a href="${WAZE_URL}" style="display:inline-block;padding:10px 18px;background:#33CCFF;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:13px;">
          🗺️ Waze
        </a>
      </div>

      ${activityDescription ? `
      <div style="margin:20px 0;padding:16px;background:#F3F4F6;border-radius:10px;border-left:4px solid #6B7280;">
        <p style="margin:0 0 8px;font-weight:700;color:#374151;font-size:14px;">À propos de cette activité</p>
        <p style="margin:0;color:#555;font-size:13px;line-height:1.5;">${activityDescription}</p>
      </div>
      ` : ""}

      <div style="margin:20px 0;padding:16px;background:#FEF3C7;border-radius:10px;border-left:4px solid #F59E0B;">
        <p style="margin:0;font-weight:700;color:#B45309;font-size:13px;">💡 Conseil</p>
        <p style="margin:8px 0 0;color:#555;font-size:13px;">Rendez-vous 10 minutes avant le début de la séance.</p>
      </div>

      ${cancellationUrl ? `
      <div style="margin:20px 0;padding:16px;background:#F9FAFB;border-radius:10px;border:1px solid #E5E7EB;">
        <p style="margin:0 0 8px;font-weight:700;color:#374151;font-size:13px;">Besoin d'annuler ?</p>
        <p style="margin:0 0 12px;color:#555;font-size:13px;line-height:1.5;">Si vous ne pouvez pas venir, merci de libérer votre place via le lien ci-dessous :</p>
        <a href="${cancellationUrl}" style="display:inline-block;padding:10px 20px;background:#ffffff;color:#024D30;text-decoration:none;border-radius:8px;font-weight:600;font-size:13px;border:2px solid #024D30;">
          Gérer mon inscription
        </a>
      </div>
      ` : `
      <p style="margin-top:24px;font-size:13px;color:#888;">Si vous devez annuler, veuillez nous prévenir à l'avance pour libérer votre place aux autres participants.</p>
      `}
    `;

    const html = medsquareEmail({
      title: "Inscription confirmée 🎉",
      preheader: `Vous êtes inscrit à ${activityTitle}`,
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
        from: "Medsquare <noreply@medsquare.be>",
        to: [recipientEmail],
        subject: `Inscription confirmée — ${activityTitle}`,
        html,
        attachments: [
          {
            filename: `${activityTitle.replace(/\s+/g, "-")}.ics`,
            content: icsBase64,
            type: "text/calendar",
          },
        ],
      }),
    });

    const emailResult = await emailRes.json();

    return new Response(JSON.stringify({ sent: true, result: emailResult }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("notify-registration-guest error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});