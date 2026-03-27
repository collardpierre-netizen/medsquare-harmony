import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(authHeader);
      if (!user) {
        return new Response(JSON.stringify({ error: "Non authentifié" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Non autorisé" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json();
    const { practitioner_ids, template_id, custom_title, custom_body, cta_label, cta_url } = body;

    if (!practitioner_ids || !Array.isArray(practitioner_ids) || practitioner_ids.length === 0) {
      return new Response(JSON.stringify({ error: "practitioner_ids requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!resendKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY non configurée" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch practitioners with their contact_email
    const { data: practitioners } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, contact_email, profile_score, missing_fields")
      .in("id", practitioner_ids);

    if (!practitioners || practitioners.length === 0) {
      return new Response(JSON.stringify({ error: "Aucun praticien trouvé" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Also get auth emails for practitioners without contact_email
    const userIds = practitioners.map((p: any) => p.user_id).filter(Boolean);

    const results = [];

    for (const practitioner of practitioners) {
      const email = practitioner.contact_email;
      if (!email) continue;

      const score = practitioner.profile_score ?? 0;
      const missingFields = (practitioner.missing_fields || []) as string[];
      const title = (custom_title || "Mise à jour MedSquare").replace("{score}", String(score));
      const emailBody = (custom_body || "").replace("{score}", String(score));

      const missingListHtml = missingFields.length > 0
        ? `<ul style="margin:10px 0;padding-left:20px;">${missingFields.map((f: string) => `<li style="margin:4px 0;color:#666;">${f}</li>`).join("")}</ul>`
        : "";

      const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="text-align:center;padding:20px 0;border-bottom:3px solid #024D30;">
    <h2 style="color:#024D30;margin:0;">MedSquare</h2>
  </div>
  <div style="padding:30px 0;">
    <p style="font-size:16px;color:#333;">Bonjour ${practitioner.first_name},</p>
    <p style="font-size:14px;color:#555;line-height:1.6;">${emailBody}</p>
    ${score > 0 ? `
    <div style="background:#f8f9fa;border-radius:12px;padding:16px;margin:20px 0;">
      <p style="margin:0 0 8px;font-weight:bold;color:#333;">Votre score de complétude : ${score}%</p>
      <div style="background:#e0e0e0;border-radius:8px;height:12px;overflow:hidden;">
        <div style="background:${score < 40 ? '#ef4444' : score < 70 ? '#f59e0b' : '#22c55e'};height:100%;width:${score}%;border-radius:8px;"></div>
      </div>
    </div>` : ""}
    ${missingListHtml ? `<p style="font-size:14px;color:#555;font-weight:bold;">Informations manquantes :</p>${missingListHtml}` : ""}
    ${cta_label && cta_url ? `
    <div style="text-align:center;margin:30px 0;">
      <a href="https://medsquare-harmony.lovable.app${cta_url}" style="background:#534AB7;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">${cta_label}</a>
    </div>` : ""}
  </div>
  <div style="border-top:1px solid #eee;padding-top:20px;text-align:center;">
    <p style="font-size:12px;color:#999;">MedSquare — Centre de santé pluridisciplinaire</p>
  </div>
</body>
</html>`;

      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendKey}`,
          },
          body: JSON.stringify({
            from: "MedSquare <noreply@medsquare.be>",
            to: [email],
            subject: title,
            html: htmlContent,
          }),
        });

        const resData = await res.json();
        results.push({ practitioner_id: practitioner.id, status: res.ok ? "sent" : "failed", data: resData });
      } catch (err) {
        results.push({ practitioner_id: practitioner.id, status: "failed", error: String(err) });
      }
    }

    return new Response(JSON.stringify({ sent: results.filter((r) => r.status === "sent").length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
