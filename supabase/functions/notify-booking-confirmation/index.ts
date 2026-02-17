import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { medsquareEmail, infoTable, infoRow } from "../_shared/email-template.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function generateICS(title: string, start: Date, end: Date, location: string, description: string): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const formatDate = (d: Date) =>
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Medsquare//Booking//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `DTSTART:${formatDate(start)}`,
    `DTEND:${formatDate(end)}`,
    `SUMMARY:${title}`,
    `LOCATION:${location}`,
    `DESCRIPTION:${description.replace(/\n/g, "\\n")}`,
    `STATUS:CONFIRMED`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const text = await req.text();
    if (text.length > 1024) {
      return new Response(JSON.stringify({ error: "Request too large" }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { registration_id } = JSON.parse(text);

    if (!registration_id || typeof registration_id !== "string" || !UUID_REGEX.test(registration_id)) {
      return new Response(JSON.stringify({ error: "Valid registration_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: registration, error: regError } = await supabase
      .from("activity_registrations")
      .select("user_id, guest_name, guest_email, session_id")
      .eq("id", registration_id)
      .single();

    if (regError || !registration) {
      return new Response(JSON.stringify({ error: "Registration not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get recipient info
    let recipientEmail = registration.guest_email;
    let recipientName = registration.guest_name || "Participant";

    if (!recipientEmail && registration.user_id) {
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("contact_email, first_name, last_name")
        .eq("user_id", registration.user_id)
        .single();

      if (userProfile) {
        recipientEmail = userProfile.contact_email;
        recipientName = `${userProfile.first_name || ""} ${userProfile.last_name || ""}`.trim() || "Participant";
      }

      // Fallback to auth email
      if (!recipientEmail && registration.user_id) {
        const { data: authData } = await supabase.auth.admin.getUserById(registration.user_id);
        if (authData?.user?.email) {
          recipientEmail = authData.user.email;
        }
      }
    }

    // Get session details
    const { data: session } = await supabase
      .from("activity_sessions")
      .select("*, activities(title, description, profiles(id, first_name, last_name, contact_email)), rooms(name)")
      .eq("id", registration.session_id)
      .single();

    if (!session) {
      return new Response(JSON.stringify({ error: "Session not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const startDate = new Date(session.start_time);
    const endDate = new Date(session.end_time);
    const formattedDate = startDate.toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const formattedTimeStart = startDate.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" });
    const formattedTimeEnd = endDate.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" });

    const activityTitle = session.activities?.title || "Activité";
    const activityDescription = session.activities?.description || "";
    const roomName = session.rooms?.name || "Medsquare - 25 rue de la Procession, 7822 Meslin-l'Évêque";
    const practitionerName = session.activities?.profiles
      ? `${session.activities.profiles.first_name} ${session.activities.profiles.last_name}`.trim()
      : "Praticien";

    // Generate ICS
    const icsContent = generateICS(
      activityTitle,
      startDate,
      endDate,
      roomName,
      `Rendez-vous avec ${practitionerName} - ${activityTitle}`
    );

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response(JSON.stringify({ skipped: true, reason: "RESEND_API_KEY not configured" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const results: any[] = [];

    // 1. Send to patient/guest
    if (recipientEmail) {
      const patientContent = `
        <p>Bonjour <strong>${recipientName}</strong>,</p>
        <p>Votre rendez-vous a été confirmé ! 🎉</p>
        
        ${infoTable(
          infoRow("Prestation", activityTitle) +
          infoRow("Praticien", practitionerName) +
          infoRow("Date", formattedDate) +
          infoRow("Horaire", `${formattedTimeStart} – ${formattedTimeEnd}`) +
          infoRow("Lieu", roomName)
        )}

        ${activityDescription ? `
        <div style="margin:20px 0;padding:16px;background:#F3F4F6;border-radius:10px;border-left:4px solid #6B7280;">
          <p style="margin:0 0 8px;font-weight:700;color:#374151;font-size:14px;">À propos de cette prestation</p>
          <p style="margin:0;color:#555;font-size:13px;line-height:1.5;">${activityDescription}</p>
        </div>
        ` : ""}

        <div style="margin:20px 0;padding:16px;background:#FEF3C7;border-radius:10px;border-left:4px solid #F59E0B;">
          <p style="margin:0;font-weight:700;color:#B45309;font-size:13px;">💡 Conseil</p>
          <p style="margin:8px 0 0;color:#555;font-size:13px;">Rendez-vous 10 minutes avant le début de votre rendez-vous. Un fichier calendrier (.ics) est joint à cet email.</p>
        </div>

        <p style="margin-top:24px;font-size:13px;color:#888;">Si vous devez annuler, veuillez nous prévenir à l'avance.</p>
      `;

      const html = medsquareEmail({
        title: "Rendez-vous confirmé 🎉",
        preheader: `Votre RDV ${activityTitle} est confirmé`,
        content: patientContent,
      });

      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Medsquare <notifications@medsquare.be>",
          to: [recipientEmail],
          subject: `Rendez-vous confirmé — ${activityTitle} avec ${practitionerName}`,
          html,
          attachments: [{
            filename: "rendez-vous.ics",
            content: btoa(icsContent),
          }],
        }),
      });
      results.push({ to: "patient", status: emailRes.status });
    }

    // 2. Send copy to practitioner
    const practitionerEmail = session.activities?.profiles?.contact_email;
    if (practitionerEmail) {
      const pracContent = `
        <p>Bonjour <strong>${practitionerName}</strong>,</p>
        <p>Un nouveau rendez-vous a été réservé ! 📅</p>
        
        ${infoTable(
          infoRow("Patient", recipientName) +
          (recipientEmail ? infoRow("Email", recipientEmail) : "") +
          (registration.guest_email ? infoRow("Téléphone", registration.guest_email) : "") +
          infoRow("Prestation", activityTitle) +
          infoRow("Date", formattedDate) +
          infoRow("Horaire", `${formattedTimeStart} – ${formattedTimeEnd}`) +
          infoRow("Lieu", roomName)
        )}

        <p style="margin-top:16px;font-size:13px;color:#888;">Connectez-vous à votre espace praticien pour gérer vos rendez-vous.</p>
      `;

      const pracHtml = medsquareEmail({
        title: "Nouveau rendez-vous 📅",
        preheader: `RDV ${activityTitle} avec ${recipientName}`,
        content: pracContent,
      });

      const pracEmailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Medsquare <notifications@medsquare.be>",
          to: [practitionerEmail],
          subject: `Nouveau RDV — ${activityTitle} avec ${recipientName}`,
          html: pracHtml,
          attachments: [{
            filename: "rendez-vous.ics",
            content: btoa(icsContent),
          }],
        }),
      });
      results.push({ to: "practitioner", status: pracEmailRes.status });
    }

    return new Response(JSON.stringify({ sent: true, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("notify-booking-confirmation error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
