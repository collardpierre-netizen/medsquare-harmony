import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { medsquareEmail, infoTable, infoRow, statusBadge } from "../_shared/email-template.ts";

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
    const { booking_id } = await req.json();

    if (!booking_id) {
      return new Response(
        JSON.stringify({ error: "booking_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("*, profiles(first_name, last_name, contact_email), rooms(name)")
      .eq("id", booking_id)
      .single();

    if (bookingError || !booking) {
      return new Response(
        JSON.stringify({ error: "Booking not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const practitioner = booking.profiles;
    const contactEmail = practitioner?.contact_email;

    if (!contactEmail) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "No contact_email configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      console.log(`[notify-new-booking] Would email ${contactEmail} about new booking`);
      return new Response(
        JSON.stringify({ skipped: true, reason: "RESEND_API_KEY not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const startDate = new Date(booking.start_time);
    const endDate = new Date(booking.end_time);
    const formattedDate = startDate.toLocaleDateString("fr-BE", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
    const formattedTime = startDate.toLocaleTimeString("fr-BE", {
      hour: "2-digit", minute: "2-digit",
    });
    const formattedEndTime = endDate.toLocaleTimeString("fr-BE", {
      hour: "2-digit", minute: "2-digit",
    });
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
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Medsquare <notifications@medsquare.be>",
        to: [contactEmail],
        subject: `Nouvelle réservation — ${roomName}`,
        html,
      }),
    });

    const emailResult = await emailRes.json();

    return new Response(
      JSON.stringify({ sent: true, email: contactEmail, result: emailResult }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("notify-new-booking error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
