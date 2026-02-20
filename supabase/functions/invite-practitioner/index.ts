import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { medsquareEmail } from "../_shared/email-template.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the caller is admin using their JWT
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error("Not authenticated");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: isAdmin } = await adminClient.rpc("has_role", {
      _user_id: caller.id,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Admin access required");

    const { email, first_name, last_name, specialty, bio, phone, contact_email, schedule, resend_user_id } = await req.json();

    let targetEmail = email;
    let targetFirstName = first_name || "";
    let targetLastName = last_name || "";

    // If resending, look up the user's email from auth
    if (resend_user_id) {
      const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(resend_user_id);
      if (userError || !userData?.user) throw new Error("Utilisateur introuvable");
      targetEmail = userData.user.email;
      targetFirstName = userData.user.user_metadata?.first_name || targetFirstName;
      targetLastName = userData.user.user_metadata?.last_name || targetLastName;
    }

    if (!targetEmail) throw new Error("Email is required");

    // Generate invite link
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "invite",
      email: targetEmail,
      options: {
        data: {
          first_name: targetFirstName,
          last_name: targetLastName,
        },
      },
    });

    if (linkError) throw linkError;

    // Pre-fill profile data if provided (not a resend)
    if (!resend_user_id && linkData.user?.id) {
      const profileUpdates: Record<string, any> = {};
      if (specialty) profileUpdates.specialty = specialty;
      if (bio) profileUpdates.bio = bio;
      if (phone) profileUpdates.phone = phone;
      if (contact_email) profileUpdates.contact_email = contact_email;
      if (schedule) profileUpdates.schedule = schedule;

      if (Object.keys(profileUpdates).length > 0) {
        await adminClient
          .from("profiles")
          .update(profileUpdates)
          .eq("user_id", linkData.user.id);
      }
    }

    // Build the redirect URL from the hashed token
    const properties = linkData.properties;
    const siteUrl = Deno.env.get("SITE_URL") || "https://medsquare-harmony.lovable.app";
    const confirmUrl = `${supabaseUrl}/auth/v1/verify?token=${properties.hashed_token}&type=invite&redirect_to=${siteUrl}/login`;

    // Send branded email via Resend
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey) {
      const htmlBody = medsquareEmail({
        title: "Bienvenue chez Medsquare !",
        preheader: "Vous avez été invité(e) à rejoindre Medsquare",
        content: `
          <p>Bonjour <strong>${targetFirstName} ${targetLastName}</strong>,</p>
          <p>Vous avez été invité(e) à rejoindre la plateforme <strong>Medsquare</strong> en tant que praticien(ne).</p>
          <p>Cliquez sur le bouton ci-dessous pour activer votre compte et compléter votre profil :</p>
        `,
        ctaLabel: "Activer mon compte",
        ctaUrl: confirmUrl,
        footer: "Si vous n'avez pas demandé cette invitation, vous pouvez ignorer cet email.",
      });

      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: "Medsquare <noreply@updates.medsquare.be>",
          to: [targetEmail],
          subject: "Bienvenue chez Medsquare — Activez votre compte",
          html: htmlBody,
        }),
      });
      const resendBody = await resendRes.json();
      console.log("Resend response:", resendRes.status, JSON.stringify(resendBody));
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
