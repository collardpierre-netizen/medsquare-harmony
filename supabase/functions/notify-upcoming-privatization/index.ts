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
 * Detects rooms whose scheduled privatization starts in exactly 7 days
 * (window: today+7 to today+8) and notifies practitioners with bookings
 * overlapping the privatization period.
 *
 * Idempotent: a notification_logs row is written per (practitioner, room, period)
 * so a daily cron will not re-notify.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Window: privatized_from in [today+7, today+8)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const target = new Date(today);
    target.setUTCDate(target.getUTCDate() + 7);
    const targetEnd = new Date(target);
    targetEnd.setUTCDate(targetEnd.getUTCDate() + 1);
    const targetStr = target.toISOString().slice(0, 10);
    const targetEndStr = targetEnd.toISOString().slice(0, 10);

    // Find rooms with scheduled privatization starting in the window
    const { data: rooms, error: roomsErr } = await supabase
      .from("rooms")
      .select("id, name, privatized_from, privatized_until")
      .eq("is_available", true)
      .gte("privatized_from", targetStr)
      .lt("privatized_from", targetEndStr);

    if (roomsErr) throw roomsErr;

    const results: any[] = [];

    for (const room of rooms || []) {
      const startISO = `${room.privatized_from}T00:00:00`;
      const endDate = room.privatized_until || (() => {
        const d = new Date(room.privatized_from);
        d.setFullYear(d.getFullYear() + 1);
        return d.toISOString().slice(0, 10);
      })();
      const endISO = `${endDate}T23:59:59`;

      // Conflicting bookings (not cancelled)
      const { data: bookings, error: bErr } = await supabase
        .from("bookings")
        .select("id, start_time, end_time, status, practitioner_id, profiles(user_id, first_name, last_name, contact_email)")
        .eq("room_id", room.id)
        .neq("status", "cancelled")
        .gte("start_time", startISO)
        .lte("start_time", endISO)
        .order("start_time", { ascending: true });

      if (bErr) {
        console.error("Error fetching bookings for room", room.id, bErr);
        continue;
      }
      if (!bookings || bookings.length === 0) continue;

      // Group by practitioner
      const byPract = new Map<string, any[]>();
      for (const b of bookings) {
        if (!byPract.has(b.practitioner_id)) byPract.set(b.practitioner_id, []);
        byPract.get(b.practitioner_id)!.push(b);
      }

      for (const [practitionerId, practBookings] of byPract.entries()) {
        const templateId = `privatization-warning-${room.id}-${room.privatized_from}`;

        // Idempotency check
        const { data: existing } = await supabase
          .from("notification_logs")
          .select("id")
          .eq("practitioner_id", practitionerId)
          .eq("template_id", templateId)
          .limit(1)
          .maybeSingle();

        if (existing) {
          results.push({ room: room.name, practitioner: practitionerId, skipped: "already_notified" });
          continue;
        }

        const profile: any = practBookings[0].profiles;
        if (!profile?.user_id) continue;

        const fullName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Praticien";
        const periodStr = room.privatized_until
          ? `du ${fmtDate(room.privatized_from)} au ${fmtDate(room.privatized_until)}`
          : `à partir du ${fmtDate(room.privatized_from)}`;

        // 1) In-app notification
        await supabase.from("notifications").insert({
          user_id: profile.user_id,
          title: "Privatisation programmée ⚠️",
          message: `Le ${room.name} sera privatisé ${periodStr}. Vous avez ${practBookings.length} réservation${practBookings.length > 1 ? "s" : ""} sur cette période. Pensez à les déplacer ou annuler.`,
          type: "warning",
          metadata: {
            room_id: room.id,
            room_name: room.name,
            privatized_from: room.privatized_from,
            privatized_until: room.privatized_until,
            booking_count: practBookings.length,
            action: "privatization_warning",
          },
        });

        // 2) Email (best effort)
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
            intro: `Nous vous informons que <strong>${room.name}</strong> sera privatisé <strong>${periodStr}</strong> (dans 7 jours). Vous avez actuellement <strong>${practBookings.length} réservation${practBookings.length > 1 ? "s" : ""}</strong> sur cette période qui devront être déplacées ou annulées.`,
            infoBlock: infoTable(
              infoRow("🏥 Cabinet", room.name) +
              infoRow("📆 Période", periodStr) +
              bookingsRows + moreRow
            ),
            ctaLabel: "Gérer mes réservations",
            ctaUrl: `${SITE_URL}/dashboard/bookings`,
            outro: "Merci de prendre les dispositions nécessaires avant la date d'effet.",
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
              subject: `⚠️ Privatisation programmée - ${room.name} (J-7)`,
              html,
            }),
          });

          if (!emailRes.ok) {
            console.error("Email send failed", await emailRes.text());
          }
        }

        // 3) Log for idempotency
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
          },
        });

        results.push({ room: room.name, practitioner: fullName, bookings: practBookings.length, notified: true });
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: results.length, details: results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("notify-upcoming-privatization error:", err);
    return new Response(
      JSON.stringify({ error: err?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});