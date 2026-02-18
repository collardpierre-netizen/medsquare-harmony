import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token || !UUID_REGEX.test(token)) {
      return json({ error: "Token invalide" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // GET — fetch registration details
    if (req.method === "GET") {
      const { data: reg, error } = await supabase
        .from("activity_registrations")
        .select(`
          id, status, guest_name, guest_email, created_at, cancellation_token,
          activity_sessions (
            id, start_time, end_time, max_participants,
            rooms ( name ),
            activities ( title, category, is_free, price )
          )
        `)
        .eq("cancellation_token", token)
        .single();

      if (error || !reg) {
        return json({ error: "Inscription introuvable" }, 404);
      }

      return json({ registration: reg });
    }

    // DELETE — cancel registration
    if (req.method === "DELETE") {
      const { data: reg, error: fetchError } = await supabase
        .from("activity_registrations")
        .select("id, status, cancellation_token")
        .eq("cancellation_token", token)
        .single();

      if (fetchError || !reg) {
        return json({ error: "Inscription introuvable" }, 404);
      }

      if (reg.status === "cancelled") {
        return json({ error: "Cette inscription est déjà annulée" }, 409);
      }

      const { error: updateError } = await supabase
        .from("activity_registrations")
        .update({ status: "cancelled" })
        .eq("cancellation_token", token);

      if (updateError) {
        return json({ error: "Impossible d'annuler l'inscription" }, 500);
      }

      return json({ cancelled: true });
    }

    return json({ error: "Méthode non supportée" }, 405);
  } catch (err) {
    console.error("manage-guest-registration error:", err);
    return json({ error: "Erreur interne" }, 500);
  }
});
