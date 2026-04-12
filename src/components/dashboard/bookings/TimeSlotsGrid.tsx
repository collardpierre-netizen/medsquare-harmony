import { useMemo } from "react";
import { format, isBefore, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { Clock, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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

const getBrusselsMinute = (date: Date): number =>
  parseInt(
    new Intl.DateTimeFormat("fr-BE", {
      timeZone: "Europe/Brussels",
      minute: "numeric",
    }).format(date),
    10
  );

// Get Brussels offset in hours for a given date (handles DST)
const getBrusselsOffsetHours = (date: Date): number => {
  const utcHour = date.getUTCHours() + date.getUTCMinutes() / 60;
  const brHour = getBrusselsHour(date) + date.getUTCMinutes() / 60;
  let diff = brHour - utcHour;
  if (diff < -12) diff += 24;
  if (diff > 12) diff -= 24;
  return diff;
};

// Build a UTC Date that corresponds to a given Brussels wall-clock time on a given day
const brusselsSlotToUTC = (day: Date, hour: number, minute: number): Date => {
  // Get the Brussels calendar date (not UTC date, which may differ around midnight)
  const [year, month, dayNum] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Brussels",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(day)
    .split("-")
    .map(Number);
  const offset = getBrusselsOffsetHours(day);
  return new Date(Date.UTC(year, month - 1, dayNum, hour - offset, minute, 0, 0));
};

const TimeSlotsGrid = ({ selectedDate, bookings, activitySessions = [], rooms, onSlotClick, onBookingClick, onActivityClick }: TimeSlotsGridProps) => {
  const isPastDate = isBefore(startOfDay(selectedDate), startOfDay(new Date()));
  const timeSlots = useMemo(() => generateTimeSlotsForDate(selectedDate, 30), [selectedDate]);
  const { start, end } = getOpeningHours(selectedDate);

  const isSlotBooked = (slot: Date) => {
    const slotHour = slot.getHours();
    const slotMinute = slot.getMinutes();
    const slotUTC = brusselsSlotToUTC(selectedDate, slotHour, slotMinute);
    const slotEndUTC = new Date(slotUTC.getTime() + 30 * 60 * 1000);

    return bookings.some((b) => {
      const bStart = new Date(b.start_time);
      const bEnd = new Date(b.end_time);
      return bStart.getTime() < slotEndUTC.getTime() && bEnd.getTime() > slotUTC.getTime();
    });
  };

  const isSlotActivity = (slot: Date) => {
    const slotHour = slot.getHours();
    const slotMinute = slot.getMinutes();
    const slotUTC = brusselsSlotToUTC(selectedDate, slotHour, slotMinute);
    const slotEndUTC = new Date(slotUTC.getTime() + 30 * 60 * 1000);

    return activitySessions.some((a) => {
      const aStart = new Date(a.start_time);
      const aEnd = new Date(a.end_time);
      return aStart.getTime() < slotEndUTC.getTime() && aEnd.getTime() > slotUTC.getTime();
    });
  };

  const getBookingAtSlot = (slot: Date) => {
    const slotHour = slot.getHours();
    const slotMinute = slot.getMinutes();
    return bookings.find((b) => {
      const start = new Date(b.start_time);
      return getBrusselsHour(start) === slotHour && getBrusselsMinute(start) === slotMinute;
    });
  };

  const getActivityAtSlot = (slot: Date) => {
    const slotHour = slot.getHours();
    const slotMinute = slot.getMinutes();
    return activitySessions.find((a) => {
      const start = new Date(a.start_time);
      return getBrusselsHour(start) === slotHour && getBrusselsMinute(start) === slotMinute;
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

  const freeSlotTooltip = useMemo(() => {
    if (rooms.length === 0) return "";
    if (rooms.length === 1) {
      const r = rooms[0];
      return r.hourly_rate ? `${r.name} — ${r.hourly_rate} €/h` : r.name;
    }
    return rooms
      .filter((r: any) => r.hourly_rate != null)
      .map((r: any) => `${r.name}: ${r.hourly_rate} €/h`)
      .join("\n") || "Créneaux disponibles";
  }, [rooms]);

  return (
    <TooltipProvider delayDuration={200}>
    <>
      {/* SVG pattern for diagonal hatching */}
      <svg width="0" height="0" className="absolute">
        <defs>
          <pattern id="day-hatch-booked" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="hsl(var(--primary) / 0.45)" strokeWidth="2" />
          </pattern>
          <pattern id="day-hatch-activity" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="rgb(249 115 22 / 0.35)" strokeWidth="2" />
          </pattern>
        </defs>
      </svg>
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="font-display text-base">
              {format(selectedDate, "EEEE d MMMM", { locale: fr })}
              <span className="text-xs text-muted-foreground font-normal ml-2">
                {start}h – {end}h
              </span>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              👆 Cliquez sur l'heure de début souhaitée pour réserver
            </p>
          </div>
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

              const slotButton = (
                <button
                  key={timeStr}
                  onClick={() => handleSlotClick(slot)}
                  disabled={false}
                  className={cn(
                    "relative overflow-hidden flex flex-col items-center justify-center py-3 px-2 rounded-xl border transition-all",
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
                  {/* Diagonal hatching overlay for occupied slots */}
                  {isOccupied && (
                    <svg className="absolute inset-0 w-full h-full pointer-events-none rounded-xl" preserveAspectRatio="none">
                      <rect width="100%" height="100%" fill={activity ? "url(#day-hatch-activity)" : "url(#day-hatch-booked)"} />
                    </svg>
                  )}
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

              // Build tooltip content for all slot types
              let tooltipContent = "";
              if (booking && !activity) {
                const name = `${booking.profiles?.first_name || ""} ${booking.profiles?.last_name || ""}`.trim();
                const room = rooms.find((r: any) => r.id === booking.room_id);
                const ratePart = room?.hourly_rate ? ` — ${room.hourly_rate} €/h` : "";
                const roomPart = room?.name ? `${room.name}${ratePart}` : "";
                tooltipContent = [name, roomPart].filter(Boolean).join("\n");
              } else if (actSession) {
                const title = actSession.activities?.title || "Activité";
                const practName = `${actSession.activities?.profiles?.first_name || ""} ${actSession.activities?.profiles?.last_name || ""}`.trim();
                const room = rooms.find((r: any) => r.id === actSession.room_id);
                const ratePart = room?.hourly_rate ? ` — ${room.hourly_rate} €/h` : "";
                const roomPart = room?.name ? `${room.name}${ratePart}` : "";
                tooltipContent = [title, practName, roomPart].filter(Boolean).join("\n");
              } else if (freeSlotTooltip) {
                tooltipContent = freeSlotTooltip;
              }

              if (tooltipContent) {
                return (
                  <Tooltip key={timeStr}>
                    <TooltipTrigger asChild>
                      {slotButton}
                    </TooltipTrigger>
                    <TooltipContent className="whitespace-pre-line text-xs">
                      {tooltipContent}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return slotButton;
            })}
          </div>
        )}
      </CardContent>
    </Card>
    </>
    </TooltipProvider>
  );
};

export default TimeSlotsGrid;
