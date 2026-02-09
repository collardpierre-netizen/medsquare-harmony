import { useMemo } from "react";
import { format, addDays, startOfDay, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";

interface Booking {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
}

interface Props {
  bookings: Booking[];
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 8); // 8h → 19h

const RoomAvailability = ({ bookings }: Props) => {
  const days = useMemo(() => {
    const today = startOfDay(new Date());
    return Array.from({ length: 14 }, (_, i) => addDays(today, i));
  }, []);

  const isSlotBooked = (day: Date, hour: number) => {
    return bookings.some((b) => {
      const start = new Date(b.start_time);
      const end = new Date(b.end_time);
      if (!isSameDay(start, day) && !isSameDay(end, day)) {
        // Check if the day falls between start and end
        if (day < start || day > end) return false;
        return true;
      }
      const slotStart = new Date(day);
      slotStart.setHours(hour, 0, 0, 0);
      const slotEnd = new Date(day);
      slotEnd.setHours(hour + 1, 0, 0, 0);
      return start < slotEnd && end > slotStart;
    });
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-muted/50">
            <th className="sticky left-0 bg-muted/50 px-3 py-2 text-left font-medium text-muted-foreground min-w-[90px]">
              Date
            </th>
            {HOURS.map((h) => (
              <th
                key={h}
                className="px-1 py-2 text-center font-medium text-muted-foreground min-w-[40px]"
              >
                {h}h
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.toISOString()} className="border-t border-border">
              <td className="sticky left-0 bg-card px-3 py-1.5 font-medium capitalize whitespace-nowrap">
                {format(day, "EEE d MMM", { locale: fr })}
              </td>
              {HOURS.map((h) => {
                const booked = isSlotBooked(day, h);
                return (
                  <td key={h} className="px-0.5 py-1.5 text-center">
                    <div
                      className={`mx-auto h-5 w-5 rounded-sm ${
                        booked
                          ? "bg-destructive/20 border border-destructive/30"
                          : "bg-primary/10 border border-primary/20"
                      }`}
                      title={
                        booked
                          ? `Réservé — ${format(day, "d MMM", { locale: fr })} ${h}h`
                          : `Disponible — ${format(day, "d MMM", { locale: fr })} ${h}h`
                      }
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Legend */}
      <div className="flex items-center gap-4 px-3 py-2 border-t border-border bg-muted/30 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm bg-primary/10 border border-primary/20" />
          Disponible
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm bg-destructive/20 border border-destructive/30" />
          Réservé
        </div>
      </div>
    </div>
  );
};

export default RoomAvailability;
