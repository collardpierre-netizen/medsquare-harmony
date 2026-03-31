import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, addDays, isToday, isBefore, isAfter, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Clock, Users, Calendar } from "lucide-react";
import type { WidgetConfig } from "@/pages/Widget";

interface SessionWithActivity {
  id: string;
  start_time: string;
  end_time: string;
  max_participants: number | null;
  status: string;
  activity: {
    title: string;
    category: string;
  } | null;
  practitioner: {
    first_name: string;
    last_name: string;
  } | null;
  registered_count: number;
}

const WidgetSchedule = ({ config }: { config: WidgetConfig }) => {
  const [sessions, setSessions] = useState<SessionWithActivity[]>([]);
  const [now, setNow] = useState(new Date());

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchSessions = async () => {
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      const weekEnd = addDays(weekStart, 7);

      const { data: sessionsData } = await supabase
        .from("activity_sessions")
        .select("id, start_time, end_time, max_participants, status, activity_id")
        .gte("start_time", weekStart.toISOString())
        .lt("start_time", weekEnd.toISOString())
        .eq("status", "scheduled")
        .order("start_time");

      if (!sessionsData || sessionsData.length === 0) {
        setSessions([]);
        return;
      }

      // Fetch activities
      const activityIds = [...new Set(sessionsData.map((s) => s.activity_id))];
      const { data: activities } = await supabase
        .from("activities")
        .select("id, title, category, practitioner_id")
        .in("id", activityIds);

      // Fetch practitioners
      const practitionerIds = [...new Set((activities || []).map((a) => a.practitioner_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", practitionerIds);

      // Fetch registration counts
      const counts: Record<string, number> = {};
      for (const s of sessionsData) {
        const { data: countData } = await supabase.rpc("count_session_registrations", { session_uuid: s.id });
        counts[s.id] = (countData as number) || 0;
      }

      const enriched: SessionWithActivity[] = sessionsData.map((s) => {
        const activity = activities?.find((a) => a.id === s.activity_id);
        const practitioner = activity ? profiles?.find((p) => p.id === activity.practitioner_id) : null;
        return {
          ...s,
          activity: activity ? { title: activity.title, category: activity.category } : null,
          practitioner: practitioner ? { first_name: practitioner.first_name, last_name: practitioner.last_name } : null,
          registered_count: counts[s.id] || 0,
        };
      });

      setSessions(enriched);
    };
    fetchSessions();
    // Auto-refresh every 5 minutes
    const refreshInterval = setInterval(fetchSessions, 5 * 60_000);
    return () => clearInterval(refreshInterval);
  }, []);

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const weekLabel = `${format(days[0], "d MMM", { locale: fr })} – ${format(days[6], "d MMM yyyy", { locale: fr })}`;

  const getSessionsForDay = (day: Date) => {
    const dayStr = format(day, "yyyy-MM-dd");
    return sessions.filter((s) => s.start_time.startsWith(dayStr));
  };

  const isCurrentSession = (s: SessionWithActivity) => {
    const start = parseISO(s.start_time);
    const end = parseISO(s.end_time);
    return !isBefore(now, start) && !isAfter(now, end);
  };

  const isPastSession = (s: SessionWithActivity) => {
    return isAfter(now, parseISO(s.end_time));
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Week header */}
      <div className="flex items-center justify-between px-2 pb-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold">Planning de la semaine</h2>
        </div>
        <span className="text-sm text-muted-foreground">{weekLabel}</span>
      </div>

      {/* Days grid */}
      <div className="flex-1 grid grid-cols-7 gap-2 overflow-hidden min-h-0">
        {days.map((day) => {
          const daySessions = getSessionsForDay(day);
          const today = isToday(day);

          return (
            <div
              key={day.toISOString()}
              className={`flex flex-col rounded-xl border overflow-hidden min-h-0 ${
                today
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-card"
              }`}
            >
              {/* Day header */}
              <div className={`text-center py-2 shrink-0 ${today ? "bg-primary/10" : "bg-muted/30"}`}>
                <div className={`text-[11px] uppercase tracking-wide font-medium ${today ? "text-primary" : "text-muted-foreground"}`}>
                  {format(day, "EEE", { locale: fr })}
                </div>
                <div className={`text-xl font-bold ${today ? "text-primary" : ""}`}>
                  {format(day, "d")}
                </div>
              </div>

              {/* Sessions list */}
              <div className="flex-1 overflow-y-auto p-1.5 space-y-1.5">
                {daySessions.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">—</p>
                )}
                {daySessions.map((s) => {
                  const current = isCurrentSession(s);
                  const past = isPastSession(s);
                  return (
                    <div
                      key={s.id}
                      className={`rounded-lg p-2 text-xs space-y-0.5 transition-all ${
                        current
                          ? "bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30"
                          : past
                          ? "bg-muted/40 text-muted-foreground opacity-60"
                          : "bg-accent/60"
                      }`}
                    >
                      <p className={`font-semibold truncate ${current ? "" : "text-foreground"}`} style={past ? { color: "inherit" } : {}}>
                        {s.activity?.title || "Activité"}
                      </p>
                      <p className="flex items-center gap-1 opacity-80">
                        <Clock className="h-2.5 w-2.5 shrink-0" />
                        {format(parseISO(s.start_time), "HH:mm")}–{format(parseISO(s.end_time), "HH:mm")}
                      </p>
                      {s.practitioner && (
                        <p className="truncate opacity-80">
                          {s.practitioner.first_name} {s.practitioner.last_name}
                        </p>
                      )}
                      {s.max_participants && (
                        <p className="flex items-center gap-1 opacity-70">
                          <Users className="h-2.5 w-2.5 shrink-0" />
                          {s.registered_count}/{s.max_participants} places
                        </p>
                      )}
                      {current && (
                        <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] font-bold uppercase tracking-wider">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary-foreground animate-pulse" />
                          En cours
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WidgetSchedule;
