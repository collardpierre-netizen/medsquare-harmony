import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { medsquareEmail, infoTable, infoRow } from "../_shared/email-template.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
