import { useEffect, useState, useMemo } from "react";
import { addDays, format, startOfDay, isSameDay, isBefore } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getOpeningHours, type Booking, type ActivitySessionSlot } from "./utils";
import { Lock } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";

// Assign a stable color to each room
const ROOM_COLORS = [
  { bg: "bg-emerald-500/20", border: "border-emerald-500/40", text: "text-emerald-800", hatch: "rgb(16 185 129 / 0.5)", dot: "bg-emerald-500" },
  { bg: "bg-blue-500/20", border: "border-blue-500/40", text: "text-blue-800", hatch: "rgb(59 130 246 / 0.5)", dot: "bg-blue-500" },
  { bg: "bg-violet-500/20", border: "border-violet-500/40", text: "text-violet-800", hatch: "rgb(139 92 246 / 0.5)", dot: "bg-violet-500" },
  { bg: "bg-amber-500/20", border: "border-amber-500/40", text: "text-amber-800", hatch: "rgb(245 158 11 / 0.5)", dot: "bg-amber-500" },
  { bg: "bg-rose-500/20", border: "border-rose-500/40", text: "text-rose-800", hatch: "rgb(244 63 94 / 0.5)", dot: "bg-rose-500" },
  { bg: "bg-cyan-500/20", border: "border-cyan-500/40", text: "text-cyan-800", hatch: "rgb(6 182 212 / 0.5)", dot: "bg-cyan-500" },
];

interface WeeklyAllRoomsOverviewProps {
  weekStart: Date;
  rooms: any[];
  onBookingClick?: (booking: Booking) => void;
  onActivityClick?: (session: ActivitySessionSlot) => void;
}

