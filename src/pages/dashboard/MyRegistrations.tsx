import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isPast } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarDays, Clock, MapPin, XCircle, CheckCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import SmartDashboardLayout from "@/components/dashboard/SmartDashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

const MyRegistrations = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [cancelId, setCancelId] = useState<string | null>(null);

  const { data: registrations = [], isLoading } = useQuery({
    queryKey: ["my-registrations", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("activity_registrations")
        .select(`
          id,
          status,
          created_at,
          session_id,
          activity_sessions (
            id,
            start_time,
            end_time,
            max_participants,
            rooms ( name ),
            activities ( title, category, photo_url )
          )
        `)
        .eq("user_id", user.id)
        .eq("status", "registered")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const cancelMutation = useMutation({
    mutationFn: async (registrationId: string) => {
      // Find session_id before deleting so we can trigger waitlist promotion email
      const reg = registrations.find((r) => r.id === registrationId);
      const sessionId = reg?.session_id;

      const { error } = await supabase
        .from("activity_registrations")
        .update({ status: "cancelled" })
        .eq("id", registrationId)
        .eq("user_id", user!.id);
      if (error) throw error;

      // Trigger waitlist promotion email (best-effort)
      if (sessionId) {
        supabase.functions.invoke("notify-waitlist-promoted", {
          body: { session_id: sessionId },
        }).catch(() => {});
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-registrations"] });
      toast({ title: "Inscription annulée" });
      setCancelId(null);
    },
    onError: () => {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible d'annuler l'inscription." });
      setCancelId(null);
    },
  });

  const upcoming = registrations.filter(
    (r: any) => r.activity_sessions && !isPast(new Date(r.activity_sessions.start_time))
  );
  const past = registrations.filter(
    (r: any) => r.activity_sessions && isPast(new Date(r.activity_sessions.start_time))
  );

  const RegistrationCard = ({ reg, showCancel }: { reg: any; showCancel: boolean }) => {
    const session = reg.activity_sessions;
    if (!session) return null;
    const activity = session.activities;
    const start = new Date(session.start_time);
    const end = new Date(session.end_time);

    return (
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="flex flex-col sm:flex-row">
            {/* Photo */}
            {activity?.photo_url && (
              <div className="sm:w-32 h-28 sm:h-auto shrink-0">
                <img
                  src={activity.photo_url}
                  alt={activity.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Details */}
            <div className="flex-1 p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-sm">{activity?.title || "Activité"}</h3>
                  {activity?.category && (
                    <Badge variant="secondary" className="text-[10px] mt-1">
                      {activity.category}
                    </Badge>
                  )}
                </div>
                {showCancel && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                    onClick={() => setCancelId(reg.id)}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Annuler</span>
                  </Button>
                )}
                {!showCancel && (
                  <Badge variant="outline" className="text-muted-foreground text-[10px] shrink-0">
                    Passée
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {format(start, "EEEE d MMM yyyy", { locale: fr })}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {format(start, "HH:mm")} – {format(end, "HH:mm")}
                </span>
                {session.rooms?.name && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {session.rooms.name}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <SmartDashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h2 className="font-display text-xl font-semibold">Mes inscriptions</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Retrouvez ici toutes vos inscriptions aux séances d'activités.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : registrations.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Aucune inscription pour le moment.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Consultez le planning des activités pour vous inscrire à une séance.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="upcoming">
            <TabsList>
              <TabsTrigger value="upcoming">
                À venir ({upcoming.length})
              </TabsTrigger>
              <TabsTrigger value="past">
                Passées ({past.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upcoming" className="space-y-3 mt-4">
              {upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Aucune séance à venir.
                </p>
              ) : (
                upcoming.map((reg: any) => (
                  <RegistrationCard key={reg.id} reg={reg} showCancel />
                ))
              )}
            </TabsContent>

            <TabsContent value="past" className="space-y-3 mt-4">
              {past.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Aucune séance passée.
                </p>
              ) : (
                past.map((reg: any) => (
                  <RegistrationCard key={reg.id} reg={reg} showCancel={false} />
                ))
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Cancel confirmation */}
      <AlertDialog open={!!cancelId} onOpenChange={(open) => !open && setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler l'inscription ?</AlertDialogTitle>
            <AlertDialogDescription>
              Votre place sera libérée pour d'autres participants. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Retour</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => cancelId && cancelMutation.mutate(cancelId)}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? "Annulation..." : "Confirmer l'annulation"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SmartDashboardLayout>
  );
};

export default MyRegistrations;
