import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar, MapPin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Session {
  id: string;
  start_time: string;
  end_time: string;
  max_participants: number | null;
  status: string;
  rooms: { name: string } | null;
  activity_registrations: { id: string; user_id: string; status?: string }[];
}

interface Props {
  sessions: Session[];
  myRegistrations: string[];
  isAuthenticated: boolean;
  onRegister: (sessionId: string) => void;
  onUnregister: (sessionId: string) => void;
}

const ActivityDetailSessions = ({
  sessions,
  myRegistrations,
  isAuthenticated,
  onRegister,
  onUnregister,
}: Props) => {
  if (sessions.length === 0) {
    return (
      <div className="text-center py-10 rounded-xl border border-dashed border-border bg-muted/30">
        <Calendar className="h-10 w-10 text-muted-foreground/20 mx-auto mb-2" />
        <p className="text-muted-foreground text-sm">
          Aucune séance programmée pour le moment.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sessions.map((session) => {
        const registered = session.activity_registrations?.filter((r) => (r.status || "registered") === "registered") || [];
        const waitlisted = session.activity_registrations?.filter((r) => r.status === "waitlisted") || [];
        const registrationCount = registered.length;
        const maxP = session.max_participants;
        const isMarkedFull = session.status === "full";
        const isFull = isMarkedFull || (maxP ? registrationCount >= maxP : false);
        const remaining = maxP ? Math.max(0, maxP - registrationCount) : null;
        const isRegistered = myRegistrations.includes(session.id);

        return (
          <div
            key={session.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-border bg-card hover:shadow-sm transition-shadow"
          >
            <div className="space-y-1">
              <p className="font-display font-semibold text-sm">
                {format(new Date(session.start_time), "EEEE d MMMM yyyy", {
                  locale: fr,
                })}
              </p>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span>
                  {format(new Date(session.start_time), "HH:mm")} –{" "}
                  {format(new Date(session.end_time), "HH:mm")}
                </span>
                {session.rooms?.name && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {session.rooms.name}
                  </span>
                )}
                <span className={cn(
                  "flex items-center gap-1 font-medium",
                  isFull ? "text-destructive" : remaining !== null && remaining <= 3 ? "text-amber-600" : "text-muted-foreground"
                )}>
                  <Users className="h-3 w-3" />
                  {registrationCount}/{maxP || "∞"}
                  {remaining !== null && !isFull && (
                    <span className="ml-0.5">
                      ({remaining} place{remaining > 1 ? "s" : ""})
                    </span>
                  )}
                  {isFull && <span className="ml-0.5">(complet)</span>}
                </span>
                {waitlisted.length > 0 && (
                  <span className="text-amber-600 font-medium">
                    +{waitlisted.length} en attente
                  </span>
                )}
              </div>
            </div>

            <div className="shrink-0">
              {isRegistered ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onUnregister(session.id)}
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  Annuler
                </Button>
              ) : isFull ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onRegister(session.id)}
                  className="border-amber-500/50 text-amber-700 hover:bg-amber-50"
                >
                  Liste d'attente
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => onRegister(session.id)}
                >
                  S'inscrire
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ActivityDetailSessions;
