import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { medsquareEmail, infoTable, infoRow } from "../_shared/email-template.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SITE_URL = "https://www.medsquare.be";

const fmtDate = (d: Date | string) =>
  new Intl.DateTimeFormat("fr-BE", {
    timeZone: "Europe/Brussels",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(typeof d === "string" ? new Date(d) : d);

const fmtDateTime = (d: Date | string) =>
  new Intl.DateTimeFormat("fr-BE", {
    timeZone: "Europe/Brussels",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(typeof d === "string" ? new Date(d) : d);

/**
 * Notify practitioners IMMEDIATELY when a scheduled privatization is registered
 * on a period that overlaps existing bookings.
 *
 * Triggered from AdminRooms.handleSave when privatized_from is set/changed.
 * Idempotent via notification_logs (template_id includes the period).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { room_id } = await req.json();
    if (!room_id || typeof room_id !== "string") {
      return new Response(
        JSON.stringify({ error: "room_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: room, error: roomErr } = await supabase
      .from("rooms")
      .select("id, name, privatized_from, privatized_until, is_available")
      .eq("id", room_id)
      .maybeSingle();

    if (roomErr) throw roomErr;
    if (!room || !room.privatized_from || !room.is_available) {
      return new Response(
        JSON.stringify({ success: true, skipped: "no_active_scheduled_privatization" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const startISO = `${room.privatized_from}T00:00:00`;
    const endDate = room.privatized_until || (() => {
      const d = new Date(room.privatized_from);
      d.setFullYear(d.getFullYear() + 1);
      return d.toISOString().slice(0, 10);
    })();
    const endISO = `${endDate}T23:59:59`;

    const { data: bookings, error: bErr } = await supabase
      .from("bookings")
      .select("id, start_time, end_time, status, practitioner_id, profiles(user_id, first_name, last_name, contact_email)")
      .eq("room_id", room.id)
      .neq("status", "cancelled")
      .gte("start_time", startISO)
      .lte("start_time", endISO)
      .order("start_time", { ascending: true });

    if (bErr) throw bErr;
    if (!bookings || bookings.length === 0) {
      return new Response(
        JSON.stringify({ success: true, notified: 0, message: "no_conflicts" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const byPract = new Map<string, any[]>();
    for (const b of bookings) {
      if (!byPract.has(b.practitioner_id)) byPract.set(b.practitioner_id, []);
      byPract.get(b.practitioner_id)!.push(b);
    }

    const results: any[] = [];

    for (const [practitionerId, practBookings] of byPract.entries()) {
      const templateId = `privatization-immediate-${room.id}-${room.privatized_from}-${room.privatized_until || "open"}`;

      const { data: existing } = await supabase
        .from("notification_logs")
        .select("id")
        .eq("practitioner_id", practitionerId)
        .eq("template_id", templateId)
        .limit(1)
        .maybeSingle();

      if (existing) {
        results.push({ practitioner: practitionerId, skipped: "already_notified" });
        continue;
      }

      const profile: any = practBookings[0].profiles;
      if (!profile?.user_id) continue;

      const fullName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Praticien";
      const periodStr = room.privatized_until
        ? `du ${fmtDate(room.privatized_from)} au ${fmtDate(room.privatized_until)}`
        : `à partir du ${fmtDate(room.privatized_from)}`;

      // 1) In-app
      await supabase.from("notifications").insert({
        user_id: profile.user_id,
        title: "Privatisation programmée ⚠️",
        message: `${room.name} vient d'être marqué comme privatisé ${periodStr}. Vous avez ${practBookings.length} réservation${practBookings.length > 1 ? "s" : ""} sur cette période. Pensez à les déplacer ou annuler.`,
        type: "warning",
        metadata: {
          room_id: room.id,
          room_name: room.name,
          privatized_from: room.privatized_from,
          privatized_until: room.privatized_until,
          booking_count: practBookings.length,
          action: "privatization_scheduled",
        },
      });

      // 2) Email
      if (RESEND_API_KEY && profile.contact_email) {
        const bookingsRows = practBookings.slice(0, 15).map((b: any) =>
          infoRow("📅 Créneau", `${fmtDateTime(b.start_time)} → ${new Intl.DateTimeFormat("fr-BE", { timeZone: "Europe/Brussels", hour: "2-digit", minute: "2-digit" }).format(new Date(b.end_time))}`)
        ).join("");
        const moreRow = practBookings.length > 15
          ? infoRow("…", `et ${practBookings.length - 15} autre${practBookings.length - 15 > 1 ? "s" : ""}`)
          : "";

        const html = medsquareEmail({
          preheader: `${room.name} sera privatisé ${periodStr}`,
          title: "Privatisation programmée d'un cabinet",
          greeting: `Bonjour ${fullName},`,
          intro: `Nous vous informons que <strong>${room.name}</strong> vient d'être marqué comme privatisé <strong>${periodStr}</strong>. Vous avez actuellement <strong>${practBookings.length} réservation${practBookings.length > 1 ? "s" : ""}</strong> sur cette période qui devront être déplacées ou annulées.`,
          infoBlock: infoTable(
            infoRow("🏥 Cabinet", room.name) +
            infoRow("📆 Période", periodStr) +
            bookingsRows + moreRow
          ),
          ctaLabel: "Gérer mes réservations",
          ctaUrl: `${SITE_URL}/dashboard/bookings`,
          outro: "Merci de prendre les dispositions nécessaires dès que possible. Un rappel automatique vous sera également envoyé 7 jours avant la date d'effet.",
        });

        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "Medsquare <noreply@medsquare.be>",
            to: [profile.contact_email],
            subject: `⚠️ Privatisation programmée - ${room.name}`,
            html,
          }),
        });

        if (!emailRes.ok) {
          console.error("Email send failed", await emailRes.text());
        }
      }

      // 3) Log
      await supabase.from("notification_logs").insert({
        practitioner_id: practitionerId,
        template_id: templateId,
        channel: "in_app+email",
        status: "sent",
        metadata: {
          room_id: room.id,
          room_name: room.name,
          privatized_from: room.privatized_from,
          privatized_until: room.privatized_until,
          booking_count: practBookings.length,
          trigger: "immediate",
        },
      });

      results.push({ practitioner: fullName, bookings: practBookings.length, notified: true });
    }

    return new Response(
      JSON.stringify({ success: true, notified: results.filter(r => r.notified).length, details: results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("notify-privatization-immediate error:", err);
    return new Response(
      JSON.stringify({ error: err?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
