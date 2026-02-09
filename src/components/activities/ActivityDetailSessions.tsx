import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar, MapPin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Session {
  id: string;
  start_time: string;
  end_time: string;
  max_participants: number | null;
  status: string;
  rooms: { name: string } | null;
  activity_registrations: { id: string; user_id: string }[];
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
        const registrationCount = session.activity_registrations?.length || 0;
        const maxP = session.max_participants || 10;
        const isFull = registrationCount >= maxP;
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
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {registrationCount}/{maxP}
                </span>
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
              ) : (
                <Button
                  size="sm"
                  disabled={isFull || !isAuthenticated}
                  onClick={() => onRegister(session.id)}
                >
                  {isFull ? "Complet" : "S'inscrire"}
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
