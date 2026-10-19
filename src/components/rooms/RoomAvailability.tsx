import { useMemo } from "react";
import { format, addDays } from "date-fns";
import { getRoomDayHours, parseOpeningHours } from "@/lib/roomOpeningHours";
import { fr } from "date-fns/locale";

interface Booking {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
}

interface Props {
  bookings: Booking[];
  /** rooms.opening_hours de la salle (horaires propres à la salle). */
  openingHours?: unknown;
}

/** Plage d'heures affichée : de la plus tôt à la plus tardive ouverture de la semaine. */
const computeHourRange = (openingHours: unknown): number[] => {
  const cfg = parseOpeningHours(openingHours);
  const open = Object.values(cfg.weekly).filter((d) => !d.closed && d.end > d.start);
  if (open.length === 0) return [];
  const min = Math.min(...open.map((d) => d.start));
  const max = Math.max(...open.map((d) => d.end));
  return Array.from({ length: max - min }, (_, i) => i + min);
};

// Brussels timezone offset helper: CET = UTC+1, CEST = UTC+2
const getBrusselsOffset = (date: Date): number => {
  // Use Intl to determine if DST is active in Brussels
  const jan = new Date(date.getFullYear(), 0, 1);
  const jul = new Date(date.getFullYear(), 6, 1);
  const stdOffset = Math.max(
    jan.getTimezoneOffset(),
    jul.getTimezoneOffset()
  );
  // This trick works for the browser's local TZ; for Brussels we hardcode:
  // CET (last Sun Oct → last Sun Mar) = UTC+1, CEST = UTC+2
  const month = date.getUTCMonth(); // 0-indexed
  const day = date.getUTCDate();
  const weekday = date.getUTCDay(); // 0=Sun
  
  // DST in Europe: starts last Sunday of March, ends last Sunday of October
  const isAfterMarchSwitch = month > 2 || (month === 2 && day - weekday >= 25);
  const isBeforeOctoberSwitch = month < 9 || (month === 9 && day - weekday < 25);
  
  return (isAfterMarchSwitch && isBeforeOctoberSwitch) ? 2 : 1;
};

const RoomAvailability = ({ bookings, openingHours }: Props) => {
  const ALL_HOURS = useMemo(() => computeHourRange(openingHours), [openingHours]);
  const days = useMemo(() => {
    // Create days based on Brussels date (not browser local time)
    const now = new Date();
    const brusselsOffset = getBrusselsOffset(now);
    const brusselsNow = new Date(now.getTime() + brusselsOffset * 60 * 60 * 1000);
    // Start of today in Brussels = midnight Brussels = (midnight UTC - offset)
    const todayUTC = new Date(Date.UTC(
      brusselsNow.getUTCFullYear(),
      brusselsNow.getUTCMonth(),
      brusselsNow.getUTCDate()
    ));
    // todayUTC represents midnight Brussels in terms of the calendar date
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(todayUTC);
      d.setUTCDate(d.getUTCDate() + i);
      return d;
    });
  }, []);

  const isSlotBooked = (day: Date, hour: number) => {
    const brusselsOffset = getBrusselsOffset(day);
    // Slot at "hour" Brussels time = (hour - offset) UTC
    const slotStartUTC = new Date(Date.UTC(
      day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(),
      hour - brusselsOffset, 0, 0
    ));
    const slotEndUTC = new Date(Date.UTC(
      day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(),
      hour - brusselsOffset + 1, 0, 0
    ));
    
    return bookings.some((b) => {
      const start = new Date(b.start_time);
      const end = new Date(b.end_time);
      return start < slotEndUTC && end > slotStartUTC;
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
            {ALL_HOURS.map((h) => (
              <th
                key={h}
                className="px-1 py-2 text-center font-medium text-muted-foreground min-w-[34px]"
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
                {format(new Date(day.getTime() + getBrusselsOffset(day) * 60 * 60 * 1000), "EEE d MMM", { locale: fr })}
              </td>
              {ALL_HOURS.map((h) => {
                const dayOpening = getRoomDayHours(openingHours, day);
                const inRange = !dayOpening.closed && h >= dayOpening.start && h < dayOpening.end;
                const booked = inRange && isSlotBooked(day, h);
                return (
                  <td key={h} className="px-0.5 py-1.5 text-center">
                    <div
                      className={`mx-auto h-5 w-5 rounded-sm ${
                        !inRange
                          ? "bg-muted/30 border border-border/30"
                          : booked
                          ? "bg-destructive/20 border border-destructive/30"
                          : "bg-primary/10 border border-primary/20"
                      }`}
                      title={
                        !inRange
                          ? `Fermé — ${h}h`
                          : booked
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
      <div className="flex flex-wrap items-center gap-4 px-3 py-2 border-t border-border bg-muted/30 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm bg-primary/10 border border-primary/20" />
          Disponible
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm bg-destructive/20 border border-destructive/30" />
          Réservé
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm bg-muted/30 border border-border/30" />
          Fermé
        </div>
        <span className="ml-auto">Sem. 8h–22h • W-E 9h–21h</span>
      </div>
    </div>
  );
};

export default RoomAvailability;
