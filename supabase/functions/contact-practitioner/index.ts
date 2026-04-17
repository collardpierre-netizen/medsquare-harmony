import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { medsquareEmail, infoTable, infoRow } from "../_shared/email-template.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory rate-limit per IP (best-effort; isolate per worker instance)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth gate: require authenticated user (prevents anonymous spam/phishing)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized — please sign in to contact a practitioner" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: claims, error: claimsErr } = await authClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Rate limit per user
    if (!checkRateLimit(claims.claims.sub)) {
      return new Response(JSON.stringify({ error: "Trop de messages envoyés. Veuillez réessayer plus tard." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { practitioner_email, practitioner_name, sender_name, sender_email, sender_phone, message } = await req.json();

    if (!practitioner_email || !sender_name || !sender_email || !message) {
      return new Response(JSON.stringify({ error: "Champs requis manquants" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = medsquareEmail({
      title: "Nouveau message de contact",
      preheader: `${sender_name} vous a envoyé un message via Medsquare`,
      content: `
        <p>Bonjour <strong>${practitioner_name}</strong>,</p>
        <p>Vous avez reçu un nouveau message via votre profil Medsquare :</p>
        ${infoTable(
          infoRow("Nom", sender_name) +
          infoRow("Email", `<a href="mailto:${sender_email}" style="color:#024D30;">${sender_email}</a>`) +
          (sender_phone ? infoRow("Téléphone", sender_phone) : "")
        )}
        <div style="margin:20px 0;padding:16px 20px;background:#f7faf8;border-left:4px solid #4E7355;border-radius:0 8px 8px 0;">
          <p style="margin:0;white-space:pre-line;">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
        </div>
        <p style="color:#888;font-size:13px;">Vous pouvez répondre directement à cet email pour contacter ${sender_name}.</p>
      `,
    });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Medsquare <noreply@medsquare.be>",
        to: [practitioner_email],
        reply_to: sender_email,
        subject: `Nouveau message de ${sender_name} via Medsquare`,
        html,
      }),
    });

    const result = await res.json();
    console.log("Resend response:", res.status, JSON.stringify(result));

    if (!res.ok) {
      return new Response(JSON.stringify({ error: "Erreur d'envoi", details: result }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
