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
    const { booking_id, new_status } = await req.json();

    if (!booking_id || !new_status) {
      return new Response(
        JSON.stringify({ error: "booking_id and new_status required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get booking with practitioner and room details
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

    const startDate = new Date(booking.start_time);
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

    const roomName = booking.rooms?.name || "Non définie";

    // Send email via Resend
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      console.log(
        `[notify-booking-status] Would email ${contactEmail} about booking status change to ${new_status}`
      );
      return new Response(
        JSON.stringify({ skipped: true, reason: "RESEND_API_KEY not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let title = "";
    let message = "";
    let color = "";

    if (new_status === "confirmed") {
      title = "Réservation confirmée ✅";
      message = `Votre réservation pour <strong>${roomName}</strong> le <strong>${formattedDate} à ${formattedTime}</strong> a été <strong>confirmée</strong>.`;
      color = "#059669"; // green
    } else if (new_status === "cancelled") {
      title = "Réservation refusée ❌";
      message = `Votre réservation pour <strong>${roomName}</strong> le <strong>${formattedDate} à ${formattedTime}</strong> a été <strong>refusée</strong>.`;
      color = "#dc2626"; // red
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
        subject: title,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="padding: 20px; background: ${color}; color: white; border-radius: 8px 8px 0 0; text-align: center;">
              <h2 style="margin: 0; font-size: 24px;">${title}</h2>
            </div>
            <div style="padding: 24px; background: #f9fafb; border-radius: 0 0 8px 8px;">
              <p style="color: #374151; line-height: 1.6;">${message}</p>
              <table style="width: 100%; margin-top: 20px; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px;">Salle</td>
                  <td style="padding: 8px 0; font-weight: bold;">${roomName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px;">Date & heure</td>
                  <td style="padding: 8px 0;">${formattedDate} à ${formattedTime}</td>
                </tr>
              </table>
              <p style="color: #999; font-size: 12px; margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 12px;">
                Cet email a été envoyé automatiquement par Medsquare.
              </p>
            </div>
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
    console.error("notify-booking-status error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
