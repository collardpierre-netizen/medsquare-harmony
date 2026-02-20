import { useEffect, useState, useMemo } from "react";
import { addDays, format, startOfDay, isSameDay, isBefore } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getOpeningHours, type Booking, type ActivitySessionSlot } from "./utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter, X, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AllRoomsOverviewProps {
  selectedDate: Date;
  rooms: any[];
  onSlotClick?: (day: Date, roomId: string) => void;
  onBookingClick?: (booking: Booking) => void;
  onActivityClick?: (session: ActivitySessionSlot) => void;
}

const AllRoomsOverview = ({
  selectedDate,
  rooms,
  onSlotClick,
  onBookingClick,
  onActivityClick,
}: AllRoomsOverviewProps) => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [activities, setActivities] = useState<ActivitySessionSlot[]>([]);
  const [filterPractitioner, setFilterPractitioner] = useState("__all__");
  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<string>>(
    new Set(rooms.map((r) => r.id))
  );

  // Update selected rooms when rooms list changes
  useEffect(() => {
    setSelectedRoomIds(new Set(rooms.map((r) => r.id)));
  }, [rooms]);

  const allHours = useMemo(() => Array.from({ length: 14 }, (_, i) => i + 8), []);

  // Fetch all rooms data for the selected date
  useEffect(() => {
    const fetchData = async () => {
      const dayStart = startOfDay(selectedDate).toISOString();
      const dayEnd = addDays(startOfDay(selectedDate), 1).toISOString();

      const [{ data: bookingsData }, { data: sessionsData }] = await Promise.all([
        supabase
          .from("bookings")
          .select("*, profiles(first_name, last_name), rooms(name), activities(title)")
          .gte("start_time", dayStart)
          .lt("start_time", dayEnd)
          .neq("status", "cancelled")
          .order("start_time"),
        supabase
          .from("activity_sessions")
          .select("*, activities(title, category, profiles(first_name, last_name)), rooms(name)")
          .gte("start_time", dayStart)
          .lt("start_time", dayEnd)
          .eq("status", "scheduled")
          .order("start_time"),
      ]);

      setBookings((bookingsData as Booking[]) || []);
      setActivities((sessionsData as ActivitySessionSlot[]) || []);
    };

    fetchData();
  }, [selectedDate]);

  // Get unique practitioners from bookings + activities
  const practitioners = useMemo(() => {
    const map = new Map<string, string>();
    bookings.forEach((b) => {
      if (b.profiles) {
        map.set(
          b.practitioner_id,
          `${b.profiles.first_name} ${b.profiles.last_name}`
        );
      }
    });
    activities.forEach((a: any) => {
      if (a.activities?.profiles) {
        const p = a.activities.profiles;
        // We don't have practitioner_id directly on sessions, use activity's practitioner
        const key = `act-${a.activity_id}`;
        map.set(key, `${p.first_name} ${p.last_name}`);
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [bookings, activities]);

  // Filtered rooms
  const visibleRooms = rooms.filter((r) => selectedRoomIds.has(r.id));

  // Get Brussels hour
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

  const getBookingsForRoomHour = (roomId: string, hour: number) => {
    return bookings.filter((b) => {
      if (b.room_id !== roomId) return false;
      const start = new Date(b.start_time);
      const end = new Date(b.end_time);
      const startH = getBrusselsHour(start);
      const endH = getBrusselsHour(end);
      const endM = getBrusselsMinute(end);
      // Slot overlaps if booking starts before slot+1 and ends after slot
      return startH <= hour && (endH > hour || (endH === hour && endM > 0));
    });
  };

  const getActivitiesForRoomHour = (roomId: string, hour: number) => {
    return activities.filter((a: any) => {
      if (a.room_id !== roomId) return false;
      const start = new Date(a.start_time);
      const end = new Date(a.end_time);
      const startH = getBrusselsHour(start);
      const endH = getBrusselsHour(end);
      const endM = getBrusselsMinute(end);
      return startH <= hour && (endH > hour || (endH === hour && endM > 0));
    });
  };

  const getBookingStartingAt = (roomId: string, hour: number) => {
    return bookings.find((b) => {
      if (b.room_id !== roomId) return false;
      return getBrusselsHour(new Date(b.start_time)) === hour;
    });
  };

  const getActivityStartingAt = (roomId: string, hour: number) => {
    return activities.find((a: any) => {
      if (a.room_id !== roomId) return false;
      return getBrusselsHour(new Date(a.start_time)) === hour;
    });
  };

  const isHourInOpeningRange = (hour: number) => {
    const { start, end } = getOpeningHours(selectedDate);
    return hour >= start && hour < end;
  };

  const isPast = isBefore(startOfDay(selectedDate), startOfDay(new Date()));
  const isToday = isSameDay(selectedDate, new Date());

  // Filter by practitioner
  const matchesPractitionerFilter = (roomId: string, hour: number): boolean => {
    if (filterPractitioner === "__all__") return true;
    const bks = getBookingsForRoomHour(roomId, hour);
    const acts = getActivitiesForRoomHour(roomId, hour);
    const bookingMatch = bks.some((b) => b.practitioner_id === filterPractitioner);
    const activityMatch = acts.some((a: any) => `act-${a.activity_id}` === filterPractitioner);
    return bookingMatch || activityMatch;
  };

  const toggleRoom = (roomId: string) => {
    setSelectedRoomIds((prev) => {
      const next = new Set(prev);
      if (next.has(roomId)) {
        if (next.size > 1) next.delete(roomId);
      } else {
        next.add(roomId);
      }
      return next;
    });
  };

  return (
    <TooltipProvider delayDuration={200}>
      {/* SVG patterns */}
      <svg width="0" height="0" className="absolute">
        <defs>
          <pattern id="allrooms-hatch-booked" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="5" stroke="hsl(var(--primary) / 0.6)" strokeWidth="2.5" />
          </pattern>
          <pattern id="allrooms-hatch-privatise" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(-45)">
            <line x1="0" y1="0" x2="0" y2="5" stroke="hsl(0 72% 51% / 0.55)" strokeWidth="2.5" />
          </pattern>
          <pattern id="allrooms-hatch-activity" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="5" stroke="rgb(249 115 22 / 0.5)" strokeWidth="2.5" />
          </pattern>
        </defs>
      </svg>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="font-display text-base">
                Toutes les salles — {format(selectedDate, "EEEE d MMMM yyyy", { locale: fr })}
              </CardTitle>
              <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-accent border border-border" />
                  Libre
                </div>
                <div className="flex items-center gap-1.5">
                  <svg className="w-3 h-3 rounded overflow-hidden border border-primary/30" viewBox="0 0 12 12">
                    <rect width="12" height="12" fill="hsl(var(--primary) / 0.15)" />
                    <rect width="12" height="12" fill="url(#allrooms-hatch-booked)" />
                  </svg>
                  Réservé
                </div>
                <div className="flex items-center gap-1.5">
                  <svg className="w-3 h-3 rounded overflow-hidden border border-orange-500/30" viewBox="0 0 12 12">
                    <rect width="12" height="12" fill="rgb(249 115 22 / 0.15)" />
                    <rect width="12" height="12" fill="url(#allrooms-hatch-activity)" />
                  </svg>
                  Activité
                </div>
                <div className="flex items-center gap-1.5">
                  <svg className="w-3 h-3 rounded overflow-hidden border border-red-500/30" viewBox="0 0 12 12">
                    <rect width="12" height="12" fill="rgb(239 68 68 / 0.15)" />
                    <rect width="12" height="12" fill="url(#allrooms-hatch-privatise)" />
                  </svg>
                  🔒 Privatisé
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Filtres :</span>
              </div>

              {/* Room pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {rooms.map((room) => (
                  <button
                    key={room.id}
                    onClick={() => toggleRoom(room.id)}
                    className={cn(
                      "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors border",
                      selectedRoomIds.has(room.id)
                        ? "bg-foreground text-background border-foreground"
                        : "bg-background text-muted-foreground border-border hover:bg-accent"
                    )}
                  >
                    {room.name}
                  </button>
                ))}
              </div>

              <div className="h-4 w-px bg-border" />

              {/* Practitioner filter */}
              <Select value={filterPractitioner} onValueChange={setFilterPractitioner}>
                <SelectTrigger className="w-[180px] h-8 text-xs">
                  <SelectValue placeholder="Tous les praticiens" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tous les praticiens</SelectItem>
                  {practitioners.map(([key, name]) => (
                    <SelectItem key={key} value={key}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {filterPractitioner !== "__all__" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setFilterPractitioner("__all__")}
                >
                  <X className="h-3 w-3 mr-1" />
                  Réinitialiser
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: `${visibleRooms.length * 120 + 64}px` }}>
              <thead>
                <tr>
                  <th className="text-left text-xs font-semibold text-muted-foreground p-2 w-16 sticky left-0 bg-card z-10">
                    Heure
                  </th>
                  {visibleRooms.map((room) => (
                    <th
                      key={room.id}
                      className="text-center p-2 min-w-[120px]"
                    >
                      <span className="text-xs font-semibold text-foreground">
                        {room.name}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allHours.map((hour) => {
                  const inRange = isHourInOpeningRange(hour);

                  return (
                    <tr key={hour} className="border-t border-border/50">
                      <td className="text-xs font-medium text-muted-foreground p-2 sticky left-0 bg-card z-10">
                        {String(hour).padStart(2, "0")}:00
                      </td>
                      {visibleRooms.map((room) => {
                        const roomBookings = getBookingsForRoomHour(room.id, hour);
                        const roomActivities = getActivitiesForRoomHour(room.id, hour);
                        const isBooked = roomBookings.length > 0;
                        const isActivity = roomActivities.length > 0;
                        const isOccupied = isBooked || isActivity;
                        const bookingStart = getBookingStartingAt(room.id, hour);
                        const activityStart = getActivityStartingAt(room.id, hour);

                        // Check practitioner filter highlight
                        const matchesFilter = matchesPractitionerFilter(room.id, hour);
                        const dimmed = filterPractitioner !== "__all__" && isOccupied && !matchesFilter;

                        // Build tooltip content
                        const tooltipLines: string[] = [];
                        roomBookings.forEach((b) => {
                          const name = b.profiles
                            ? `${b.profiles.first_name} ${b.profiles.last_name}`
                            : "Inconnu";
                          const timeStr = `${format(new Date(b.start_time), "HH:mm")}–${format(new Date(b.end_time), "HH:mm")}`;
                          const actTitle = (b as any).activities?.title;
                          const recLabel = b.recurrence_group_id ? "🔁 Récurrent" : "1️⃣ Ponctuel";
                          const privLabel = b.notes?.includes("[Privatisé]") ? "🔒 Privatisé · " : "";
                          tooltipLines.push(
                            `📅 ${privLabel}${name} · ${timeStr}${actTitle ? ` · ${actTitle}` : ""} · ${recLabel}${b.notes && !b.notes.includes("[Privatisé]") ? ` — "${b.notes}"` : ""}`
                          );
                        });
                        roomActivities.forEach((a: any) => {
                          const p = a.activities?.profiles;
                          const name = p ? `${p.first_name} ${p.last_name}` : "";
                          const timeStr = `${format(new Date(a.start_time), "HH:mm")}–${format(new Date(a.end_time), "HH:mm")}`;
                          tooltipLines.push(
                            `🎯 ${a.activities?.title || "Activité"} · ${timeStr}${name ? ` · ${name}` : ""}`
                          );
                        });

                        const isPrivatise = bookingStart?.notes?.includes("[Privatisé]");

                        const cellContent = (
                          <div
                            className={cn(
                              "rounded-lg h-10 flex items-center justify-center text-[10px] font-medium transition-all relative overflow-hidden",
                              !inRange
                                ? "bg-muted/30 text-muted-foreground/20"
                                : isPast && !isToday
                                ? "bg-muted/50 text-muted-foreground/30"
                                : dimmed
                                ? "bg-muted/40 text-muted-foreground/40 border border-border/30"
                                : isActivity
                                ? "bg-orange-500/20 text-orange-700 border border-orange-500/30 cursor-pointer hover:bg-orange-500/30"
                                : isPrivatise
                                ? "bg-red-500/20 text-red-800 border border-red-500/40 cursor-pointer hover:bg-red-500/30"
                                : isBooked
                                ? "bg-primary/20 text-primary border border-primary/30 cursor-pointer hover:bg-primary/30"
                                : "bg-accent/50 border border-border/50 hover:border-primary/40 hover:bg-accent cursor-pointer"
                            )}
                            onClick={() => {
                              if (isActivity && activityStart && onActivityClick) {
                                onActivityClick(activityStart);
                              } else if (isBooked && bookingStart && onBookingClick) {
                                onBookingClick(bookingStart);
                              } else if (inRange && !isPast && !isOccupied && onSlotClick) {
                                onSlotClick(selectedDate, room.id);
                              }
                            }}
                          >
                            {/* Hatching */}
                            {inRange && !(isPast && !isToday) && isOccupied && !dimmed && (
                              <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
                                <rect width="100%" height="100%" fill={isActivity ? "url(#allrooms-hatch-activity)" : isPrivatise ? "url(#allrooms-hatch-privatise)" : "url(#allrooms-hatch-booked)"} />
                              </svg>
                            )}
                            {activityStart && !dimmed && (
                              <span className="truncate px-1 relative z-10">
                                {activityStart.activities?.title?.slice(0, 10) || "Act."}
                              </span>
                            )}
                            {bookingStart && !isActivity && !dimmed && (
                              <span className="truncate px-1 relative z-10 flex items-center gap-0.5">
                                {bookingStart.notes?.includes("[Privatisé]") && <Lock className="h-3 w-3 shrink-0" />}
                                {bookingStart.profiles?.first_name?.[0]}.{bookingStart.profiles?.last_name?.[0]}.
                              </span>
                            )}
                          </div>
                        );

                        return (
                          <td key={room.id} className="p-1 text-center">
                            {isOccupied && tooltipLines.length > 0 ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  {cellContent}
                                </TooltipTrigger>
                                <TooltipContent
                                  side="top"
                                  className="max-w-xs text-xs space-y-1"
                                >
                                  <p className="font-semibold text-[11px] mb-1">{room.name}</p>
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
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};

export default AllRoomsOverview;
