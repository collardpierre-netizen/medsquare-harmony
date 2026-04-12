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
    const text = await req.text();
    if (text.length > 1024) {
      return new Response(JSON.stringify({ error: "Request too large" }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { session_id, registration_id, guest_name, guest_email, guest_phone } = JSON.parse(text);

    if (!session_id || typeof session_id !== "string" || !UUID_REGEX.test(session_id)) {
      return new Response(JSON.stringify({ error: "Valid session_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch session with activity and practitioner info
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
    let contactEmail = practitioner?.contact_email;

    // Fallback to auth email if no contact_email
    if (!contactEmail && practitioner?.user_id) {
      const { data: authEmails } = await supabase.rpc("get_auth_emails_for_users", {
        user_ids: [practitioner.user_id],
      });
      // This RPC requires admin caller, use direct query with service role instead
      const { data: authUser } = await supabase.auth.admin.getUserById(practitioner.user_id);
      if (authUser?.user?.email) {
        contactEmail = authUser.user.email;
      }
    }

    if (!contactEmail) {
      return new Response(JSON.stringify({ skipped: true, reason: "No contact email" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Determine who cancelled
    let registrantName = "Un participant";
    let registrantDetails = "";

    if (guest_name) {
      registrantName = guest_name;
      registrantDetails = [guest_email, guest_phone].filter(Boolean).join(" • ");
    } else if (registration_id) {
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
          // Try to get user profile name
          const { data: profile } = await supabase
            .from("profiles")
            .select("first_name, last_name, contact_email")
            .eq("user_id", reg.user_id)
            .single();

          if (profile) {
            const name = `${profile.first_name || ""} ${profile.last_name || ""}`.trim();
            registrantName = name || "Un utilisateur inscrit";
            registrantDetails = profile.contact_email || "";
          }
        }
      }
    }

    const startDate = new Date(session.start_time);
    const formattedDate = startDate.toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const formattedTime = startDate.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" });

    const roomName = session.rooms?.name || "Non définie";
    const activityTitle = session.activities?.title || "Activité";
    const practitionerName = `${practitioner?.first_name || ""} ${practitioner?.last_name || ""}`.trim();

    // Count remaining registrations
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
      <p>Un participant vient d'annuler son inscription à votre activité.</p>
      
      <div style="margin:20px 0;padding:16px;background:#FEF2F2;border-radius:10px;border-left:4px solid #B91C1C;">
        <p style="margin:0 0 4px;font-weight:700;color:#B91C1C;font-size:15px;">❌ ${registrantName}</p>
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
      title: "Inscription annulée ❌",
      preheader: `${registrantName} a annulé son inscription à ${activityTitle}`,
      content,
    });

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Medsquare <noreply@medsquare.be>",
        to: [contactEmail],
        subject: `Inscription annulée — ${activityTitle}`,
        html,
      }),
    });

    const emailResult = await emailRes.json();

    return new Response(JSON.stringify({ sent: true, result: emailResult }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("notify-registration-cancelled error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
