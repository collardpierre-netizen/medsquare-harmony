import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { medsquareEmail, infoTable, infoRow } from "../_shared/email-template.ts";

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
    const { registration_id } = await req.json();

    if (!registration_id) {
      return new Response(JSON.stringify({ error: "registration_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get registration details
    const { data: registration, error: regError } = await supabase
      .from("activity_registrations")
      .select("user_id, guest_name, guest_email, session_id")
      .eq("id", registration_id)
      .single();

    if (regError || !registration) {
      return new Response(
        JSON.stringify({ error: "Registration not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine recipient email
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
      return new Response(
        JSON.stringify({ skipped: true, reason: "No email found for recipient" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get session and activity details
    const { data: session, error: sessionError } = await supabase
      .from("activity_sessions")
      .select(
        "*, activities(title, description), rooms(name)"
      )
      .eq("id", registration.session_id)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: "Session not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const startDate = new Date(session.start_time);
    const endDate = new Date(session.end_time);
    const formattedDate = startDate.toLocaleDateString("fr-BE", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
    const formattedTimeStart = startDate.toLocaleTimeString("fr-BE", {
      hour: "2-digit", minute: "2-digit",
    });
    const formattedTimeEnd = endDate.toLocaleTimeString("fr-BE", {
      hour: "2-digit", minute: "2-digit",
    });

    const activityTitle = session.activities?.title || "Activité";
    const activityDescription = session.activities?.description || "";
    const roomName = session.rooms?.name || "À déterminer";

    const content = `
      <p>Bonjour <strong>${recipientName}</strong>,</p>
      <p>Votre inscription a été confirmée ! 🎉</p>
      
      <p>Nous vous attendons pour la séance suivante :</p>

      ${infoTable(
        infoRow("Activité", activityTitle) +
        infoRow("Date", formattedDate) +
        infoRow("Horaire", `${formattedTimeStart} – ${formattedTimeEnd}`) +
        infoRow("Lieu", roomName)
      )}

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

      <p style="margin-top:24px;font-size:13px;color:#888;">Si vous devez annuler, veuillez nous prévenir à l'avance pour libérer votre place aux autres participants.</p>
    `;

    const html = medsquareEmail({
      title: "Inscription confirmée 🎉",
      preheader: `Vous êtes inscrit à ${activityTitle}`,
      content,
    });

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      console.log(`[notify-registration-guest] Would email ${recipientEmail} confirmation for ${activityTitle}`);
      return new Response(
        JSON.stringify({ skipped: true, reason: "RESEND_API_KEY not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Medsquare <notifications@medsquare.be>",
        to: [recipientEmail],
        subject: `Inscription confirmée — ${activityTitle}`,
        html,
      }),
    });

    const emailResult = await emailRes.json();

    return new Response(
      JSON.stringify({ sent: true, email: recipientEmail, result: emailResult }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("notify-registration-guest error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
