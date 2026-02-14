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
    const { registration_id, session_id } = await req.json();

    if (!session_id) {
      return new Response(JSON.stringify({ error: "session_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get session with activity and practitioner details
    const { data: session, error: sessionError } = await supabase
      .from("activity_sessions")
      .select(
        "*, activities(title, practitioner_id, profiles(first_name, last_name, contact_email)), rooms(name)"
      )
      .eq("id", session_id)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: "Session not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const practitioner = session.activities?.profiles;
    const contactEmail = practitioner?.contact_email;

    if (!contactEmail) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "No contact_email configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the registration details
    let registrantInfo = "Un participant";
    if (registration_id) {
      const { data: reg } = await supabase
        .from("activity_registrations")
        .select("user_id, guest_name, guest_email, guest_phone")
        .eq("id", registration_id)
        .single();

      if (reg) {
        if (reg.guest_name) {
          registrantInfo = `${reg.guest_name} (${reg.guest_email}${reg.guest_phone ? `, ${reg.guest_phone}` : ""})`;
        } else if (reg.user_id) {
          registrantInfo = `Un utilisateur inscrit (ID: ${reg.user_id})`;
        }
      }
    }

    const startDate = new Date(session.start_time);
    const formattedDate = startDate.toLocaleDateString("fr-BE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const formattedTime = startDate.toLocaleTimeString("fr-BE", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const roomName = session.rooms?.name || "Non définie";
    const activityTitle = session.activities?.title || "Activité";

    // Get total registration count
    const { count } = await supabase
      .from("activity_registrations")
      .select("id", { count: "exact", head: true })
      .eq("session_id", session_id)
      .eq("status", "registered");

    const maxP = session.max_participants;
    const capacityLine = maxP
      ? `${count || 0}/${maxP} places occupées`
      : `${count || 0} inscrits`;

    // Send email via Resend
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      // If no Resend key, just log and return
      console.log(`[notify-registration] Would email ${contactEmail} about registration for ${activityTitle}`);
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
        to: [contactEmail],
        subject: `Nouvelle inscription — ${activityTitle}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #024D30;">Nouvelle inscription à votre activité</h2>
            <p><strong>${registrantInfo}</strong> s'est inscrit à votre activité :</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <tr><td style="padding: 8px 0; color: #666;">Activité</td><td style="padding: 8px 0; font-weight: bold;">${activityTitle}</td></tr>
              <tr><td style="padding: 8px 0; color: #666;">Date</td><td style="padding: 8px 0;">${formattedDate} à ${formattedTime}</td></tr>
              <tr><td style="padding: 8px 0; color: #666;">Salle</td><td style="padding: 8px 0;">${roomName}</td></tr>
              <tr><td style="padding: 8px 0; color: #666;">Capacité</td><td style="padding: 8px 0;">${capacityLine}</td></tr>
            </table>
            <p style="color: #666; font-size: 14px;">Vous recevez cet email car vous avez configuré un email de notification dans votre profil Medsquare.</p>
          </div>
        `,
      }),
    });

    const emailResult = await emailRes.json();

    return new Response(
      JSON.stringify({ sent: true, email: contactEmail, result: emailResult }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("notify-registration error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