const WeeklyAllRoomsOverview = ({
  weekStart,
  rooms,
  onBookingClick,
  onActivityClick,
}: WeeklyAllRoomsOverviewProps) => {
  const [weekBookings, setWeekBookings] = useState<Booking[]>([]);
  const [weekActivities, setWeekActivities] = useState<ActivitySessionSlot[]>([]);
  const isMobile = useIsMobile();

  const allWeekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const weekDays = useMemo(() => {
    if (!isMobile) return allWeekDays;
    const today = startOfDay(new Date());
    const future = allWeekDays.filter((d) => !isBefore(startOfDay(d), today));
    return future.length > 0 ? future : allWeekDays.slice(-1);
  }, [allWeekDays, isMobile]);

  const allHours = useMemo(() => Array.from({ length: 14 }, (_, i) => i + 8), []);

  // Room color mapping
  const roomColorMap = useMemo(() => {
    const map = new Map<string, typeof ROOM_COLORS[0]>();
    rooms.forEach((r, i) => map.set(r.id, ROOM_COLORS[i % ROOM_COLORS.length]));
    return map;
  }, [rooms]);

  useEffect(() => {
    const fetchWeekData = async () => {
      const weekEnd = addDays(weekStart, 7);
      const startISO = startOfDay(weekStart).toISOString();
      const endISO = weekEnd.toISOString();

      console.log("[WeeklyAllRooms] Fetching", { startISO, endISO, roomCount: rooms.length });

      const [{ data: bookingsData, error: bErr }, { data: sessionsData, error: sErr }] = await Promise.all([
        supabase
          .from("bookings")
          .select("*, profiles(first_name, last_name), rooms(name)")
          .gte("start_time", startISO)
          .lt("start_time", endISO)
          .neq("status", "cancelled")
          .order("start_time"),
        supabase
          .from("activity_sessions")
          .select("*, activities(title, category, profiles(first_name, last_name))")
          .gte("start_time", startISO)
          .lt("start_time", endISO)
          .eq("status", "scheduled")
          .order("start_time"),
      ]);

      console.log("[WeeklyAllRooms] Results", {
        bookings: bookingsData?.length ?? 0,
        activities: sessionsData?.length ?? 0,
        bErr,
        sErr,
        sampleBooking: bookingsData?.[0],
      });

      setWeekBookings((bookingsData as Booking[]) || []);
      setWeekActivities((sessionsData as ActivitySessionSlot[]) || []);
    };

    fetchWeekData();
  }, [weekStart]);

  // Brussels timezone helpers
  const getBrusselsHour = (date: Date): number =>
    parseInt(
      new Intl.DateTimeFormat("fr-BE", {
        timeZone: "Europe/Brussels",
        hour: "numeric",
        hour12: false,
      }).format(date),
      10
    );

  const getBrusselsMinute = (date: Date): number =>
    parseInt(
      new Intl.DateTimeFormat("fr-BE", {
        timeZone: "Europe/Brussels",
        minute: "numeric",
      }).format(date),
      10
    );

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

  // Get occupants for a specific room/day/hour
  const getOccupantsForCell = (day: Date, hour: number, roomId: string) => {
    const dayBrussels = toBrusselsDay(day);

    const matchingBookings = weekBookings.filter((b) => {
      if (b.room_id !== roomId) return false;
      const start = new Date(b.start_time);
      const end = new Date(b.end_time);
      if (!isSameDay(toBrusselsDay(start), dayBrussels) && !isSameDay(toBrusselsDay(end), dayBrussels)) return false;
      const startH = getBrusselsHour(start);
      const endH = getBrusselsHour(end);
      const endM = getBrusselsMinute(end);
      return startH <= hour && (endH > hour || (endH === hour && endM > 0));
    });

    const matchingActivities = weekActivities.filter((a) => {
      if (a.room_id !== roomId) return false;
      const start = new Date(a.start_time);
      const end = new Date(a.end_time);
      if (!isSameDay(toBrusselsDay(start), dayBrussels) && !isSameDay(toBrusselsDay(end), dayBrussels)) return false;
      const startH = getBrusselsHour(start);
      const endH = getBrusselsHour(end);
      const endM = getBrusselsMinute(end);
      return startH <= hour && (endH > hour || (endH === hour && endM > 0));
    });

    return { bookings: matchingBookings, activities: matchingActivities };
  };

  const isHourInOpeningRange = (day: Date, hour: number) => {
    const { start, end } = getOpeningHours(day);
    return hour >= start && hour < end;
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="font-display text-base">
              Planning hebdomadaire — Tous les cabinets
            </CardTitle>
            {/* Room legend */}
            <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
              {rooms.map((room) => {
                const color = roomColorMap.get(room.id);
                return (
                  <div key={room.id} className="flex items-center gap-1.5">
                    <div className={cn("w-3 h-3 rounded-sm", color?.dot)} />
                    <span>{room.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: `${weekDays.length * 120 + 64}px` }}>
              <thead>
                <tr>
                  <th className="text-left text-xs font-semibold text-muted-foreground p-2 w-16 sticky left-0 bg-card z-10">
                    Heure
                  </th>
                  {weekDays.map((day) => {
                    const isToday = isSameDay(day, new Date());
                    const { start, end } = getOpeningHours(day);
                    return (
                      <th
                        key={day.toISOString()}
                        className={cn(
                          "text-center p-2 min-w-[120px]",
                          isToday && "bg-accent/50 rounded-t-lg"
                        )}
                      >
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {format(day, "EEE", { locale: fr })}
                          </span>
                          <span className={cn("text-lg font-bold", isToday && "text-primary")}>
                            {format(day, "d")}
                          </span>
                          <span className="text-[9px] text-muted-foreground">
                            {start}h–{end}h
                          </span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {allHours.map((hour) => (
                  <tr key={hour} className="border-t border-border/50">
                    <td className="text-xs font-medium text-muted-foreground p-2 sticky left-0 bg-card z-10">
                      {String(hour).padStart(2, "0")}:00
                    </td>
                    {weekDays.map((day) => {
                      const isPast = isBefore(day, startOfDay(new Date()));
                      const isToday = isSameDay(day, new Date());
                      const inRange = isHourInOpeningRange(day, hour);

                      // Collect all room occupants for this slot
                      const occupiedRooms: {
                        roomId: string;
                        booking?: Booking;
                        activity?: ActivitySessionSlot;
                        isPrivatise: boolean;
                      }[] = [];

                      if (inRange) {
                        rooms.forEach((room) => {
                          const { bookings: bks, activities: acts } = getOccupantsForCell(day, hour, room.id);
                          if (bks.length > 0 || acts.length > 0) {
                            occupiedRooms.push({
                              roomId: room.id,
                              booking: bks[0],
                              activity: acts[0],
                              isPrivatise: bks.some((b) => b.notes?.includes("[Privatisé]")),
                            });
                          }
                        });
                      }

                      // Build tooltip
                      const tooltipLines: string[] = [];
                      occupiedRooms.forEach((occ) => {
                        const roomName = rooms.find((r) => r.id === occ.roomId)?.name || "";
                        if (occ.booking) {
                          const name = occ.booking.profiles
                            ? `${occ.booking.profiles.first_name} ${occ.booking.profiles.last_name}`
                            : "Inconnu";
                          const timeStr = `${format(new Date(occ.booking.start_time), "HH:mm")}–${format(new Date(occ.booking.end_time), "HH:mm")}`;
                          const privLabel = occ.isPrivatise ? "🔒 " : "";
                          tooltipLines.push(`${privLabel}${roomName} · ${name} · ${timeStr}`);
                        }
                        if (occ.activity) {
                          const timeStr = `${format(new Date(occ.activity.start_time), "HH:mm")}–${format(new Date(occ.activity.end_time), "HH:mm")}`;
                          tooltipLines.push(`🎯 ${roomName} · ${(occ.activity as any).activities?.title || "Activité"} · ${timeStr}`);
                        }
                      });

                      const cellContent = (
                        <div
                          className={cn(
                            "rounded-lg h-10 flex items-center justify-center gap-0.5 transition-all overflow-hidden",
                            !inRange
                              ? "bg-muted/30"
                              : isPast && !isToday
                              ? "bg-muted/50"
                              : occupiedRooms.length > 0
                              ? "bg-accent/30 border border-border/50"
                              : "bg-accent/50 border border-border/50"
                          )}
                        >
                          {occupiedRooms.length > 0 ? (
                            // Show colored dots/blocks for each occupied room
                            <div className="flex items-center gap-0.5 px-1">
                              {occupiedRooms.map((occ) => {
                                const color = roomColorMap.get(occ.roomId);
                                return (
                                  <button
                                    key={occ.roomId}
                                    className={cn(
                                      "h-7 rounded px-1 flex items-center gap-0.5 text-[9px] font-semibold transition-colors cursor-pointer min-w-[18px] justify-center",
                                      occ.isPrivatise
                                        ? "bg-red-500/25 text-red-800 border border-red-500/40 hover:bg-red-500/35"
                                        : occ.activity
                                        ? "bg-orange-500/25 text-orange-800 border border-orange-500/40 hover:bg-orange-500/35"
                                        : `${color?.bg} ${color?.text} ${color?.border} border hover:opacity-80`
                                    )}
                                    onClick={() => {
                                      if (occ.activity && onActivityClick) {
                                        onActivityClick(occ.activity);
                                      } else if (occ.booking && onBookingClick) {
                                        onBookingClick(occ.booking);
                                      }
                                    }}
                                  >
                                    {occ.isPrivatise && <Lock className="h-2.5 w-2.5 shrink-0" />}
                                    {!occ.isPrivatise && occ.booking && (
                                      <span className="truncate max-w-[40px]">
                                        {occ.booking.profiles?.first_name?.[0]}{occ.booking.profiles?.last_name?.[0]}
                                      </span>
                                    )}
                                    {occ.activity && (
                                      <span className="truncate max-w-[40px]">
                                        {(occ.activity as any).activities?.title?.slice(0, 4) || "Act"}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      );

                      return (
                        <td
                          key={day.toISOString() + hour}
                          className={cn(
                            "p-0.5 text-center",
                            isToday && "bg-accent/30"
                          )}
                        >
                          {tooltipLines.length > 0 ? (
                            <Tooltip>
                              <TooltipTrigger asChild>{cellContent}</TooltipTrigger>
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

export default WeeklyAllRoomsOverview;
