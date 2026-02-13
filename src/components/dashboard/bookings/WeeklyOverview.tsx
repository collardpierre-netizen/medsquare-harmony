import { useEffect, useState, useMemo } from "react";
import { addDays, format, startOfDay, isBefore, isSameDay, isWeekend } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getOpeningHours, type Booking, type ActivitySessionSlot } from "./utils";

interface WeeklyOverviewProps {
  weekStart: Date;
  selectedRoom: string;
  rooms: any[];
  onSlotClick: (day: Date) => void;
}

const WeeklyOverview = ({ weekStart, selectedRoom, rooms, onSlotClick }: WeeklyOverviewProps) => {
  const [weekBookings, setWeekBookings] = useState<Booking[]>([]);
  const [weekActivities, setWeekActivities] = useState<ActivitySessionSlot[]>([]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

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
    return weekBookings.filter((b) => isSameDay(new Date(b.start_time), day));
  };

  const getActivitiesForDay = (day: Date) => {
    return weekActivities.filter((a) => isSameDay(new Date(a.start_time), day));
  };

  const isHourBooked = (day: Date, hour: number) => {
    return weekBookings.some((b) => {
      const start = new Date(b.start_time);
      const end = new Date(b.end_time);
      if (!isSameDay(start, day) && !isSameDay(end, day)) return false;
      const slotStart = new Date(day);
      slotStart.setHours(hour, 0, 0, 0);
      const slotEnd = new Date(day);
      slotEnd.setHours(hour + 1, 0, 0, 0);
      return start < slotEnd && end > slotStart;
    });
  };

  const isHourActivity = (day: Date, hour: number) => {
    return weekActivities.some((a) => {
      const start = new Date(a.start_time);
      const end = new Date(a.end_time);
      if (!isSameDay(start, day) && !isSameDay(end, day)) return false;
      const slotStart = new Date(day);
      slotStart.setHours(hour, 0, 0, 0);
      const slotEnd = new Date(day);
      slotEnd.setHours(hour + 1, 0, 0, 0);
      return start < slotEnd && end > slotStart;
    });
  };

  const getBookingAtHour = (day: Date, hour: number) => {
    return weekBookings.find((b) => {
      const start = new Date(b.start_time);
      return isSameDay(start, day) && start.getHours() === hour;
    });
  };

  const getActivityAtHour = (day: Date, hour: number) => {
    return weekActivities.find((a) => {
      const start = new Date(a.start_time);
      return isSameDay(start, day) && start.getHours() === hour;
    });
  };

  const isHourInOpeningRange = (day: Date, hour: number) => {
    const { start, end } = getOpeningHours(day);
    return hour >= start && hour < end;
  };

  const roomName = rooms.find((r) => r.id === selectedRoom)?.name || "Salle";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-base">
            Planning hebdomadaire — {roomName}
          </CardTitle>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-accent border border-border" />
              Libre
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-primary/20 border border-primary/30" />
              Réservé
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-orange-500/20 border border-orange-500/30" />
              Activité
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-muted border border-border opacity-50" />
              Fermé / Passé
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
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

                    return (
                      <td
                        key={day.toISOString() + hour}
                        className={cn(
                          "p-1 text-center",
                          isToday && "bg-accent/30"
                        )}
                      >
                        <div
                          className={cn(
                            "rounded-lg h-10 flex items-center justify-center text-[10px] font-medium transition-all",
                            !inRange
                              ? "bg-muted/30 text-muted-foreground/20"
                              : isPast
                              ? "bg-muted/50 text-muted-foreground/30"
                              : activity
                              ? "bg-orange-500/15 text-orange-700 border border-orange-500/20"
                              : booked
                              ? "bg-primary/15 text-primary/70 border border-primary/20"
                              : "bg-accent/50 border border-border/50 hover:border-primary/40 hover:bg-accent cursor-pointer"
                          )}
                          onClick={() => inRange && !isPast && !isOccupied && onSlotClick(day)}
                          title={
                            actSession
                              ? `${actSession.activities?.title || "Activité"} — ${actSession.activities?.profiles?.first_name || ""} ${actSession.activities?.profiles?.last_name || ""}`
                              : undefined
                          }
                        >
                          {actSession && (
                            <span className="truncate px-1">
                              {actSession.activities?.title?.slice(0, 8) || "Act."}
                            </span>
                          )}
                          {booking && !activity && (
                            <span className="truncate px-1">
                              {booking.profiles?.first_name?.[0]}.{booking.profiles?.last_name?.[0]}.
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
      </CardContent>
    </Card>
  );
};

export default WeeklyOverview;
