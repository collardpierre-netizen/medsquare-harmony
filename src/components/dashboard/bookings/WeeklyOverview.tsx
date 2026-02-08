import { useEffect, useState, useMemo } from "react";
import { addDays, format, startOfDay, isBefore, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { generateTimeSlots, type Booking } from "./utils";

const HOURS = generateTimeSlots(8, 19, 60); // 1-hour blocks for overview

interface WeeklyOverviewProps {
  weekStart: Date;
  selectedRoom: string;
  rooms: any[];
  onSlotClick: (day: Date) => void;
}

const WeeklyOverview = ({ weekStart, selectedRoom, rooms, onSlotClick }: WeeklyOverviewProps) => {
  const [weekBookings, setWeekBookings] = useState<Booking[]>([]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  // Fetch all bookings for the entire week
  useEffect(() => {
    if (!selectedRoom) return;

    const fetchWeekBookings = async () => {
      const weekEnd = addDays(weekStart, 7);

      const { data } = await supabase
        .from("bookings")
        .select("*, profiles(first_name, last_name)")
        .eq("room_id", selectedRoom)
        .gte("start_time", startOfDay(weekStart).toISOString())
        .lt("start_time", weekEnd.toISOString())
        .neq("status", "cancelled")
        .order("start_time");

      setWeekBookings((data as Booking[]) || []);
    };

    fetchWeekBookings();
  }, [weekStart, selectedRoom]);

  // Count bookings per day
  const getBookingsForDay = (day: Date) => {
    return weekBookings.filter((b) => {
      const start = new Date(b.start_time);
      return isSameDay(start, day);
    });
  };

  // Check if a specific hour on a specific day is booked
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

  const getBookingAtHour = (day: Date, hour: number) => {
    return weekBookings.find((b) => {
      const start = new Date(b.start_time);
      return isSameDay(start, day) && start.getHours() === hour;
    });
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
              Occupé
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-muted border border-border opacity-50" />
              Passé
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
                        {dayBookings.length > 0 && (
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 mt-0.5">
                            {dayBookings.length} rés.
                          </Badge>
                        )}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {HOURS.map((slot) => {
                const hour = slot.getHours();
                return (
                  <tr key={hour} className="border-t border-border/50">
                    <td className="text-xs font-medium text-muted-foreground p-2 sticky left-0 bg-card">
                      {format(slot, "HH:mm")}
                    </td>
                    {weekDays.map((day) => {
                      const isPast = isBefore(day, startOfDay(new Date()));
                      const booked = isHourBooked(day, hour);
                      const booking = getBookingAtHour(day, hour);
                      const isToday = isSameDay(day, new Date());

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
                              isPast
                                ? "bg-muted/50 text-muted-foreground/30"
                                : booked
                                ? "bg-primary/15 text-primary/70 border border-primary/20"
                                : "bg-accent/50 border border-border/50 hover:border-primary/40 hover:bg-accent cursor-pointer"
                            )}
                            onClick={() => !isPast && !booked && onSlotClick(day)}
                          >
                            {booking && (
                              <span className="truncate px-1">
                                {booking.profiles?.first_name?.[0]}.{booking.profiles?.last_name?.[0]}.
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default WeeklyOverview;
