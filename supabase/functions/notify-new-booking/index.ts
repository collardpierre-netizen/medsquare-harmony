import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { medsquareEmail, infoTable, infoRow, statusBadge } from "../_shared/email-template.ts";

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

    // Input validation
    const text = await req.text();
    if (text.length > 1024) {
      return new Response(JSON.stringify({ error: "Request too large" }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { booking_id } = JSON.parse(text);

    if (!booking_id || typeof booking_id !== "string" || !UUID_REGEX.test(booking_id)) {
      return new Response(JSON.stringify({ error: "Valid booking_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("*, profiles(first_name, last_name, contact_email), rooms(name)")
      .eq("id", booking_id)
      .single();

    if (bookingError || !booking) {
      return new Response(JSON.stringify({ error: "Booking not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const practitioner = booking.profiles;
    const contactEmail = practitioner?.contact_email;

    if (!contactEmail) {
      return new Response(JSON.stringify({ skipped: true, reason: "No contact_email configured" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response(JSON.stringify({ skipped: true, reason: "RESEND_API_KEY not configured" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const startDate = new Date(booking.start_time);
    const endDate = new Date(booking.end_time);
    const formattedDate = startDate.toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const formattedTime = startDate.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" });
    const formattedEndTime = endDate.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" });
    const roomName = booking.rooms?.name || "Non définie";
    const practitionerName = `${practitioner?.first_name || ""} ${practitioner?.last_name || ""}`.trim();

    const badge = statusBadge("pending");

    const content = `
      <p>Bonjour <strong>${practitionerName}</strong>,</p>
      <p>Votre demande de réservation a bien été enregistrée et est en attente de validation par l'administration.</p>
      <div style="text-align:center;margin:16px 0;">${badge}</div>
      ${infoTable(
        infoRow("Salle", roomName) +
        infoRow("Date", formattedDate) +
        infoRow("Horaire", `${formattedTime} – ${formattedEndTime}`)
      )}
      ${booking.notes ? `<p style="font-size:13px;color:#555;"><em>Note : ${booking.notes}</em></p>` : ""}
      <p style="color:#555;font-size:14px;">Vous recevrez un email dès que votre réservation sera confirmée ou refusée.</p>
    `;

    const html = medsquareEmail({
      title: "Nouvelle réservation 📅",
      preheader: `Votre réservation pour ${roomName} est en attente de confirmation`,
      content,
    });

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Medsquare <notifications@medsquare.be>",
        to: [contactEmail],
        subject: `Nouvelle réservation — ${roomName}`,
        html,
      }),
    });

    const emailResult = await emailRes.json();

    return new Response(JSON.stringify({ sent: true, result: emailResult }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("notify-new-booking error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
