import { format, setHours, setMinutes, isAfter, isBefore, isSameDay, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { Clock, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { generateTimeSlots, type Booking } from "./utils";

const timeSlots = generateTimeSlots(8, 19, 30);

interface TimeSlotsGridProps {
  selectedDate: Date;
  bookings: Booking[];
  rooms: any[];
  onSlotClick: (slot: Date) => void;
}

const TimeSlotsGrid = ({ selectedDate, bookings, rooms, onSlotClick }: TimeSlotsGridProps) => {
  const isPastDate = isBefore(startOfDay(selectedDate), startOfDay(new Date()));

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

  const handleSlotClick = (slot: Date) => {
    if (isSlotBooked(slot)) return;
    onSlotClick(slot);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-base">
            {format(selectedDate, "EEEE d MMMM", { locale: fr })}
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {timeSlots.map((slot) => {
              const booked = isSlotBooked(slot);
              const booking = getBookingAtSlot(slot);
              const timeStr = format(slot, "HH:mm");

              return (
                <button
                  key={timeStr}
                  onClick={() => handleSlotClick(slot)}
                  disabled={booked}
                  className={cn(
                    "relative flex flex-col items-center justify-center py-4 px-3 rounded-xl border transition-all",
                    booked
                      ? "bg-primary/10 border-primary/20 cursor-not-allowed"
                      : "bg-card border-border hover:border-primary hover:shadow-sm cursor-pointer"
                  )}
                >
                  <Clock
                    className={cn(
                      "h-4 w-4 mb-1",
                      booked ? "text-primary/50" : "text-muted-foreground"
                    )}
                  />
                  <span
                    className={cn(
                      "font-semibold text-sm",
                      booked ? "text-primary/60" : ""
                    )}
                  >
                    {timeStr}
                  </span>
                  {booking && (
                    <span className="text-[10px] text-primary/60 mt-1 truncate max-w-full">
                      {booking.profiles?.first_name}{" "}
                      {booking.profiles?.last_name?.[0]}.
                    </span>
                  )}
                  {!booked && (
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
