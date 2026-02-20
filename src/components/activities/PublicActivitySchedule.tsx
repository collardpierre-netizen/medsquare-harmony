import { useEffect, useState, useMemo, useCallback } from "react";
import { addDays, format, startOfWeek, isSameDay, isBefore, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import SessionRegistrationDialog from "./SessionRegistrationDialog";

interface PublicSession {
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
  registration_count?: number;
}

interface Props {
  selectedCategory?: string;
  search?: string;
}

const PublicActivitySchedule = ({ selectedCategory, search }: Props) => {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [sessions, setSessions] = useState<PublicSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<PublicSession | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const fetchSessions = useCallback(async () => {
    const weekEnd = addDays(weekStart, 7);
    const { data } = await supabase
      .from("activity_sessions")
      .select("*, rooms(name), activities(title, category, description, is_free, price, profiles(first_name, last_name))")
      .gte("start_time", startOfDay(weekStart).toISOString())
      .lt("start_time", weekEnd.toISOString())
      .in("status", ["scheduled", "full"])
      .order("start_time");

    // Fetch registration counts securely via RPC
    const sessionsWithCounts = await Promise.all(
      (data || []).map(async (session: any) => {
        const { data: count } = await supabase.rpc(
          "count_session_registrations",
          { session_uuid: session.id }
        );
        return { ...session, registration_count: count || 0 };
      })
    );
    setSessions(sessionsWithCounts as PublicSession[]);
  }, [weekStart]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (selectedCategory && selectedCategory !== "all" && s.activities?.category !== selectedCategory) return false;
      if (search && !s.activities?.title?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [sessions, selectedCategory, search]);

  const getSessionsForDay = (day: Date) =>
    filteredSessions.filter((s) => isSameDay(new Date(s.start_time), day));

  const handleSessionClick = (session: PublicSession) => {
    setSelectedSession(session);
    setShowDialog(true);
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="font-display text-base">
              Planning de la semaine
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setWeekStart(addDays(weekStart, -7))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[160px] text-center">
                {format(weekStart, "d MMM", { locale: fr })} – {format(addDays(weekStart, 6), "d MMM yyyy", { locale: fr })}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setWeekStart(addDays(weekStart, 7))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
            {weekDays.map((day) => {
              const daySessions = getSessionsForDay(day);
              const isToday = isSameDay(day, new Date());
              const isPast = isBefore(day, startOfDay(new Date()));

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "rounded-xl border p-3 min-h-[120px]",
                    isToday ? "border-primary/30 bg-primary/5" : "border-border",
                    isPast && "opacity-50"
                  )}
                >
                  <div className="text-center mb-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {format(day, "EEE", { locale: fr })}
                    </p>
                    <p className={cn("text-lg font-bold", isToday && "text-primary")}>
                      {format(day, "d")}
                    </p>
                  </div>

                  {daySessions.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground text-center">—</p>
                  ) : (
                    <div className="space-y-2">
                      {daySessions.map((session) => {
                        const regCount = session.registration_count || 0;
                        const maxP = session.max_participants;
                        const isFull = maxP ? regCount >= maxP : false;

                        return (
                          <button
                            key={session.id}
                            onClick={() => handleSessionClick(session)}
                            className="w-full text-left rounded-lg bg-accent/60 border border-border/50 p-2 text-[11px] hover:bg-accent hover:border-primary/30 transition-all cursor-pointer"
                          >
                            <p className="font-semibold truncate">
                              {session.activities?.title}
                            </p>
                            <p className="text-muted-foreground">
                              {format(new Date(session.start_time), "HH:mm")}–
                              {format(new Date(session.end_time), "HH:mm")}
                            </p>
                            {session.rooms?.name && (
                              <p className="text-muted-foreground flex items-center gap-0.5 mt-0.5">
                                <MapPin className="h-3 w-3" />
                                {session.rooms.name}
                              </p>
                            )}
                            {session.activities?.profiles && (
                              <p className="text-muted-foreground mt-0.5">
                                {session.activities.profiles.first_name} {session.activities.profiles.last_name}
                              </p>
                            )}
                            <div className="mt-1">
                              <Badge
                                variant={isFull ? "destructive" : "secondary"}
                                className="text-[9px] px-1.5 py-0"
                              >
                                {isFull ? "Complet" : `${regCount}/${maxP || "∞"} places`}
                              </Badge>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <SessionRegistrationDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        session={selectedSession}
        onRegistrationChange={fetchSessions}
      />
    </>
  );
};

export default PublicActivitySchedule;
