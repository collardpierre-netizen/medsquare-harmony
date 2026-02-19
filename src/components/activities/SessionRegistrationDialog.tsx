import { useState, useEffect } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Clock, MapPin, User, Users, LogIn, CheckCircle, XCircle, Mail } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [guestForm, setGuestForm] = useState({ name: "", email: "", phone: "" });

  useEffect(() => {
    if (!open || !session) {
      setChecking(false);
      return;
    }
    setShowGuestForm(false);
    setGuestForm({ name: "", email: "", phone: "" });

    const checkRegistration = async () => {
      setChecking(true);

      const { data: regCount } = await supabase.rpc(
        "count_session_registrations",
        { session_uuid: session.id }
      );

      setRegistrationCount(regCount || 0);

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
  const remaining = maxP ? Math.max(0, maxP - registrationCount) : null;
  const isPast = start < new Date();

  const notifyPractitioner = async (registrationId?: string) => {
    try {
      await supabase.functions.invoke("notify-registration", {
        body: { session_id: session.id, registration_id: registrationId },
      });
    } catch {
      // Silent fail - notification is best-effort
    }
  };

  const notifyGuest = async (registrationId: string) => {
    try {
      await supabase.functions.invoke("notify-registration-guest", {
        body: { registration_id: registrationId },
      });
    } catch {
      // Silent fail - notification is best-effort
    }
  };

  const handleRegister = async () => {
    if (!user) {
      navigate("/login");
      return;
    }

    setIsLoading(true);
    const status = isFull ? "waitlisted" : "registered";
    const { data, error } = await supabase.from("activity_registrations").insert({
      session_id: session.id,
      user_id: user.id,
      status,
    } as any).select("id").single();

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
      setRegistrationCount((c) => c + (isFull ? 0 : 1));
      toast({
        title: isFull ? "Liste d'attente confirmée ! 📋" : "Inscription confirmée ! 🎉",
        description: isFull
          ? `Vous êtes en liste d'attente pour ${activity?.title}. Vous serez notifié si une place se libère.`
          : `Vous êtes inscrit à ${activity?.title}.`,
      });
      onRegistrationChange?.();
      if (data?.id) {
        notifyPractitioner(data.id);
        notifyGuest(data.id);
      }
    }
    setIsLoading(false);
  };

  const handleGuestRegister = async () => {
    if (!guestForm.name.trim() || !guestForm.email.trim()) {
      toast({ variant: "destructive", title: "Champs requis", description: "Veuillez renseigner votre nom et email." });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(guestForm.email.trim())) {
      toast({ variant: "destructive", title: "Email invalide", description: "Veuillez entrer une adresse email valide." });
      return;
    }

    setIsLoading(true);
    const status = isFull ? "waitlisted" : "registered";
    const { data, error } = await supabase.from("activity_registrations").insert({
      session_id: session.id,
      user_id: null,
      guest_name: guestForm.name.trim(),
      guest_email: guestForm.email.trim(),
      guest_phone: guestForm.phone.trim() || null,
      status,
    } as any).select("id").single();

    if (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de s'inscrire. Veuillez réessayer.",
      });
    } else {
      setRegistrationCount((c) => c + (isFull ? 0 : 1));
      setShowGuestForm(false);
      toast({
        title: isFull ? "Liste d'attente confirmée ! 📋" : "Inscription confirmée ! 🎉",
        description: isFull
          ? `Vous êtes en liste d'attente pour ${activity?.title}.`
          : `Vous êtes inscrit à ${activity?.title}.`,
      });
      onRegistrationChange?.();
      if (data?.id) {
        notifyPractitioner(data.id);
        notifyGuest(data.id);
      }
    }
    setIsLoading(false);
  };

  const notifyWaitlistPromoted = async () => {
    try {
      await supabase.functions.invoke("notify-waitlist-promoted", {
        body: { session_id: session.id },
      });
    } catch {
      // Silent fail - best effort
    }
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
      // Send email to promoted waitlisted person (best-effort)
      notifyWaitlistPromoted();
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
            <div>
              <p className="text-sm">
                {checking ? "..." : `${registrationCount}/${maxP || "∞"} inscrits`}
              </p>
              {!checking && remaining !== null && !isFull && (
                <p className={`text-xs font-medium ${remaining <= 3 ? "text-amber-600" : "text-muted-foreground"}`}>
                  {remaining} place{remaining > 1 ? "s" : ""} restante{remaining > 1 ? "s" : ""}
                </p>
              )}
              {!checking && isFull && (
                <p className="text-xs font-medium text-amber-600">
                  Complet — inscription en liste d'attente possible
                </p>
              )}
            </div>
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
            <div className="pt-2 space-y-3">
              {user ? (
                // Authenticated user flow
                isRegistered ? (
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
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={handleRegister}
                    disabled={isLoading}
                  >
                    {isLoading ? "Inscription..." : "📋 S'inscrire en liste d'attente"}
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    onClick={handleRegister}
                    disabled={isLoading}
                  >
                    {isLoading ? "Inscription..." : "S'inscrire à cette séance"}
                  </Button>
                )
              ) : (
                // Non-authenticated visitor flow
                isFull && !showGuestForm ? (
                  <div className="space-y-2">
                    <p className="text-sm text-center text-amber-700 font-medium">Séance complète — inscription en liste d'attente</p>
                    <div className="flex flex-col gap-2">
                      <Button variant="outline" className="w-full" onClick={() => setShowGuestForm(true)}>
                        <Mail className="h-4 w-4 mr-2" />
                        Liste d'attente sans compte
                      </Button>
                      <Button variant="outline" className="w-full" onClick={() => navigate("/login")}>
                        <LogIn className="h-4 w-4 mr-2" />
                        Se connecter
                      </Button>
                    </div>
                  </div>
                ) : showGuestForm ? (
                  <div className="space-y-3 border border-border rounded-lg p-4">
                    <div>
                      <Label htmlFor="guest_name" className="text-xs">Nom complet *</Label>
                      <Input
                        id="guest_name"
                        value={guestForm.name}
                        onChange={(e) => setGuestForm({ ...guestForm, name: e.target.value })}
                        placeholder="Jean Dupont"
                        className="mt-1"
                        maxLength={100}
                      />
                    </div>
                    <div>
                      <Label htmlFor="guest_email" className="text-xs">Email *</Label>
                      <Input
                        id="guest_email"
                        type="email"
                        value={guestForm.email}
                        onChange={(e) => setGuestForm({ ...guestForm, email: e.target.value })}
                        placeholder="jean@exemple.com"
                        className="mt-1"
                        maxLength={255}
                      />
                    </div>
                    <div>
                      <Label htmlFor="guest_phone" className="text-xs">Téléphone (optionnel)</Label>
                      <Input
                        id="guest_phone"
                        value={guestForm.phone}
                        onChange={(e) => setGuestForm({ ...guestForm, phone: e.target.value })}
                        placeholder="+32 ..."
                        className="mt-1"
                        maxLength={20}
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setShowGuestForm(false)}
                      >
                        Annuler
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={handleGuestRegister}
                        disabled={isLoading}
                      >
                        {isLoading ? "Inscription..." : "Confirmer"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Button className="w-full" onClick={() => setShowGuestForm(true)}>
                      <Mail className="h-4 w-4 mr-2" />
                      S'inscrire sans compte
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => navigate("/login")}
                    >
                      <LogIn className="h-4 w-4 mr-2" />
                      Se connecter pour s'inscrire
                    </Button>
                  </div>
                )
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
