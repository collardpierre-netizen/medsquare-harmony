import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { featureAnnouncementHtml, featureAnnouncementSubject } from "../_shared/email-templates/feature-announcement.ts";
import { profileIncompleteHtml, profileIncompleteSubject } from "../_shared/email-templates/profile-incomplete.ts";
import { weeklyDigestHtml, weeklyDigestSubject } from "../_shared/email-templates/weekly-digest.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_URL = "https://medsquare-harmony.lovable.app";

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

    // Fetch practitioners
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

    const results = [];

    for (const practitioner of practitioners) {
      const email = practitioner.contact_email;
      if (!email) continue;

      const score = practitioner.profile_score ?? 0;
      const missingFields = (practitioner.missing_fields || []) as string[];
      const ctaFullUrl = `${BASE_URL}${cta_url || "/dashboard/profil"}`;
      const firstName = practitioner.first_name || "Praticien";

      let subject: string;
      let htmlContent: string;

      switch (template_id) {
        case "feature_announcement":
          subject = custom_title || featureAnnouncementSubject();
          htmlContent = featureAnnouncementHtml({ firstName, score, ctaUrl: ctaFullUrl });
          break;

        case "profile_incomplete":
          subject = custom_title || profileIncompleteSubject(missingFields.length);
          htmlContent = profileIncompleteHtml({ firstName, missingFields, ctaUrl: ctaFullUrl, score });
          break;

        case "weekly_digest": {
          const now = new Date();
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - now.getDay() + 1);
          const semaine = `${weekStart.toLocaleDateString("fr-BE", { day: "2-digit", month: "long" })}`;
          subject = custom_title || weeklyDigestSubject(semaine);
          htmlContent = weeklyDigestHtml({
            firstName,
            semaine,
            vues: 0,
            nbAvis: 0,
            nbQuestions: 0,
            ctaUrl: ctaFullUrl,
          });
          break;
        }

        default: {
          // Fallback: generic email with custom content
          const title = (custom_title || "Mise à jour MedSquare").replace("{score}", String(score));
          const emailBody = (custom_body || "").replace("{score}", String(score));
          subject = title;
          htmlContent = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="text-align:center;padding:20px 0;border-bottom:3px solid #024D30;">
    <img src="${BASE_URL}/logo-medsquare.png" alt="MedSquare" width="160" />
  </div>
  <div style="padding:30px 0;">
    <p style="font-size:16px;color:#333;">Bonjour ${firstName},</p>
    <p style="font-size:14px;color:#555;line-height:1.6;">${emailBody}</p>
    ${cta_label ? `<div style="text-align:center;margin:30px 0;">
      <a href="${ctaFullUrl}" style="background:#534AB7;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">${cta_label}</a>
    </div>` : ""}
  </div>
  <div style="border-top:1px solid #eee;padding-top:20px;text-align:center;">
    <p style="font-size:12px;color:#999;">MedSquare — Centre de santé pluridisciplinaire</p>
  </div>
</body></html>`;
          break;
        }
      }

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
            subject,
            html: htmlContent,
          }),
        });

        const resData = await res.json();

        // Log the send
        await supabase.from("notification_logs").insert({
          practitioner_id: practitioner.id,
          template_id: template_id || "custom",
          status: res.ok ? "sent" : "failed",
          channel: "email",
          metadata: { subject, resend_response: resData },
        });

        results.push({ practitioner_id: practitioner.id, status: res.ok ? "sent" : "failed", data: resData });
      } catch (err) {
        await supabase.from("notification_logs").insert({
          practitioner_id: practitioner.id,
          template_id: template_id || "custom",
          status: "failed",
          channel: "email",
          metadata: { error: String(err) },
        });
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
