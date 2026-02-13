import { useMemo } from "react";
import { format, setHours, setMinutes, isAfter, isBefore, isSameDay, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { Clock, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { generateTimeSlotsForDate, getOpeningHours, type Booking, type ActivitySessionSlot } from "./utils";

interface TimeSlotsGridProps {
  selectedDate: Date;
  bookings: Booking[];
  activitySessions?: ActivitySessionSlot[];
  rooms: any[];
  onSlotClick: (slot: Date) => void;
  onBookingClick?: (booking: Booking) => void;
  onActivityClick?: (session: ActivitySessionSlot) => void;
}

const TimeSlotsGrid = ({ selectedDate, bookings, activitySessions = [], rooms, onSlotClick, onBookingClick, onActivityClick }: TimeSlotsGridProps) => {
  const isPastDate = isBefore(startOfDay(selectedDate), startOfDay(new Date()));
  const timeSlots = useMemo(() => generateTimeSlotsForDate(selectedDate, 30), [selectedDate]);
  const { start, end } = getOpeningHours(selectedDate);

  const isSlotBooked = (slot: Date) => {
    const slotTime = setMinutes(
      setHours(selectedDate, slot.getHours()),
      slot.getMinutes()
    );
    return bookings.some((b) => {
      const start = new Date(b.start_time);
      const end = new Date(b.end_time);
      return (
        (isAfter(slotTime, start) ||
          (isSameDay(slotTime, start) &&
            slotTime.getHours() === start.getHours() &&
            slotTime.getMinutes() === start.getMinutes())) &&
        isBefore(slotTime, end)
      );
    });
  };

  const isSlotActivity = (slot: Date) => {
    const slotTime = setMinutes(
      setHours(selectedDate, slot.getHours()),
      slot.getMinutes()
    );
    return activitySessions.some((a) => {
      const start = new Date(a.start_time);
      const end = new Date(a.end_time);
      return (
        (isAfter(slotTime, start) ||
          (isSameDay(slotTime, start) &&
            slotTime.getHours() === start.getHours() &&
            slotTime.getMinutes() === start.getMinutes())) &&
        isBefore(slotTime, end)
      );
    });
  };

  const getBookingAtSlot = (slot: Date) => {
    const slotTime = setMinutes(
      setHours(selectedDate, slot.getHours()),
      slot.getMinutes()
    );
    return bookings.find((b) => {
      const start = new Date(b.start_time);
      return (
        start.getHours() === slotTime.getHours() &&
        start.getMinutes() === slotTime.getMinutes()
      );
    });
  };

  const getActivityAtSlot = (slot: Date) => {
    const slotTime = setMinutes(
      setHours(selectedDate, slot.getHours()),
      slot.getMinutes()
    );
    return activitySessions.find((a) => {
      const start = new Date(a.start_time);
      return (
        start.getHours() === slotTime.getHours() &&
        start.getMinutes() === slotTime.getMinutes()
      );
    });
  };

  const handleSlotClick = (slot: Date) => {
    if (isSlotBooked(slot)) {
      const booking = getBookingAtSlot(slot);
      if (booking && onBookingClick) onBookingClick(booking);
      return;
    }
    if (isSlotActivity(slot)) {
      const session = getActivityAtSlot(slot);
      if (session && onActivityClick) onActivityClick(session);
      return;
    }
    onSlotClick(slot);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-base">
            {format(selectedDate, "EEEE d MMMM", { locale: fr })}
            <span className="text-xs text-muted-foreground font-normal ml-2">
              {start}h – {end}h
            </span>
          </CardTitle>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-accent border border-border" />
              Disponible
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-primary/20 border border-primary/30" />
              Réservé
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-orange-500/20 border border-orange-500/30" />
              Activité
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isPastDate ? (
          <p className="text-muted-foreground text-sm text-center py-8">
            Impossible de réserver dans le passé.
          </p>
        ) : rooms.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">
            Aucune salle disponible.
          </p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-2">
            {timeSlots.map((slot) => {
              const booked = isSlotBooked(slot);
              const activity = isSlotActivity(slot);
              const booking = getBookingAtSlot(slot);
              const actSession = getActivityAtSlot(slot);
              const timeStr = format(slot, "HH:mm");
              const isOccupied = booked || activity;

              return (
                <button
                  key={timeStr}
                  onClick={() => handleSlotClick(slot)}
                  disabled={false}
                  className={cn(
                    "relative flex flex-col items-center justify-center py-3 px-2 rounded-xl border transition-all",
                    activity
                      ? "bg-orange-500/10 border-orange-500/20 cursor-pointer hover:bg-orange-500/20"
                      : booked
                      ? "bg-primary/10 border-primary/20 cursor-pointer hover:bg-destructive/10 hover:border-destructive/30"
                      : "bg-card border-border hover:border-primary hover:shadow-sm cursor-pointer"
                  )}
                  title={
                    actSession
                      ? `${actSession.activities?.title || "Activité"} — ${actSession.activities?.profiles?.first_name || ""} ${actSession.activities?.profiles?.last_name || ""}`
                      : undefined
                  }
                >
                  <Clock
                    className={cn(
                      "h-4 w-4 mb-1",
                      activity ? "text-orange-500/50" : booked ? "text-primary/50" : "text-muted-foreground"
                    )}
                  />
                  <span
                    className={cn(
                      "font-semibold text-sm",
                      activity ? "text-orange-700/60" : booked ? "text-primary/60" : ""
                    )}
                  >
                    {timeStr}
                  </span>
                  {actSession && (
                    <span className="text-[10px] text-orange-700/60 mt-1 truncate max-w-full">
                      {actSession.activities?.title?.slice(0, 12) || "Activité"}
                    </span>
                  )}
                  {booking && !activity && (
                    <span className="text-[10px] text-primary/60 mt-1 truncate max-w-full">
                      {booking.profiles?.first_name}{" "}
                      {booking.profiles?.last_name?.[0]}.
                    </span>
                  )}
                  {!isOccupied && (
                    <Plus className="h-3 w-3 text-muted-foreground mt-1 opacity-0 group-hover:opacity-100" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TimeSlotsGrid;
