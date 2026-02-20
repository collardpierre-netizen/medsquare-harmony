import { useEffect, useState, useMemo } from "react";
import { addDays, format, startOfDay, startOfWeek, isSameDay, isBefore } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CalendarDays, List, MapPin, Clock, Users, Lock } from "lucide-react";
import { getOpeningHours, type Booking, type ActivitySessionSlot } from "./utils";

type SubView = "week" | "agenda";

interface MyPlanningViewProps {
  weekStart: Date;
  profileId: string;
  isAdmin: boolean;
  rooms: any[];
  onBookingClick?: (booking: Booking) => void;
  onActivityClick?: (session: ActivitySessionSlot) => void;
}

interface UnifiedEvent {
  id: string;
  type: "booking" | "activity";
  title: string;
  roomName: string;
  roomId: string;
  startTime: string;
  endTime: string;
  status: string;
  category?: string;
  practitionerName?: string;
  raw: Booking | ActivitySessionSlot;
}

const MyPlanningView = ({
  weekStart,
  profileId,
  isAdmin,
  rooms,
  onBookingClick,
  onActivityClick,
}: MyPlanningViewProps) => {
  const [subView, setSubView] = useState<SubView>("week");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [activities, setActivities] = useState<ActivitySessionSlot[]>([]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const allHours = useMemo(() => Array.from({ length: 14 }, (_, i) => i + 8), []);

  const roomMap = useMemo(() => {
    const map: Record<string, string> = {};
    rooms.forEach((r: any) => (map[r.id] = r.name));
    return map;
  }, [rooms]);

  useEffect(() => {
    if (!profileId) return;

    const fetchData = async () => {
      const weekEnd = addDays(weekStart, 7);
      const start = startOfDay(weekStart).toISOString();
      const end = weekEnd.toISOString();

      // Bookings: mine (or all if admin)
      let bookingsQuery = supabase
        .from("bookings")
        .select("*, profiles(first_name, last_name)")
        .gte("start_time", start)
        .lt("start_time", end)
        .neq("status", "cancelled")
        .order("start_time");

      if (!isAdmin) {
        bookingsQuery = bookingsQuery.eq("practitioner_id", profileId);
      }

      // Activity sessions: mine (or all if admin)
      let sessionsQuery = supabase
        .from("activity_sessions")
        .select("*, activities(title, category, practitioner_id, profiles(first_name, last_name))")
        .gte("start_time", start)
        .lt("start_time", end)
        .eq("status", "scheduled")
        .order("start_time");

      const [{ data: bData }, { data: sData }] = await Promise.all([
        bookingsQuery,
        sessionsQuery,
      ]);

      setBookings((bData as Booking[]) || []);

      // Filter activities to only mine if not admin
      let filteredSessions = (sData as ActivitySessionSlot[]) || [];
      if (!isAdmin) {
        filteredSessions = filteredSessions.filter(
          (s: any) => s.activities?.practitioner_id === profileId
        );
      }
      setActivities(filteredSessions);
    };

    fetchData();
  }, [weekStart, profileId, isAdmin]);

  // Build unified events
  const events: UnifiedEvent[] = useMemo(() => {
    const result: UnifiedEvent[] = [];
    bookings.forEach((b) => {
      const isPrivatise = b.notes?.includes("[Privatisé]");
      result.push({
        id: b.id,
        type: "booking",
        title: isPrivatise
          ? `🔒 ${b.profiles?.first_name || ""} ${b.profiles?.last_name || ""}`.trim()
          : `${b.profiles?.first_name || ""} ${b.profiles?.last_name || ""}`.trim() || "Réservation",
        roomName: roomMap[b.room_id] || "Salle",
        roomId: b.room_id,
        startTime: b.start_time,
        endTime: b.end_time,
        status: b.status,
        raw: b,
      });
    });
    activities.forEach((a) => {
      result.push({
        id: a.id,
        type: "activity",
        title: a.activities?.title || "Activité",
        roomName: a.room_id ? roomMap[a.room_id] || "Salle" : "—",
        roomId: a.room_id || "",
        startTime: a.start_time,
        endTime: a.end_time,
        status: a.status,
        category: a.activities?.category,
        practitionerName: `${a.activities?.profiles?.first_name || ""} ${a.activities?.profiles?.last_name || ""}`.trim(),
        raw: a,
      });
    });
    return result.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [bookings, activities, roomMap]);

  // Get hour in Europe/Brussels timezone
  const getBrusselsHour = (date: Date): number =>
    parseInt(
      new Intl.DateTimeFormat("fr-BE", {
        timeZone: "Europe/Brussels",
        hour: "numeric",
        hour12: false,
      }).format(date),
      10
    );

  // Get Brussels calendar day as a plain Date (midnight local) for isSameDay comparison
  const toBrusselsDay = (date: Date): Date => {
    const parts = new Intl.DateTimeFormat("fr-BE", {
      timeZone: "Europe/Brussels",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const y = parseInt(parts.find((p) => p.type === "year")!.value);
    const m = parseInt(parts.find((p) => p.type === "month")!.value) - 1;
    const d = parseInt(parts.find((p) => p.type === "day")!.value);
    return new Date(y, m, d);
  };

  // Get Brussels offset in hours for a given date (handles DST)
  const getBrusselsOffsetHours = (date: Date): number => {
    // Create a UTC date and a Brussels date string, compute difference
    const utcHour = date.getUTCHours() + date.getUTCMinutes() / 60;
    const brHour = getBrusselsHour(date) + date.getUTCMinutes() / 60;
    let diff = brHour - utcHour;
    if (diff < -12) diff += 24;
    if (diff > 12) diff -= 24;
    return diff;
  };

  const getEventsForDayHour = (day: Date, hour: number) => {
    const dayBrussels = toBrusselsDay(day);
    return events.filter((e) => {
      const start = new Date(e.startTime);
      const end = new Date(e.endTime);
      if (!isSameDay(toBrusselsDay(start), dayBrussels) && !isSameDay(toBrusselsDay(end), dayBrussels)) return false;
      // Convert slot boundaries to UTC milliseconds using Brussels offset
      const offset = getBrusselsOffsetHours(day);
      const slotStartUTC = new Date(dayBrussels);
      slotStartUTC.setUTCHours(hour - offset, 0, 0, 0);
      const slotEndUTC = new Date(dayBrussels);
      slotEndUTC.setUTCHours(hour - offset + 1, 0, 0, 0);
      return start.getTime() < slotEndUTC.getTime() && end.getTime() > slotStartUTC.getTime();
    });
  };

  const getEventsForDay = (day: Date) => {
    const dayBrussels = toBrusselsDay(day);
    return events.filter((e) => isSameDay(toBrusselsDay(new Date(e.startTime)), dayBrussels));
  };

  const handleEventClick = (event: UnifiedEvent) => {
    if (event.type === "booking" && onBookingClick) {
      onBookingClick(event.raw as Booking);
    } else if (event.type === "activity" && onActivityClick) {
      onActivityClick(event.raw as ActivitySessionSlot);
    }
  };

  const statusBadge = (status: string, type: string) => {
    if (type === "activity") {
      return (
        <Badge className="text-[9px] px-1.5 py-0 bg-orange-500/20 text-orange-700 border-orange-500/30">
          Activité
        </Badge>
      );
    }
    switch (status) {
      case "confirmed":
        return <Badge className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">Confirmée</Badge>;
      case "pending":
        return <Badge className="text-[9px] px-1.5 py-0 bg-yellow-50 text-yellow-700 border-yellow-200">En attente</Badge>;
      default:
        return <Badge variant="secondary" className="text-[9px] px-1.5 py-0">{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="font-display text-base">
            {isAdmin ? "Planning global" : "Mon planning"}
          </CardTitle>
          <div className="flex items-center gap-3">
            {/* Legend */}
            <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-primary/20 border border-primary/30" />
                Réservation
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-orange-500/20 border border-orange-500/30" />
                Activité
              </div>
            </div>
            {/* Sub-view toggle */}
            <div className="flex items-center bg-muted rounded-lg p-1">
              <button
                onClick={() => setSubView("week")}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                  subView === "week"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Semaine
              </button>
              <button
                onClick={() => setSubView("agenda")}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                  subView === "agenda"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <List className="h-3.5 w-3.5" />
                Agenda
              </button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {subView === "week" ? (
          /* ─── Week Grid ─── */
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[640px]">
              <thead>
                <tr>
                  <th className="text-left text-xs font-semibold text-muted-foreground p-2 w-16 sticky left-0 bg-card">
                    Heure
                  </th>
                  {weekDays.map((day) => {
                    const isToday = isSameDay(day, new Date());
                    const isPast = isBefore(day, startOfDay(new Date()));
                    const dayEvents = getEventsForDay(day);

                    return (
                      <th
                        key={day.toISOString()}
                        className={cn("text-center p-2 min-w-[90px]", isToday && "bg-accent/50 rounded-t-lg")}
                      >
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {format(day, "EEE", { locale: fr })}
                          </span>
                          <span className={cn("text-lg font-bold", isToday && "text-primary", isPast && "opacity-40")}>
                            {format(day, "d")}
                          </span>
                          {dayEvents.length > 0 && (
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 mt-0.5">
                              {dayEvents.length}
                            </Badge>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {allHours.map((hour) => (
                  <tr key={hour} className="border-t border-border/50">
                    <td className="text-xs font-medium text-muted-foreground p-2 sticky left-0 bg-card">
                      {String(hour).padStart(2, "0")}:00
                    </td>
                    {weekDays.map((day) => {
                      const isToday = isSameDay(day, new Date());
                      const isPast = isBefore(day, startOfDay(new Date()));
                      const inRange = (() => {
                        const { start, end } = getOpeningHours(day);
                        return hour >= start && hour < end;
                      })();
                      const cellEvents = inRange ? getEventsForDayHour(day, hour) : [];
                      const hasBooking = cellEvents.some((e) => e.type === "booking");
                      const hasActivity = cellEvents.some((e) => e.type === "activity");
                      const firstEvent = cellEvents[0];

                      return (
                        <td
                          key={day.toISOString() + hour}
                          className={cn("p-1 text-center", isToday && "bg-accent/30")}
                        >
                          <div
                            className={cn(
                              "rounded-lg h-10 flex items-center justify-center text-[10px] font-medium transition-all",
                              !inRange
                                ? "bg-muted/30 text-muted-foreground/20"
                                : isPast
                                ? "bg-muted/50 text-muted-foreground/30"
                                : hasActivity && hasBooking
                                ? "bg-gradient-to-r from-primary/15 to-orange-500/15 border border-primary/20 cursor-pointer"
                                : hasActivity
                                ? "bg-orange-500/15 text-orange-700 border border-orange-500/20 cursor-pointer hover:bg-orange-500/25"
                                : hasBooking
                                ? "bg-primary/15 text-primary/70 border border-primary/20 cursor-pointer hover:bg-primary/25"
                                : "bg-accent/50 border border-border/50"
                            )}
                            onClick={() => firstEvent && handleEventClick(firstEvent)}
                          >
                            {firstEvent && (
                              <span className="truncate px-1">
                                {firstEvent.type === "activity"
                                  ? firstEvent.title.slice(0, 8)
                                  : firstEvent.roomName.slice(0, 8)}
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* ─── Agenda View ─── */
          <div className="space-y-4">
            {weekDays.map((day) => {
              const dayEvents = getEventsForDay(day);
              const isToday = isSameDay(day, new Date());
              const isPast = isBefore(day, startOfDay(new Date()));
              if (dayEvents.length === 0 && isPast) return null;

              return (
                <div key={day.toISOString()}>
                  <div
                    className={cn(
                      "flex items-center gap-2 mb-2 px-1",
                      isToday && "text-primary"
                    )}
                  >
                    <span className="font-semibold text-sm capitalize">
                      {format(day, "EEEE d MMMM", { locale: fr })}
                    </span>
                    {isToday && (
                      <Badge className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">
                        Aujourd'hui
                      </Badge>
                    )}
                  </div>
                  {dayEvents.length === 0 ? (
                    <p className="text-xs text-muted-foreground pl-1 pb-2">Aucun événement</p>
                  ) : (
                    <div className="space-y-2">
                      {dayEvents.map((event) => (
                        <div
                          key={event.id}
                          onClick={() => handleEventClick(event)}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all hover:shadow-sm",
                            event.type === "activity"
                              ? "bg-orange-500/5 border-orange-500/20 hover:bg-orange-500/10"
                              : "bg-card border-border hover:bg-accent/50"
                          )}
                        >
                          <div
                            className={cn(
                              "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                              event.type === "activity"
                                ? "bg-orange-500/15"
                                : "bg-primary/10"
                            )}
                          >
                            {event.type === "activity" ? (
                              <Users className="h-5 w-5 text-orange-600" />
                            ) : (
                              <Clock className="h-5 w-5 text-primary" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm truncate">{event.title}</p>
                              {statusBadge(event.status, event.type)}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Intl.DateTimeFormat("fr-BE", { timeZone: "Europe/Brussels", hour: "2-digit", minute: "2-digit" }).format(new Date(event.startTime))} — {new Intl.DateTimeFormat("fr-BE", { timeZone: "Europe/Brussels", hour: "2-digit", minute: "2-digit" }).format(new Date(event.endTime))}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {event.roomName}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {events.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-8">
                Aucun événement cette semaine.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MyPlanningView;
