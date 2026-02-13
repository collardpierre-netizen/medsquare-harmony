import { useState, useEffect } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Clock, MapPin, User, Users, LogIn, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface SessionRegistrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: {
    id: string;
    start_time: string;
    end_time: string;
    max_participants: number | null;
    rooms?: { name: string } | null;
    activities?: {
      title: string;
      category: string;
      description?: string | null;
      is_free?: boolean;
      price?: number | null;
      profiles?: { first_name: string; last_name: string } | null;
    } | null;
  } | null;
  onRegistrationChange?: () => void;
}

const SessionRegistrationDialog = ({
  open,
  onOpenChange,
  session,
  onRegistrationChange,
}: SessionRegistrationDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isRegistered, setIsRegistered] = useState(false);
  const [registrationCount, setRegistrationCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!open || !session) {
      setChecking(false);
      return;
    }

    const checkRegistration = async () => {
      setChecking(true);

      // Get registration count
      const { count } = await supabase
        .from("activity_registrations")
        .select("id", { count: "exact", head: true })
        .eq("session_id", session.id)
        .eq("status", "registered");

      setRegistrationCount(count || 0);

      // Check if current user is registered
      if (user) {
        const { data } = await supabase
          .from("activity_registrations")
          .select("id")
          .eq("session_id", session.id)
          .eq("user_id", user.id)
          .eq("status", "registered")
          .maybeSingle();

        setIsRegistered(!!data);
      } else {
        setIsRegistered(false);
      }

      setChecking(false);
    };

    checkRegistration();
  }, [open, session, user]);

  if (!session) return null;

  const start = new Date(session.start_time);
  const end = new Date(session.end_time);
  const activity = session.activities;
  const maxP = session.max_participants;
  const isFull = maxP ? registrationCount >= maxP : false;
  const isPast = start < new Date();

  const handleRegister = async () => {
    if (!user) {
      navigate("/login");
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.from("activity_registrations").insert({
      session_id: session.id,
      user_id: user.id,
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message.includes("duplicate")
          ? "Vous êtes déjà inscrit à cette séance."
          : "Impossible de s'inscrire. Veuillez réessayer.",
      });
    } else {
      setIsRegistered(true);
      setRegistrationCount((c) => c + 1);
      toast({ title: "Inscription confirmée !", description: `Vous êtes inscrit à ${activity?.title}.` });
      onRegistrationChange?.();
    }
    setIsLoading(false);
  };

  const handleUnregister = async () => {
    if (!user) return;
    setIsLoading(true);

    const { error } = await supabase
      .from("activity_registrations")
      .delete()
      .eq("session_id", session.id)
      .eq("user_id", user.id);

    if (error) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de se désinscrire." });
    } else {
      setIsRegistered(false);
      setRegistrationCount((c) => Math.max(0, c - 1));
      toast({ title: "Inscription annulée" });
      onRegistrationChange?.();
    }
    setIsLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">
            {activity?.title || "Séance"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Category */}
          {activity?.category && (
            <Badge variant="secondary" className="text-xs">
              {activity.category}
            </Badge>
          )}

          {/* Date & time */}
          <div className="flex items-start gap-3">
            <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">
                {format(start, "EEEE d MMMM yyyy", { locale: fr })}
              </p>
              <p className="text-sm text-muted-foreground">
                {format(start, "HH:mm")} – {format(end, "HH:mm")}
              </p>
            </div>
          </div>

          {/* Room */}
          {session.rooms?.name && (
            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-sm">{session.rooms.name}</p>
            </div>
          )}

          {/* Practitioner */}
          {activity?.profiles && (
            <div className="flex items-start gap-3">
              <User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-sm">
                {activity.profiles.first_name} {activity.profiles.last_name}
              </p>
            </div>
          )}

          {/* Capacity */}
          <div className="flex items-start gap-3">
            <Users className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-sm">
              {checking ? "..." : `${registrationCount}/${maxP || "∞"} inscrits`}
            </p>
          </div>

          {/* Price */}
          {activity && (
            <div className="rounded-lg bg-accent/50 border border-border p-3">
              <p className="text-sm font-medium">
                {activity.is_free ? "Gratuit" : `${activity.price ?? "—"} €`}
              </p>
            </div>
          )}

          {/* Action buttons */}
          {!isPast && (
            <div className="pt-2">
              {!user ? (
                <Button className="w-full" onClick={() => navigate("/login")}>
                  <LogIn className="h-4 w-4 mr-2" />
                  Se connecter pour s'inscrire
                </Button>
              ) : isRegistered ? (
                <div className="space-y-2">
                  <div className="rounded-lg bg-primary/10 border border-primary/20 p-3 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                    <p className="text-sm font-medium text-primary">Vous êtes inscrit</p>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleUnregister}
                    disabled={isLoading}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    {isLoading ? "Annulation..." : "Se désinscrire"}
                  </Button>
                </div>
              ) : isFull ? (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-center">
                  <p className="text-sm font-medium text-destructive">Séance complète</p>
                </div>
              ) : (
                <Button
                  className="w-full"
                  onClick={handleRegister}
                  disabled={isLoading}
                >
                  {isLoading ? "Inscription..." : "S'inscrire à cette séance"}
                </Button>
              )}
            </div>
          )}

          {isPast && (
            <div className="rounded-lg bg-muted border border-border p-3 text-center">
              <p className="text-xs text-muted-foreground">Cette séance est passée.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SessionRegistrationDialog;
