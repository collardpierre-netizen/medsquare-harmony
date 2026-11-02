import { useEffect, useState, useMemo } from "react";
import { addDays, startOfDay, startOfWeek, subWeeks, format, isSameDay, isWeekend } from "date-fns";
import { fr } from "date-fns/locale";
import { MapPin, Clock, Users, ChevronLeft, ChevronRight, CalendarPlus, BarChart3, Download, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getOpeningHours } from "@/components/dashboard/bookings/utils";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";

interface RoomWithStats {
  id: string;
  name: string;
  capacity: number | null;
  floor: string | null;
  photos: string[] | null;
  equipment: string[] | null;
  bookingCount: number;
}

interface SlotInfo {
  hour: number;
  status: "free" | "mine" | "taken" | "activity" | "closed";
  label?: string;
}

const MyRooms = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [rooms, setRooms] = useState<RoomWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dayData, setDayData] = useState<Record<string, SlotInfo[]>>({});
  const [weeklyOccupancy, setWeeklyOccupancy] = useState<Record<string, { occupied: number; total: number }>>({});
  const [trendData, setTrendData] = useState<Array<Record<string, string | number>>>([]);
  const [chartMode, setChartMode] = useState<"line" | "bar">("line");

  // Compute current week start based on selectedDate
  const currentWeekStart = useMemo(
    () => startOfWeek(selectedDate, { weekStartsOn: 1 }),
    [selectedDate]
  );

  // Fetch rooms the practitioner uses (has bookings in)
  useEffect(() => {
    if (!profile) return;

    const fetchMyRooms = async () => {
      setLoading(true);

      // Get rooms where practitioner has bookings
      const { data: bookings } = await supabase
        .from("bookings")
        .select("room_id")
        .eq("practitioner_id", profile.id)
        .neq("status", "cancelled");

      // Get rooms where practitioner has activity sessions
      const { data: sessions } = await supabase
        .from("activity_sessions")
        .select("room_id, activities!inner(practitioner_id)")
        .eq("activities.practitioner_id", profile.id);

      // Combine unique room IDs
      const roomIds = new Set<string>();
      (bookings || []).forEach((b) => { if (b.room_id) roomIds.add(b.room_id); });
      (sessions || []).forEach((s: any) => { if (s.room_id) roomIds.add(s.room_id); });

      if (roomIds.size === 0) {
        setRooms([]);
        setLoading(false);
        return;
      }

      // Fetch room details
      const { data: roomsData } = await supabase
        .from("rooms")
        .select("*")
        .in("id", Array.from(roomIds))
        .order("name");

      // Count bookings per room
      const roomsWithStats: RoomWithStats[] = (roomsData || []).map((room) => {
        const count = (bookings || []).filter((b) => b.room_id === room.id).length;
        return {
          id: room.id,
          name: room.name,
          capacity: room.capacity,
          floor: room.floor,
          photos: room.photos,
          equipment: room.equipment,
          bookingCount: count,
        };
      });

      setRooms(roomsWithStats);
      setLoading(false);
    };

    fetchMyRooms();
  }, [profile]);

  // Fetch day availability for all rooms
  useEffect(() => {
    if (rooms.length === 0 || !profile) return;

    const fetchDayAvailability = async () => {
      const dayStart = startOfDay(selectedDate).toISOString();
      const dayEnd = addDays(startOfDay(selectedDate), 1).toISOString();
      const roomIds = rooms.map((r) => r.id);

      const [{ data: bookingsData }, { data: sessionsData }] = await Promise.all([
        supabase
          .from("bookings")
          .select("room_id, start_time, end_time, practitioner_id, profiles(first_name, last_name)")
          .in("room_id", roomIds)
          .gte("start_time", dayStart)
          .lt("start_time", dayEnd)
          .neq("status", "cancelled"),
        supabase
          .from("activity_sessions")
          .select("room_id, start_time, end_time, activities(title)")
          .in("room_id", roomIds)
          .gte("start_time", dayStart)
          .lt("start_time", dayEnd)
          .eq("status", "scheduled"),
      ]);

      const newDayData: Record<string, SlotInfo[]> = {};

      for (const room of rooms) {
        const { start: openStart, end: openEnd } = getOpeningHours(selectedDate, (room as any).opening_hours);
        const slots: SlotInfo[] = [];

        for (let h = openStart; h < openEnd; h++) {
          const slotStart = new Date(selectedDate);
          slotStart.setHours(h, 0, 0, 0);
          const slotEnd = new Date(selectedDate);
          slotEnd.setHours(h + 1, 0, 0, 0);

          // Check activity sessions
          const activity = (sessionsData || []).find((s: any) => {
            if (s.room_id !== room.id) return false;
            const sStart = new Date(s.start_time);
            const sEnd = new Date(s.end_time);
            return sStart < slotEnd && sEnd > slotStart;
          });

          if (activity) {
            slots.push({
              hour: h,
              status: "activity",
              label: (activity as any).activities?.title || "Activité",
            });
            continue;
          }

          // Check bookings
          const booking = (bookingsData || []).find((b: any) => {
            if (b.room_id !== room.id) return false;
            const bStart = new Date(b.start_time);
            const bEnd = new Date(b.end_time);
            return bStart < slotEnd && bEnd > slotStart;
          });

          if (booking) {
            const isMine = (booking as any).practitioner_id === profile.id;
            const name = (booking as any).profiles;
            slots.push({
              hour: h,
              status: isMine ? "mine" : "taken",
              label: isMine
                ? "Ma réservation"
                : `${name?.first_name?.[0] || ""}${name?.last_name?.[0] || ""}`.toUpperCase(),
            });
          } else {
            slots.push({ hour: h, status: "free" });
          }
        }

        newDayData[room.id] = slots;
      }

      setDayData(newDayData);
    };

    fetchDayAvailability();
  }, [rooms, selectedDate, profile]);

  // Fetch weekly occupancy stats
  useEffect(() => {
    if (rooms.length === 0) return;

    const fetchWeeklyOccupancy = async () => {
      const weekEnd = addDays(currentWeekStart, 7);
      const roomIds = rooms.map((r) => r.id);

      const [{ data: bookingsData }, { data: sessionsData }] = await Promise.all([
        supabase
          .from("bookings")
          .select("room_id, start_time, end_time")
          .in("room_id", roomIds)
          .gte("start_time", currentWeekStart.toISOString())
          .lt("start_time", weekEnd.toISOString())
          .neq("status", "cancelled"),
        supabase
          .from("activity_sessions")
          .select("room_id, start_time, end_time")
          .in("room_id", roomIds)
          .gte("start_time", currentWeekStart.toISOString())
          .lt("start_time", weekEnd.toISOString())
          .eq("status", "scheduled"),
      ]);

      const result: Record<string, { occupied: number; total: number }> = {};

      for (const room of rooms) {
        let totalSlots = 0;
        let occupiedSlots = 0;

        for (let d = 0; d < 7; d++) {
          const day = addDays(currentWeekStart, d);
          const { start: openStart, end: openEnd } = getOpeningHours(day, (room as any).opening_hours);
          totalSlots += openEnd - openStart;

          for (let h = openStart; h < openEnd; h++) {
            const slotStart = new Date(day);
            slotStart.setHours(h, 0, 0, 0);
            const slotEnd = new Date(day);
            slotEnd.setHours(h + 1, 0, 0, 0);

            const hasBooking = (bookingsData || []).some((b: any) => {
              if (b.room_id !== room.id) return false;
              return new Date(b.start_time) < slotEnd && new Date(b.end_time) > slotStart;
            });
            const hasActivity = !hasBooking && (sessionsData || []).some((s: any) => {
              if (s.room_id !== room.id) return false;
              return new Date(s.start_time) < slotEnd && new Date(s.end_time) > slotStart;
            });

            if (hasBooking || hasActivity) occupiedSlots++;
          }
        }

        result[room.id] = { occupied: occupiedSlots, total: totalSlots };
      }

      setWeeklyOccupancy(result);
    };

    fetchWeeklyOccupancy();
  }, [rooms, currentWeekStart]);

  // Fetch 4-week occupancy trend
  useEffect(() => {
    if (rooms.length === 0) return;

    const fetchTrend = async () => {
      const roomIds = rooms.map((r) => r.id);
      const weeks: Array<{ start: Date; end: Date; label: string }> = [];
      for (let i = 3; i >= 0; i--) {
        const ws = subWeeks(currentWeekStart, i);
        const we = addDays(ws, 7);
        weeks.push({ start: ws, end: we, label: format(ws, "d MMM", { locale: fr }) });
      }

      const [{ data: allBookings }, { data: allSessions }] = await Promise.all([
        supabase
          .from("bookings")
          .select("room_id, start_time, end_time")
          .in("room_id", roomIds)
          .gte("start_time", weeks[0].start.toISOString())
          .lt("start_time", weeks[weeks.length - 1].end.toISOString())
          .neq("status", "cancelled"),
        supabase
          .from("activity_sessions")
          .select("room_id, start_time, end_time")
          .in("room_id", roomIds)
          .gte("start_time", weeks[0].start.toISOString())
          .lt("start_time", weeks[weeks.length - 1].end.toISOString())
          .eq("status", "scheduled"),
      ]);

      const trend = weeks.map(({ start, end, label }) => {
        const row: Record<string, string | number> = { week: label };
        let globalTotal = 0;
        let globalOccupied = 0;
        for (const room of rooms) {
          let total = 0;
          let occupied = 0;
          for (let d = 0; d < 7; d++) {
            const day = addDays(start, d);
            const { start: oS, end: oE } = getOpeningHours(day, (room as any).opening_hours);
            total += oE - oS;
            for (let h = oS; h < oE; h++) {
              const slotStart = new Date(day);
              slotStart.setHours(h, 0, 0, 0);
              const slotEnd = new Date(day);
              slotEnd.setHours(h + 1, 0, 0, 0);
              const has = (allBookings || []).some((b: any) =>
                b.room_id === room.id && new Date(b.start_time) < slotEnd && new Date(b.end_time) > slotStart
              ) || (allSessions || []).some((s: any) =>
                s.room_id === room.id && new Date(s.start_time) < slotEnd && new Date(s.end_time) > slotStart
              );
              if (has) occupied++;
            }
          }
          row[room.name] = total > 0 ? Math.round((occupied / total) * 100) : 0;
          globalTotal += total;
          globalOccupied += occupied;
        }
        row["Moyenne"] = globalTotal > 0 ? Math.round((globalOccupied / globalTotal) * 100) : 0;
        return row;
      });

      setTrendData(trend);
    };

    fetchTrend();
  }, [rooms, currentWeekStart]);

  const statusConfig = {
    free: { bg: "bg-emerald-500/15", text: "text-emerald-700", label: "Libre" },
    mine: { bg: "bg-primary/15", text: "text-primary", label: "Ma réservation" },
    taken: { bg: "bg-muted", text: "text-muted-foreground", label: "Réservé" },
    activity: { bg: "bg-orange-500/15", text: "text-orange-700", label: "Activité" },
    closed: { bg: "bg-muted/50", text: "text-muted-foreground/50", label: "Fermé" },
  };

  const isToday = isSameDay(selectedDate, new Date());

  const exportWeeklyCSV = () => {
    const weekEnd = addDays(currentWeekStart, 6);
    const header = "Salle;Heures occupées;Heures totales;Taux d'occupation (%)";
    const rows = rooms.map((room) => {
      const stats = weeklyOccupancy[room.id];
      const occupied = stats?.occupied ?? 0;
      const total = stats?.total ?? 0;
      const pct = total > 0 ? Math.round((occupied / total) * 100) : 0;
      return `${room.name};${occupied};${total};${pct}`;
    });
    const csv = [
      `Occupation hebdomadaire — ${format(currentWeekStart, "dd/MM/yyyy")} au ${format(weekEnd, "dd/MM/yyyy")}`,
      "",
      header,
      ...rows,
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `occupation_${format(currentWeekStart, "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="font-display text-xl font-bold">Mes Espaces</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            Disponibilités des salles que vous utilisez habituellement.
          </p>
        </div>

        {/* Date navigation */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSelectedDate((d) => addDays(d, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm font-medium min-w-[180px] text-center">
            {isToday && (
              <Badge variant="secondary" className="mr-2 text-[10px]">
                Aujourd'hui
              </Badge>
            )}
            {format(selectedDate, "EEEE d MMMM yyyy", { locale: fr })}
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSelectedDate((d) => addDays(d, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isToday && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => setSelectedDate(new Date())}
            >
              Retour à aujourd'hui
            </Button>
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-xs">
          {Object.entries(statusConfig).filter(([k]) => k !== "closed").map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className={cn("w-3 h-3 rounded-sm", cfg.bg, "border border-border")} />
              <span className="text-muted-foreground">{cfg.label}</span>
            </div>
          ))}
        </div>

        {/* Weekly occupancy summary */}
        {!loading && rooms.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm flex-1">Occupation de la semaine</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5"
                  onClick={exportWeeklyCSV}
                >
                  <Download className="h-3.5 w-3.5" />
                  Export CSV
                </Button>
              </div>
              <CardDescription className="text-xs">
                Semaine du {format(currentWeekStart, "d MMM", { locale: fr })} au{" "}
                {format(addDays(currentWeekStart, 6), "d MMM yyyy", { locale: fr })}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {rooms.map((room) => {
                const stats = weeklyOccupancy[room.id];
                const pct = stats && stats.total > 0 ? Math.round((stats.occupied / stats.total) * 100) : 0;
                return (
                  <div key={room.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{room.name}</span>
                      <span className={cn(
                        "font-semibold",
                        pct >= 75 ? "text-destructive" : pct >= 40 ? "text-orange-600" : "text-emerald-600"
                      )}>
                        {pct}% occupé
                        {stats && (
                          <span className="text-muted-foreground font-normal ml-1.5">
                            ({stats.occupied}/{stats.total}h)
                          </span>
                        )}
                      </span>
                    </div>
                    <Progress
                      value={pct}
                      className={cn(
                        "h-2",
                        pct >= 75 ? "[&>div]:bg-destructive" : pct >= 40 ? "[&>div]:bg-orange-500" : "[&>div]:bg-emerald-500"
                      )}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* 4-week occupancy trend chart */}
        {!loading && rooms.length > 0 && trendData.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">Évolution sur 4 semaines</CardTitle>
                </div>
                <div className="flex items-center rounded-lg border border-border p-0.5">
                  <Button
                    variant={chartMode === "line" ? "default" : "ghost"}
                    size="sm"
                    className="h-7 px-2.5 text-xs"
                    onClick={() => setChartMode("line")}
                  >
                    Lignes
                  </Button>
                  <Button
                    variant={chartMode === "bar" ? "default" : "ghost"}
                    size="sm"
                    className="h-7 px-2.5 text-xs"
                    onClick={() => setChartMode("bar")}
                  >
                    Barres
                  </Button>
                </div>
              </div>
              <CardDescription className="text-xs">
                Taux d'occupation (%) par salle
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <ChartContainer
                config={{
                  ...Object.fromEntries(
                    rooms.map((room, i) => [
                      room.name,
                      {
                        label: room.name,
                        color: `hsl(var(--chart-${(i % 5) + 1}))`,
                      },
                    ])
                  ),
                  Moyenne: {
                    label: "Moyenne globale",
                    color: "hsl(var(--muted-foreground))",
                  },
                }}
                className="h-[220px] w-full"
              >
                {chartMode === "line" ? (
                  <LineChart data={trendData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="week" className="text-xs" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                    <ChartTooltip
                      content={<ChartTooltipContent formatter={(value) => `${value}%`} />}
                    />
                    {rooms.map((room, i) => (
                      <Line
                        key={room.id}
                        type="monotone"
                        dataKey={room.name}
                        stroke={`hsl(var(--chart-${(i % 5) + 1}))`}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    ))}
                    <Line
                      type="monotone"
                      dataKey="Moyenne"
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                ) : (
                  <BarChart data={trendData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="week" className="text-xs" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                    <ChartTooltip
                      content={<ChartTooltipContent formatter={(value) => `${value}%`} />}
                    />
                    {rooms.map((room, i) => (
                      <Bar
                        key={room.id}
                        dataKey={room.name}
                        fill={`hsl(var(--chart-${(i % 5) + 1}))`}
                        stackId="rooms"
                        radius={i === rooms.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                      />
                    ))}
                  </BarChart>
                )}
              </ChartContainer>
            </CardContent>
          </Card>
        )}

        {loading && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Chargement de vos espaces…
          </div>
        )}

        {/* No rooms */}
        {!loading && rooms.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <MapPin className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground text-sm">
                Aucune salle trouvée. Réservez une salle pour qu'elle apparaisse ici.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Room cards with availability */}
        <div className="grid gap-4">
          {rooms.map((room) => {
            const slots = dayData[room.id] || [];
            const freeCount = slots.filter((s) => s.status === "free").length;
            const mineCount = slots.filter((s) => s.status === "mine").length;

            return (
              <Card key={room.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <MapPin className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{room.name}</CardTitle>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          {room.floor && <span>{room.floor}</span>}
                          {room.capacity && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {room.capacity} pers.
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {room.bookingCount} réservation{room.bookingCount !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1.5"
                        onClick={() => navigate(`/dashboard/bookings?room=${room.id}`)}
                      >
                        <CalendarPlus className="h-3.5 w-3.5" />
                        Réserver
                      </Button>
                      {mineCount > 0 && (
                        <Badge variant="default" className="text-[10px]">
                          {mineCount} créneau{mineCount !== 1 ? "x" : ""} à moi
                        </Badge>
                      )}
                      <Badge
                        variant={freeCount > 3 ? "secondary" : freeCount > 0 ? "outline" : "destructive"}
                        className="text-[10px]"
                      >
                        {freeCount} libre{freeCount !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-7 sm:grid-cols-14 gap-1">
                    {slots.map((slot) => {
                      const cfg = statusConfig[slot.status];
                      return (
                        <div
                          key={slot.hour}
                          className={cn(
                            "rounded-md px-1.5 py-1.5 text-center text-[10px] font-medium border border-border/50 transition-colors",
                            cfg.bg,
                            cfg.text
                          )}
                          title={slot.label || cfg.label}
                        >
                          <div className="font-semibold">{`${slot.hour}h`}</div>
                          {slot.label && (
                            <div className="text-[8px] truncate opacity-80 mt-0.5">
                              {slot.label.length > 8 ? slot.label.slice(0, 8) + "…" : slot.label}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default MyRooms;
