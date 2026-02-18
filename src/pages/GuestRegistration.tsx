import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { motion } from "framer-motion";
import { Calendar, Clock, MapPin, Tag, CheckCircle, XCircle, AlertTriangle, Loader2, ArrowLeft } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

const GuestRegistration = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [registration, setRegistration] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Lien invalide — aucun token trouvé.");
      setLoading(false);
      return;
    }

    const fetchRegistration = async () => {
      try {
        const res = await fetch(
          `${FUNCTIONS_URL}/manage-guest-registration?token=${encodeURIComponent(token)}`,
          { method: "GET" }
        );
        const data = await res.json();
        if (!res.ok || data.error) {
          setError(data.error || "Inscription introuvable.");
        } else {
          setRegistration(data.registration);
          if (data.registration?.status === "cancelled") {
            setCancelled(true);
          }
        }
      } catch {
        setError("Impossible de charger votre inscription.");
      } finally {
        setLoading(false);
      }
    };

    fetchRegistration();
  }, [token]);

  const handleCancel = async () => {
    if (!token) return;
    setCancelling(true);
    try {
      const res = await fetch(
        `${FUNCTIONS_URL}/manage-guest-registration?token=${encodeURIComponent(token)}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Impossible d'annuler l'inscription.");
      } else {
        setCancelled(true);
      }
    } catch {
      setError("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setCancelling(false);
    }
  };

  const session = registration?.activity_sessions;
  const activity = session?.activities;
  const room = session?.rooms;

  return (
    <Layout>
      <div className="max-w-lg mx-auto px-4 py-12">
        <Link
          to="/activites"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux activités
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="font-display text-2xl font-bold mb-2">Mon inscription</h1>
          <p className="text-muted-foreground text-sm mb-8">
            Consultez les détails de votre séance et annulez si nécessaire.
          </p>

          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {!loading && error && (
            <Card>
              <CardContent className="pt-8 pb-8 text-center">
                <AlertTriangle className="h-10 w-10 text-destructive/50 mx-auto mb-3" />
                <p className="font-semibold text-sm mb-1">Lien invalide ou expiré</p>
                <p className="text-muted-foreground text-sm">{error}</p>
                <Button asChild className="mt-6" variant="outline">
                  <Link to="/activites">Voir les activités</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {!loading && !error && cancelled && (
            <Card>
              <CardContent className="pt-8 pb-8 text-center">
                <XCircle className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="font-semibold text-sm mb-1">Inscription annulée</p>
                <p className="text-muted-foreground text-sm">
                  Votre place a été libérée. Vous pouvez vous réinscrire à tout moment.
                </p>
                <Button asChild className="mt-6">
                  <Link to="/activites">Voir d'autres séances</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {!loading && !error && registration && !cancelled && (
            <div className="space-y-4">
              {/* Status banner */}
              <div className="rounded-xl bg-primary/5 border border-primary/15 p-4 flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="font-semibold text-sm text-primary">Inscription confirmée</p>
                  {registration.guest_name && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Au nom de {registration.guest_name}
                    </p>
                  )}
                </div>
              </div>

              {/* Session details */}
              <Card>
                <CardContent className="pt-5 space-y-3">
                  {activity && (
                    <div className="flex items-start gap-3">
                      <Tag className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="font-display font-semibold text-sm">{activity.title}</p>
                        <Badge variant="secondary" className="text-[10px] mt-1">
                          {activity.category}
                        </Badge>
                      </div>
                    </div>
                  )}

                  {session && (
                    <>
                      <div className="flex items-start gap-3">
                        <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <p className="text-sm">
                          {format(new Date(session.start_time), "EEEE d MMMM yyyy", { locale: fr })}
                        </p>
                      </div>

                      <div className="flex items-start gap-3">
                        <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <p className="text-sm">
                          {format(new Date(session.start_time), "HH:mm")}
                          {" – "}
                          {format(new Date(session.end_time), "HH:mm")}
                        </p>
                      </div>
                    </>
                  )}

                  {room?.name && (
                    <div className="flex items-start gap-3">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <p className="text-sm">{room.name}</p>
                    </div>
                  )}

                  {activity && (
                    <div className="pt-1 border-t border-border">
                      <p className="text-sm font-semibold">
                        {activity.is_free ? "Gratuit" : `${activity.price ?? "—"} €`}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Cancel action */}
              {session && new Date(session.start_time) > new Date() ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="w-full text-destructive border-destructive/30 hover:bg-destructive/5">
                      <XCircle className="h-4 w-4 mr-2" />
                      Annuler mon inscription
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="font-display">Annuler l'inscription ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Votre place sera libérée et vous ne pourrez plus y accéder via ce lien.
                        Vous pourrez vous réinscrire depuis la page des activités.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Garder mon inscription</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleCancel}
                        disabled={cancelling}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        {cancelling ? (
                          <><Loader2 className="h-4 w-4 animate-spin mr-2" />Annulation…</>
                        ) : "Confirmer l'annulation"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <p className="text-center text-xs text-muted-foreground">
                  Cette séance est passée — l'annulation n'est plus possible.
                </p>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </Layout>
  );
};

export default GuestRegistration;
