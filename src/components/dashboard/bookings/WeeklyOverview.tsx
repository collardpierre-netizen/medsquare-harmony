import { useEffect, useState, useMemo } from "react";
import { addDays, format, startOfDay, isBefore, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getOpeningHours, type Booking, type ActivitySessionSlot } from "./utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Lock, Repeat } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface WeeklyOverviewProps {
  weekStart: Date;
  selectedRoom: string;
  rooms: any[];
  onSlotClick: (day: Date) => void;
  onActivityClick?: (session: ActivitySessionSlot) => void;
  onBookingClick?: (booking: Booking) => void;
}

const WeeklyOverview = ({ weekStart, selectedRoom, rooms, onSlotClick, onActivityClick, onBookingClick }: WeeklyOverviewProps) => {
  const [weekBookings, setWeekBookings] = useState<Booking[]>([]);
  const [weekActivities, setWeekActivities] = useState<ActivitySessionSlot[]>([]);
  const isMobile = useIsMobile();

  const allWeekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  // On mobile, hide past days to save space (keep today + future)
  const weekDays = useMemo(() => {
    if (!isMobile) return allWeekDays;
    const today = startOfDay(new Date());
    const future = allWeekDays.filter((d) => !isBefore(startOfDay(d), today));
    // Always show at least today (or the closest future day)
    return future.length > 0 ? future : allWeekDays.slice(-1);
  }, [allWeekDays, isMobile]);

  const allHours = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => i + 8);
  }, []);

  useEffect(() => {
    if (!selectedRoom) return;

    const fetchWeekData = async () => {
      const weekEnd = addDays(weekStart, 7);

      const [{ data: bookingsData }, { data: sessionsData }] = await Promise.all([
        supabase
          .from("bookings")
          .select("*, profiles(first_name, last_name)")
          .eq("room_id", selectedRoom)
          .gte("start_time", startOfDay(weekStart).toISOString())
          .lt("start_time", weekEnd.toISOString())
          .neq("status", "cancelled")
          .order("start_time"),
        supabase
          .from("activity_sessions")
          .select("*, activities(title, category, profiles(first_name, last_name))")
          .eq("room_id", selectedRoom)
          .gte("start_time", startOfDay(weekStart).toISOString())
          .lt("start_time", weekEnd.toISOString())
          .eq("status", "scheduled")
          .order("start_time"),
      ]);

      setWeekBookings((bookingsData as Booking[]) || []);
      setWeekActivities((sessionsData as ActivitySessionSlot[]) || []);
    };

    fetchWeekData();
  }, [weekStart, selectedRoom]);

  const getBookingsForDay = (day: Date) => {
    const dayBrussels = toBrusselsDay(day);
    return weekBookings.filter((b) => isSameDay(toBrusselsDay(new Date(b.start_time)), dayBrussels));
  };

  const getActivitiesForDay = (day: Date) => {
    const dayBrussels = toBrusselsDay(day);
    return weekActivities.filter((a) => isSameDay(toBrusselsDay(new Date(a.start_time)), dayBrussels));
  };

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

  // Get Brussels offset in hours for a given date (handles DST: CET=+1, CEST=+2)
  const getBrusselsOffsetHours = (date: Date): number => {
    const utcHour = date.getUTCHours() + date.getUTCMinutes() / 60;
    const brHour = getBrusselsHour(date) + date.getUTCMinutes() / 60;
    let diff = brHour - utcHour;
    if (diff < -12) diff += 24;
    if (diff > 12) diff -= 24;
    return diff;
  };

  const isHourBooked = (day: Date, hour: number) => {
    const dayBrussels = toBrusselsDay(day);
    const offset = getBrusselsOffsetHours(day);
    const slotStartUTC = new Date(dayBrussels);
    slotStartUTC.setUTCHours(hour - offset, 0, 0, 0);
    const slotEndUTC = new Date(dayBrussels);
    slotEndUTC.setUTCHours(hour - offset + 1, 0, 0, 0);
    return weekBookings.some((b) => {
      const start = new Date(b.start_time);
      const end = new Date(b.end_time);
      if (!isSameDay(toBrusselsDay(start), dayBrussels) && !isSameDay(toBrusselsDay(end), dayBrussels)) return false;
      return start.getTime() < slotEndUTC.getTime() && end.getTime() > slotStartUTC.getTime();
    });
  };

  const isHourActivity = (day: Date, hour: number) => {
    const dayBrussels = toBrusselsDay(day);
    const offset = getBrusselsOffsetHours(day);
    const slotStartUTC = new Date(dayBrussels);
    slotStartUTC.setUTCHours(hour - offset, 0, 0, 0);
    const slotEndUTC = new Date(dayBrussels);
    slotEndUTC.setUTCHours(hour - offset + 1, 0, 0, 0);
    return weekActivities.some((a) => {
      const start = new Date(a.start_time);
      const end = new Date(a.end_time);
      if (!isSameDay(toBrusselsDay(start), dayBrussels) && !isSameDay(toBrusselsDay(end), dayBrussels)) return false;
      return start.getTime() < slotEndUTC.getTime() && end.getTime() > slotStartUTC.getTime();
    });
  };

  const getBookingAtHour = (day: Date, hour: number) => {
    const dayBrussels = toBrusselsDay(day);
    return weekBookings.find((b) => {
      const start = new Date(b.start_time);
      return isSameDay(toBrusselsDay(start), dayBrussels) && getBrusselsHour(start) === hour;
    });
  };

  /** Réservation couvrant ce créneau horaire, même si elle a démarré à une heure antérieure. */
  const getBookingCoveringHour = (day: Date, hour: number) => {
    const dayBrussels = toBrusselsDay(day);
    const offset = getBrusselsOffsetHours(day);
    const slotStartUTC = new Date(dayBrussels);
    slotStartUTC.setUTCHours(hour - offset, 0, 0, 0);
    const slotEndUTC = new Date(dayBrussels);
    slotEndUTC.setUTCHours(hour - offset + 1, 0, 0, 0);
    return weekBookings.find((b) => {
      const start = new Date(b.start_time);
      const end = new Date(b.end_time);
      if (!isSameDay(toBrusselsDay(start), dayBrussels) && !isSameDay(toBrusselsDay(end), dayBrussels)) return false;
      return start.getTime() < slotEndUTC.getTime() && end.getTime() > slotStartUTC.getTime();
    });
  };

  const getActivityAtHour = (day: Date, hour: number) => {
    const dayBrussels = toBrusselsDay(day);
    return weekActivities.find((a) => {
      const start = new Date(a.start_time);
      return isSameDay(toBrusselsDay(start), dayBrussels) && getBrusselsHour(start) === hour;
    });
  };

  const isHourInOpeningRange = (day: Date, hour: number) => {
    const { start, end } = getOpeningHours(day);
    return hour >= start && hour < end;
  };

  const roomName = rooms.find((r) => r.id === selectedRoom)?.name || "Salle";

  return (
    <TooltipProvider delayDuration={200}>
    <Card>
      {/* SVG pattern definitions for diagonal hatching */}
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <pattern id="week-hatch-booked" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="hsl(0 72% 40% / 0.75)" strokeWidth="2.5" />
          </pattern>
          <pattern id="week-hatch-recurring" patternUnits="userSpaceOnUse" width="5" height="5">
            <line x1="0" y1="0" x2="5" y2="5" stroke="hsl(0 74% 30% / 0.85)" strokeWidth="1.8" />
            <line x1="5" y1="0" x2="0" y2="5" stroke="hsl(0 74% 30% / 0.85)" strokeWidth="1.8" />
          </pattern>
          <pattern id="week-hatch-privatise" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(-45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="hsl(0 72% 35% / 0.8)" strokeWidth="3" />
          </pattern>
          <pattern id="week-hatch-activity" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="rgb(249 115 22 / 0.45)" strokeWidth="2" />
          </pattern>
        </defs>
      </svg>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="font-display text-base">
            Planning hebdomadaire — {roomName}
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
            {isMobile && allWeekDays.length !== weekDays.length && (
              <span className="text-[10px] text-muted-foreground/70 italic">
                {allWeekDays.length - weekDays.length} jour{allWeekDays.length - weekDays.length > 1 ? "s" : ""} passé{allWeekDays.length - weekDays.length > 1 ? "s" : ""} masqué{allWeekDays.length - weekDays.length > 1 ? "s" : ""}
              </span>
            )}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-accent border border-border" />
                Libre
              </div>
              <div className="flex items-center gap-1.5">
                <svg className="w-3 h-3 rounded overflow-hidden border border-red-400/50" viewBox="0 0 12 12">
                  <rect width="12" height="12" fill="rgb(239 68 68 / 0.15)" />
                  <rect width="12" height="12" fill="url(#week-hatch-booked)" />
                </svg>
                Réservé ponctuel
              </div>
              <div className="flex items-center gap-1.5">
                <svg className="w-3 h-3 rounded overflow-hidden border border-red-700/60" viewBox="0 0 12 12">
                  <rect width="12" height="12" fill="rgb(185 28 28 / 0.25)" />
                  <rect width="12" height="12" fill="url(#week-hatch-recurring)" />
                </svg>
                Réservé récurrent
              </div>
              <div className="flex items-center gap-1.5">
                <svg className="w-3 h-3 rounded overflow-hidden border border-orange-500/30" viewBox="0 0 12 12">
                  <rect width="12" height="12" fill="rgb(249 115 22 / 0.15)" />
                  <rect width="12" height="12" fill="url(#week-hatch-activity)" />
                </svg>
                Activité
              </div>
              <div className="flex items-center gap-1.5">
                <svg className="w-3 h-3 rounded overflow-hidden border border-red-500/30" viewBox="0 0 12 12">
                  <rect width="12" height="12" fill="rgb(239 68 68 / 0.15)" />
                  <rect width="12" height="12" fill="url(#week-hatch-privatise)" />
                </svg>
                🔒 Privatisé
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth: `${weekDays.length * 90 + 64}px` }}>
            <thead>
              <tr>
                <th className="text-left text-xs font-semibold text-muted-foreground p-2 w-16 sticky left-0 bg-card">
                  Heure
                </th>
                {weekDays.map((day) => {
                  const isToday = isSameDay(day, new Date());
                  const isPast = isBefore(day, startOfDay(new Date()));
                  const dayBookings = getBookingsForDay(day);
                  const dayActivities = getActivitiesForDay(day);
                  const { start, end } = getOpeningHours(day);

                  return (
                    <th
                      key={day.toISOString()}
                      className={cn(
                        "text-center p-2 min-w-[90px]",
                        isToday && "bg-accent/50 rounded-t-lg"
                      )}
                    >
                      <button
                        onClick={() => !isPast && onSlotClick(day)}
                        disabled={isPast}
                        className={cn(
                          "flex flex-col items-center w-full",
                          isPast ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:opacity-80"
                        )}
                      >
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {format(day, "EEE", { locale: fr })}
                        </span>
                        <span className={cn(
                          "text-lg font-bold",
                          isToday && "text-primary"
                        )}>
                          {format(day, "d")}
                        </span>
                        <span className="text-[9px] text-muted-foreground">
                          {start}h–{end}h
                        </span>
                        <div className="flex gap-1 mt-0.5">
                          {dayBookings.length > 0 && (
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                              {dayBookings.length} rés.
                            </Badge>
                          )}
                          {dayActivities.length > 0 && (
                            <Badge className="text-[9px] px-1.5 py-0 bg-orange-500/20 text-orange-700 border-orange-500/30 hover:bg-orange-500/30">
                              {dayActivities.length} act.
                            </Badge>
                          )}
                        </div>
                      </button>
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
                    const isPast = isBefore(day, startOfDay(new Date()));
                    const inRange = isHourInOpeningRange(day, hour);
                    const booked = inRange && isHourBooked(day, hour);
                    const activity = inRange && isHourActivity(day, hour);
                    const booking = inRange ? getBookingAtHour(day, hour) : undefined;
                    const actSession = inRange ? getActivityAtHour(day, hour) : undefined;
                    const isToday = isSameDay(day, new Date());
                    const isOccupied = booked || activity;

                    // Réservation couvrant ce créneau (même si elle a commencé plus tôt)
                    const coveringBooking = inRange ? booking ?? getBookingCoveringHour(day, hour) : undefined;
                    const isPrivatise = coveringBooking?.notes?.includes("[Privatisé]");
                    const isRecurring = !!coveringBooking?.recurrence_group_id;

                    const cellContent = (
                          <div
                          className={cn(
                            "rounded-lg h-10 flex items-center justify-center text-[10px] font-medium transition-all relative overflow-hidden",
                            !inRange
                              ? "bg-muted/30 text-muted-foreground/20"
                              : isPast
                              ? "bg-muted/50 text-muted-foreground/30"
                              : activity
                              ? "bg-orange-500/25 text-orange-800 border border-orange-500/40"
                              : isPrivatise
                              ? "bg-red-500/20 text-red-800 border-2 border-dashed border-red-500/60 cursor-pointer hover:bg-red-500/30"
                              : booked && isRecurring
                              ? "bg-red-700/25 text-red-900 border border-red-700/60 cursor-pointer hover:bg-red-700/35"
                              : booked
                              ? "bg-red-500/15 text-red-700 border border-red-400/50 cursor-pointer hover:bg-red-500/25"
                              : "bg-accent/50 border border-border/50 hover:border-primary/40 hover:bg-accent cursor-pointer"
                          )}
                          onClick={() => {
                            if (activity && actSession && onActivityClick) {
                              onActivityClick(actSession);
                            } else if (booked && booking && onBookingClick) {
                              onBookingClick(booking);
                            } else if (inRange && !isPast && !isOccupied) {
                              onSlotClick(day);
                            }
                          }}
                          style={(activity || booked) ? { cursor: "pointer" } : undefined}
                        >
                          {/* Diagonal hatching overlay for occupied slots */}
                          {inRange && !isPast && isOccupied && (
                            <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
                              <rect width="100%" height="100%" fill={activity ? "url(#week-hatch-activity)" : isPrivatise ? "url(#week-hatch-privatise)" : isRecurring ? "url(#week-hatch-recurring)" : "url(#week-hatch-booked)"} />
                            </svg>
                          )}
                          {actSession && (
                            <span className="truncate px-1 relative z-10">
                              {actSession.activities?.title?.slice(0, 8) || "Act."}
                            </span>
                          )}
                          {booking && !activity && (
                            <span className="truncate px-1 relative z-10 flex items-center gap-0.5">
                              {booking.notes?.includes("[Privatisé]") && <Lock className="h-3 w-3 shrink-0" />}
                              {booking.recurrence_group_id && !booking.notes?.includes("[Privatisé]") && (
                                <Repeat className="h-3 w-3 shrink-0" />
                              )}
                              {booking.profiles?.first_name?.[0]}.{booking.profiles?.last_name?.[0]}.
                            </span>
                          )}
                        </div>
                    );

                    // Build tooltip
                    const tooltipLines: string[] = [];
                    if (booking) {
                      const name = booking.profiles ? `${booking.profiles.first_name} ${booking.profiles.last_name}` : "Inconnu";
                      const timeStr = `${format(new Date(booking.start_time), "HH:mm")}–${format(new Date(booking.end_time), "HH:mm")}`;
                      const privLabel = booking.notes?.includes("[Privatisé]") ? "🔒 Privatisé · " : "";
                      const recLabel = booking.recurrence_group_id ? " · ↻ récurrent" : " · ponctuel";
                      tooltipLines.push(`📅 ${privLabel}${name} · ${timeStr}${privLabel ? "" : recLabel}`);
                    }
                    if (actSession) {
                      const p = (actSession as any).activities?.profiles;
                      const name = p ? `${p.first_name} ${p.last_name}` : "";
                      const timeStr = `${format(new Date(actSession.start_time), "HH:mm")}–${format(new Date(actSession.end_time), "HH:mm")}`;
                      tooltipLines.push(`🎯 ${actSession.activities?.title || "Activité"} · ${timeStr}${name ? ` · ${name}` : ""}`);
                    }

                    return (
                      <td
                        key={day.toISOString() + hour}
                        className={cn(
                          "p-1 text-center",
                          isToday && "bg-accent/30"
                        )}
                      >
                        {isOccupied && tooltipLines.length > 0 ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              {cellContent}
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs text-xs space-y-1">
                              {tooltipLines.map((line, i) => (
                                <p key={i} className="text-[11px] leading-tight">{line}</p>
                              ))}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          cellContent
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
    </TooltipProvider>
  );
};

export default WeeklyOverview;
