import { useState, useMemo, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, subWeeks, subMonths, startOfWeek, startOfMonth, format, isWeekend } from "date-fns";
import { fr } from "date-fns/locale";
import { TrendingUp, DollarSign, Users, CalendarCheck, BarChart3, MapPin, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar } from "recharts";
import { getOpeningHours } from "@/components/dashboard/bookings/utils";

type ViewMode = "weekly" | "monthly";

const AdminAnalytics = () => {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>("weekly");
  const [isExporting, setIsExporting] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);

  const handleExportPDF = useCallback(async () => {
    if (!dashboardRef.current) return;
    setIsExporting(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const element = dashboardRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/png");
      const imgWidth = 190;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const pdf = new jsPDF("p", "mm", "a4");
      const pageHeight = pdf.internal.pageSize.getHeight() - 20;
      let position = 10;

      if (imgHeight <= pageHeight) {
        pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
      } else {
        let heightLeft = imgHeight;
        while (heightLeft > 0) {
          pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
          if (heightLeft > 0) {
            pdf.addPage();
            position = -(imgHeight - heightLeft) + 10;
          }
        }
      }

      const dateStr = format(new Date(), "yyyy-MM-dd");
      pdf.save(`medsquare-statistiques-${dateStr}.pdf`);
      toast({ title: "PDF exporté !", description: "Le rapport a été téléchargé." });
    } catch (err) {
      console.error("PDF export error:", err);
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de générer le PDF." });
    } finally {
      setIsExporting(false);
    }
  }, [toast]);

  // Compute period boundaries
  const periods = useMemo(() => {
    const now = new Date();
    if (viewMode === "weekly") {
      const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
      return Array.from({ length: 4 }, (_, i) => {
        const start = subWeeks(currentWeekStart, 3 - i);
        const end = addDays(start, 7);
        return { start, end, label: `Sem. ${format(start, "d MMM", { locale: fr })}` };
      });
    } else {
      return Array.from({ length: 3 }, (_, i) => {
        const start = startOfMonth(subMonths(now, 2 - i));
        const end = i === 2 ? now : startOfMonth(subMonths(now, 1 - i));
        return { start, end, label: format(start, "MMM yyyy", { locale: fr }) };
      });
    }
  }, [viewMode]);

  const globalStart = periods[0].start.toISOString();
  const globalEnd = periods[periods.length - 1].end.toISOString();

  // Fetch all data
  const { data: rooms } = useQuery({
    queryKey: ["admin-analytics-rooms"],
    queryFn: async () => {
      const { data } = await supabase.from("rooms").select("id, name, hourly_rate");
      return data || [];
    },
  });

  const { data: bookings } = useQuery({
    queryKey: ["admin-analytics-bookings", globalStart, globalEnd],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("id, room_id, practitioner_id, start_time, end_time, status")
        .gte("start_time", globalStart)
        .lt("start_time", globalEnd)
        .neq("status", "cancelled");
      return data || [];
    },
    enabled: !!rooms,
  });

  const { data: sessions } = useQuery({
    queryKey: ["admin-analytics-sessions", globalStart, globalEnd],
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_sessions")
        .select("id, room_id, start_time, end_time, status")
        .gte("start_time", globalStart)
        .lt("start_time", globalEnd)
        .eq("status", "scheduled");
      return data || [];
    },
    enabled: !!rooms,
  });

  const { data: registrations } = useQuery({
    queryKey: ["admin-analytics-registrations", globalStart, globalEnd],
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_registrations")
        .select("id, session_id, created_at, status")
        .eq("status", "registered");
      return data || [];
    },
  });

  // Compute chart data
  const { chartData, roomOccupancyData } = useMemo(() => {
    if (!rooms || !bookings || !sessions || !registrations) return { chartData: [], roomOccupancyData: [] };

    const chartData = periods.map(({ start, end, label }) => {
      let revenue = 0;
      const periodBookings = bookings.filter(
        (b) => new Date(b.start_time) >= start && new Date(b.start_time) < end
      );
      for (const b of periodBookings) {
        const room = rooms.find((r) => r.id === b.room_id);
        const hours = (new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 3600000;
        revenue += (room?.hourly_rate || 0) * hours;
      }

      let totalSlots = 0;
      let occupiedSlots = 0;
      const days = Math.ceil((end.getTime() - start.getTime()) / 86400000);
      for (let d = 0; d < days; d++) {
        const day = addDays(start, d);
        const { start: oS, end: oE } = getOpeningHours(day);
        const daySlots = oE - oS;
        totalSlots += daySlots * rooms.length;

        for (const room of rooms) {
          for (let h = oS; h < oE; h++) {
            const slotStart = new Date(day);
            slotStart.setHours(h, 0, 0, 0);
            const slotEnd = new Date(day);
            slotEnd.setHours(h + 1, 0, 0, 0);

            const isOccupied =
              bookings.some(
                (b) =>
                  b.room_id === room.id &&
                  new Date(b.start_time) >= start &&
                  new Date(b.start_time) < end &&
                  new Date(b.start_time) < slotEnd &&
                  new Date(b.end_time) > slotStart
              ) ||
              sessions.some(
                (s) =>
                  s.room_id === room.id &&
                  new Date(s.start_time) >= start &&
                  new Date(s.start_time) < end &&
                  new Date(s.start_time) < slotEnd &&
                  new Date(s.end_time) > slotStart
              );
            if (isOccupied) occupiedSlots++;
          }
        }
      }
      const occupancy = totalSlots > 0 ? Math.round((occupiedSlots / totalSlots) * 100) : 0;

      const periodSessionIds = new Set(
        sessions
          .filter((s) => new Date(s.start_time) >= start && new Date(s.start_time) < end)
          .map((s) => s.id)
      );
      const regCount = registrations.filter((r) => periodSessionIds.has(r.session_id)).length;

      const activePractitioners = new Set(
        periodBookings.map((b) => b.practitioner_id)
      ).size;

      return {
        period: label,
        revenue: Math.round(revenue),
        occupancy,
        registrations: regCount,
        practitioners: activePractitioners,
      };
    });

    // Per-room occupancy data
    const roomOccupancyData = periods.map(({ start, end, label }) => {
      const row: Record<string, string | number> = { period: label };
      const days = Math.ceil((end.getTime() - start.getTime()) / 86400000);

      for (const room of rooms) {
        let total = 0;
        let occupied = 0;
        for (let d = 0; d < days; d++) {
          const day = addDays(start, d);
          const { start: oS, end: oE } = getOpeningHours(day);
          total += oE - oS;
          for (let h = oS; h < oE; h++) {
            const slotStart = new Date(day);
            slotStart.setHours(h, 0, 0, 0);
            const slotEnd = new Date(day);
            slotEnd.setHours(h + 1, 0, 0, 0);
            const has =
              bookings.some(
                (b) =>
                  b.room_id === room.id &&
                  new Date(b.start_time) >= start &&
                  new Date(b.start_time) < end &&
                  new Date(b.start_time) < slotEnd &&
                  new Date(b.end_time) > slotStart
              ) ||
              sessions.some(
                (s) =>
                  s.room_id === room.id &&
                  new Date(s.start_time) >= start &&
                  new Date(s.start_time) < end &&
                  new Date(s.start_time) < slotEnd &&
                  new Date(s.end_time) > slotStart
              );
            if (has) occupied++;
          }
        }
        row[room.name] = total > 0 ? Math.round((occupied / total) * 100) : 0;
      }
      return row;
    });

    return { chartData, roomOccupancyData };
  }, [periods, rooms, bookings, sessions, registrations]);

  // Current period summary (last period)
  const current = chartData[chartData.length - 1];
  const previous = chartData.length >= 2 ? chartData[chartData.length - 2] : null;

  const kpiCards = current
    ? [
        {
          title: "Revenus",
          value: `${current.revenue} €`,
          delta: previous ? current.revenue - previous.revenue : 0,
          icon: DollarSign,
          color: "text-emerald-600",
        },
        {
          title: "Taux d'occupation",
          value: `${current.occupancy}%`,
          delta: previous ? current.occupancy - previous.occupancy : 0,
          icon: BarChart3,
          color: "text-primary",
          suffix: " pts",
        },
        {
          title: "Inscriptions",
          value: String(current.registrations),
          delta: previous ? current.registrations - previous.registrations : 0,
          icon: CalendarCheck,
          color: "text-orange-600",
        },
        {
          title: "Praticiens actifs",
          value: String(current.practitioners),
          delta: previous ? current.practitioners - previous.practitioners : 0,
          icon: Users,
          color: "text-violet-600",
        },
      ]
    : [];

  const revenueChartConfig = {
    revenue: { label: "Revenus (€)", color: "hsl(var(--chart-1))" },
  };
  const occupancyChartConfig = {
    occupancy: { label: "Occupation (%)", color: "hsl(var(--chart-2))" },
  };
  const registrationsChartConfig = {
    registrations: { label: "Inscriptions", color: "hsl(var(--chart-3))" },
  };
  const practitionersChartConfig = {
    practitioners: { label: "Praticiens actifs", color: "hsl(var(--chart-4))" },
  };
  const roomOccupancyChartConfig = rooms
    ? Object.fromEntries(
        rooms.map((room, i) => [
          room.name,
          { label: room.name, color: `hsl(var(--chart-${(i % 5) + 1}))` },
        ])
      )
    : {};

  return (
    <DashboardLayout>
      <div ref={dashboardRef} className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-display text-xl font-bold">Statistiques</h2>
            <p className="text-muted-foreground text-sm mt-0.5">
              Vue d'ensemble de l'activité du centre.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={handleExportPDF}
              disabled={isExporting}
            >
              <FileDown className="h-3.5 w-3.5" />
              {isExporting ? "Export…" : "Export PDF"}
            </Button>
            <Tabs
              value={viewMode}
              onValueChange={(v) => setViewMode(v as ViewMode)}
            >
              <TabsList>
                <TabsTrigger value="weekly">Semaines</TabsTrigger>
                <TabsTrigger value="monthly">Mois</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map((kpi) => (
            <Card key={kpi.title}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">{kpi.title}</span>
                  <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
                <div className="text-2xl font-bold">{kpi.value}</div>
                {previous && (
                  <p className={`text-xs mt-1 ${kpi.delta >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                    {kpi.delta >= 0 ? "+" : ""}
                    {kpi.delta}
                    {kpi.suffix || ""} vs période préc.
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts grid */}
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Revenue */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-600" />
                Évolution des revenus
              </CardTitle>
              <CardDescription className="text-xs">
                Basé sur le tarif horaire × heures réservées
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={revenueChartConfig} className="h-[200px] w-full">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}€`} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(v) => `${v} €`} />} />
                  <Bar dataKey="revenue" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Occupancy */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Taux d'occupation global
              </CardTitle>
              <CardDescription className="text-xs">
                Toutes salles confondues
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={occupancyChartConfig} className="h-[200px] w-full">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(v) => `${v}%`} />} />
                  <Line type="monotone" dataKey="occupancy" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Registrations */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CalendarCheck className="h-4 w-4 text-orange-600" />
                Inscriptions aux activités
              </CardTitle>
              <CardDescription className="text-xs">
                Nombre d'inscriptions par période
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={registrationsChartConfig} className="h-[200px] w-full">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="registrations" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Active practitioners */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-violet-600" />
                Praticiens actifs
              </CardTitle>
              <CardDescription className="text-xs">
                Praticiens ayant des réservations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={practitionersChartConfig} className="h-[200px] w-full">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="practitioners" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Per-room occupancy chart */}
        {rooms && rooms.length > 0 && roomOccupancyData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                Occupation par salle
              </CardTitle>
              <CardDescription className="text-xs">
                Taux d'occupation (%) individuel par salle et par période
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={roomOccupancyChartConfig} className="h-[260px] w-full">
                <BarChart data={roomOccupancyData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(v) => `${v}%`} />} />
                  {rooms.map((room, i) => (
                    <Bar
                      key={room.id}
                      dataKey={room.name}
                      fill={`hsl(var(--chart-${(i % 5) + 1}))`}
                      radius={[4, 4, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminAnalytics;
