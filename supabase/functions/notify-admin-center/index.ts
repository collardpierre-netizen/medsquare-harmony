import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { medsquareEmail, infoTable, infoRow, statusBadge } from "../_shared/email-template.ts";

const ADMIN_EMAIL = "medsquare7822@gmail.com";

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
    const text = await req.text();
    if (text.length > 2048) {
      return new Response(JSON.stringify({ error: "Request too large" }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = JSON.parse(text);
    const { type } = body; // "booking" | "registration" | "practitioner_signup"

    if (!type || !["booking", "registration", "practitioner_signup"].includes(type)) {
      return new Response(JSON.stringify({ error: "Invalid type" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response(JSON.stringify({ skipped: true, reason: "RESEND_API_KEY not configured" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let subject = "";
    let content = "";
    let preheader = "";
    let title = "";

    if (type === "booking") {
      const { booking_id } = body;
      if (!booking_id || !UUID_REGEX.test(booking_id)) {
        return new Response(JSON.stringify({ error: "Valid booking_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: booking } = await supabase
        .from("bookings")
        .select("*, profiles(first_name, last_name), rooms(name)")
        .eq("id", booking_id)
        .single();

      if (!booking) {
        return new Response(JSON.stringify({ error: "Booking not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const practitionerName = `${booking.profiles?.first_name || ""} ${booking.profiles?.last_name || ""}`.trim();
      const roomName = booking.rooms?.name || "Non définie";
      const startDate = new Date(booking.start_time);
      const endDate = new Date(booking.end_time);
      const formattedDate = startDate.toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      const formattedTime = startDate.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" });
      const formattedEndTime = endDate.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" });

      title = "Nouvelle demande de réservation 📅";
      subject = `Nouvelle réservation — ${practitionerName} — ${roomName}`;
      preheader = `${practitionerName} demande une réservation pour ${roomName}`;
      content = `
        <p>Bonjour,</p>
        <p>Une nouvelle demande de réservation a été soumise et nécessite votre validation.</p>
        <div style="text-align:center;margin:16px 0;">${statusBadge("pending")}</div>
        ${infoTable(
          infoRow("Praticien", practitionerName) +
          infoRow("Salle", roomName) +
          infoRow("Date", formattedDate) +
          infoRow("Horaire", `${formattedTime} – ${formattedEndTime}`) +
          (booking.notes ? infoRow("Note", booking.notes) : "")
        )}
        <p style="color:#555;font-size:14px;">Connectez-vous à votre espace d'administration pour confirmer ou refuser cette demande.</p>
      `;
    } else if (type === "registration") {
      const { session_id, registration_id } = body;
      if (!session_id || !UUID_REGEX.test(session_id)) {
        return new Response(JSON.stringify({ error: "Valid session_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: session } = await supabase
        .from("activity_sessions")
        .select("*, activities(title, profiles(first_name, last_name)), rooms(name)")
        .eq("id", session_id)
        .single();

      if (!session) {
        return new Response(JSON.stringify({ error: "Session not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      let registrantName = "Un participant";
      let registrantDetails = "";
      if (registration_id && UUID_REGEX.test(registration_id)) {
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
            const { data: profile } = await supabase
              .from("profiles")
              .select("first_name, last_name")
              .eq("user_id", reg.user_id)
              .single();
            if (profile) {
              registrantName = `${profile.first_name} ${profile.last_name}`.trim();
            }
          }
        }
      }

      const activityTitle = session.activities?.title || "Activité";
      const practitionerName = `${session.activities?.profiles?.first_name || ""} ${session.activities?.profiles?.last_name || ""}`.trim();
      const roomName = session.rooms?.name || "";
      const startDate = new Date(session.start_time);
      const formattedDate = startDate.toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      const formattedTime = startDate.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" });

      const { count } = await supabase
        .from("activity_registrations")
        .select("id", { count: "exact", head: true })
        .eq("session_id", session_id)
        .eq("status", "registered");

      const maxP = session.max_participants;
      const capacityLine = maxP ? `${count || 0}/${maxP} places occupées` : `${count || 0} inscrits`;

      title = "Nouvelle inscription à une activité 🎉";
      subject = `Nouvelle inscription — ${activityTitle} — ${registrantName}`;
      preheader = `${registrantName} s'est inscrit à ${activityTitle}`;
      content = `
        <p>Bonjour,</p>
        <p>Une nouvelle inscription a été enregistrée pour une activité du centre.</p>
        <div style="margin:20px 0;padding:16px;background:#ECFDF5;border-radius:10px;border-left:4px solid #059669;">
          <p style="margin:0 0 4px;font-weight:700;color:#059669;font-size:15px;">🎉 ${registrantName}</p>
          ${registrantDetails ? `<p style="margin:0;color:#555;font-size:13px;">${registrantDetails}</p>` : ""}
        </div>
        ${infoTable(
          infoRow("Activité", activityTitle) +
          infoRow("Praticien", practitionerName) +
          (roomName ? infoRow("Salle", roomName) : "") +
          infoRow("Date", formattedDate) +
          infoRow("Horaire", formattedTime) +
          infoRow("Capacité", capacityLine)
        )}
      `;
    } else if (type === "practitioner_signup") {
      const { first_name, last_name, email } = body;
      if (!email) {
        return new Response(JSON.stringify({ error: "email required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const fullName = `${first_name || ""} ${last_name || ""}`.trim() || "Inconnu";

      title = "Nouveau professionnel inscrit 👤";
      subject = `Nouveau professionnel — ${fullName}`;
      preheader = `${fullName} souhaite rejoindre Medsquare`;
      content = `
        <p>Bonjour,</p>
        <p>Un nouveau professionnel souhaite rejoindre Medsquare :</p>
        <ul style="margin:16px 0;padding-left:20px;">
          <li><strong>Nom :</strong> ${fullName}</li>
          <li><strong>Email :</strong> ${email}</li>
        </ul>
        <p>Son compte est <strong>en attente de validation</strong>. Connectez-vous à votre espace d'administration pour activer son accès.</p>
      `;
    }

    const html = medsquareEmail({
      title,
      preheader,
      content,
      ctaLabel: "Accéder à l'administration",
      ctaUrl: "https://medsquare-harmony.lovable.app/dashboard",
    });

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Medsquare <noreply@medsquare.be>",
        to: [ADMIN_EMAIL],
        subject,
        html,
      }),
    });

    const emailResult = await emailRes.json();
    return new Response(JSON.stringify({ sent: true, result: emailResult }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("notify-admin-center error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
