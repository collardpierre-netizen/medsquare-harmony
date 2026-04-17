import { useState, useMemo, useRef, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { addDays, addWeeks, subWeeks, subMonths, addMonths, startOfWeek, startOfMonth, endOfMonth, format, isWeekend, differenceInDays, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, endOfDay, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { TrendingUp, DollarSign, Users, CalendarCheck, BarChart3, MapPin, FileDown, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar, Legend } from "recharts";
import { getOpeningHours } from "@/components/dashboard/bookings/utils";
import { isRoomCurrentlyPrivatized, isRoomPrivatizedOnDay } from "@/lib/roomPrivatization";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const AdminAnalytics = () => {
  const { toast } = useToast();
  const today = new Date();
  const [dateFrom, setDateFrom] = useState<Date>(subWeeks(startOfWeek(today, { weekStartsOn: 1 }), 3));
  const [dateTo, setDateTo] = useState<Date>(addDays(startOfWeek(today, { weekStartsOn: 1 }), 7));
  const [selectedRoomId, setSelectedRoomId] = useState<string>("all");
  const [isExporting, setIsExporting] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);

  const [isExportingExcel, setIsExportingExcel] = useState(false);

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

  // Auto-granularity based on date range span
  const granularity = useMemo(() => {
    const days = differenceInDays(dateTo, dateFrom);
    if (days <= 14) return "day" as const;
    if (days <= 90) return "week" as const;
    return "month" as const;
  }, [dateFrom, dateTo]);

  const granularityLabel = granularity === "day" ? "Jour" : granularity === "week" ? "Semaine" : "Mois";

  // Compute period boundaries from dateFrom/dateTo
  const periods = useMemo(() => {
    if (granularity === "month") {
      const months = eachMonthOfInterval({ start: dateFrom, end: dateTo });
      return months.map((m, i) => {
        const start = startOfMonth(m);
        const end = i < months.length - 1 ? startOfMonth(months[i + 1]) : addDays(endOfMonth(m), 1);
        return { start, end, label: format(start, "MMM yyyy", { locale: fr }) };
      });
    } else if (granularity === "week") {
      const weeks = eachWeekOfInterval({ start: dateFrom, end: dateTo }, { weekStartsOn: 1 });
      return weeks.map((w) => {
        const start = w;
        const end = addDays(w, 7);
        return { start, end, label: `Sem. ${format(start, "d MMM", { locale: fr })}` };
      });
    } else {
      const days = eachDayOfInterval({ start: dateFrom, end: addDays(dateTo, -1) });
      return days.map((d) => {
        const start = startOfDay(d);
        const end = addDays(start, 1);
        return { start, end, label: format(d, "EEE d MMM", { locale: fr }) };
      });
    }
  }, [dateFrom, dateTo, granularity]);

  const globalStart = periods.length > 0 ? periods[0].start.toISOString() : dateFrom.toISOString();
  const globalEnd = periods.length > 0 ? periods[periods.length - 1].end.toISOString() : dateTo.toISOString();

  // Preset handlers
  const applyPreset = (preset: string) => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    switch (preset) {
      case "4w":
        setDateFrom(subWeeks(weekStart, 3));
        setDateTo(addDays(weekStart, 7));
        break;
      case "3m":
        setDateFrom(startOfMonth(subMonths(now, 2)));
        setDateTo(addDays(endOfMonth(now), 1));
        break;
      case "6m":
        setDateFrom(startOfMonth(subMonths(now, 5)));
        setDateTo(addDays(endOfMonth(now), 1));
        break;
      case "12m":
        setDateFrom(startOfMonth(subMonths(now, 11)));
        setDateTo(addDays(endOfMonth(now), 1));
        break;
    }
  };

  // Fetch all data
  const { data: rooms } = useQuery({
    queryKey: ["admin-analytics-rooms"],
    queryFn: async () => {
      const { data } = await supabase.from("rooms").select("id, name, hourly_rate, is_available, privatized_from, privatized_until");
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

  // ─── Monthly revenue: independent of date filter, last 24 months (N + N-1) ───
  const monthlyRange = useMemo(() => {
    const end = addDays(endOfMonth(today), 1); // exclusive
    const start = startOfMonth(subMonths(today, 11));
    // We also fetch the previous 12 months (N-1) for year-over-year comparison
    const startNMinus1 = startOfMonth(subMonths(today, 23));
    return {
      start: start.toISOString(),
      end: end.toISOString(),
      startDate: start,
      endDate: end,
      startNMinus1: startNMinus1.toISOString(),
      startNMinus1Date: startNMinus1,
    };
  }, [today.getMonth(), today.getFullYear()]);

  const { data: monthlyBookings } = useQuery({
    queryKey: ["admin-analytics-monthly-revenue", monthlyRange.startNMinus1, monthlyRange.end],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("id, room_id, start_time, end_time, status")
        .gte("start_time", monthlyRange.startNMinus1)
        .lt("start_time", monthlyRange.end)
        .neq("status", "cancelled");
      return data || [];
    },
    enabled: !!rooms,
  });

  const monthlyRevenueData = useMemo(() => {
    if (!rooms || !monthlyBookings) return [];
    const months = eachMonthOfInterval({ start: monthlyRange.startDate, end: subMonths(monthlyRange.endDate, 1) });

    const computeRevenueForRange = (start: Date, end: Date) => {
      let revenue = 0;
      let count = 0;
      for (const b of monthlyBookings) {
        const ts = new Date(b.start_time);
        if (ts < start || ts >= end) continue;
        const room = rooms.find((r) => r.id === b.room_id);
        const hours = (new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 3600000;
        revenue += (room?.hourly_rate || 0) * hours;
        count += 1;
      }
      return { revenue: Math.round(revenue), count };
    };

    return months.map((m) => {
      const start = startOfMonth(m);
      const end = addDays(endOfMonth(m), 1);
      const current = computeRevenueForRange(start, end);

      // Same month, previous year
      const startPrevYear = startOfMonth(subMonths(start, 12));
      const endPrevYear = addDays(endOfMonth(startPrevYear), 1);
      const previous = computeRevenueForRange(startPrevYear, endPrevYear);

      const yoyDelta = current.revenue - previous.revenue;
      const yoyPct = previous.revenue > 0 ? Math.round((yoyDelta / previous.revenue) * 100) : null;

      return {
        month: format(start, "MMM yyyy", { locale: fr }),
        monthShort: format(start, "MMM", { locale: fr }),
        bookings: current.count,
        revenue: current.revenue,
        revenuePrevYear: previous.revenue,
        bookingsPrevYear: previous.count,
        yoyDelta,
        yoyPct,
        date: start,
      };
    });
  }, [rooms, monthlyBookings, monthlyRange]);

  const monthlyTotals = useMemo(() => {
    const total12m = monthlyRevenueData.reduce((s, r) => s + r.revenue, 0);
    const totalPrevYear = monthlyRevenueData.reduce((s, r) => s + r.revenuePrevYear, 0);
    const avg = monthlyRevenueData.length > 0 ? Math.round(total12m / monthlyRevenueData.length) : 0;
    const currentYear = today.getFullYear();
    const ytd = monthlyRevenueData
      .filter((r) => r.date.getFullYear() === currentYear)
      .reduce((s, r) => s + r.revenue, 0);
    // YTD N-1: same number of months elapsed in previous year
    const ytdPrev = monthlyRevenueData
      .filter((r) => r.date.getFullYear() === currentYear)
      .reduce((s, r) => s + r.revenuePrevYear, 0);
    const ytdYoyDelta = ytd - ytdPrev;
    const ytdYoyPct = ytdPrev > 0 ? Math.round((ytdYoyDelta / ytdPrev) * 100) : null;

    const yoyDelta = total12m - totalPrevYear;
    const yoyPct = totalPrevYear > 0 ? Math.round((yoyDelta / totalPrevYear) * 100) : null;

    const last = monthlyRevenueData[monthlyRevenueData.length - 1];
    const prev = monthlyRevenueData[monthlyRevenueData.length - 2];
    const monthDelta = last && prev ? last.revenue - prev.revenue : 0;
    const monthDeltaPct = last && prev && prev.revenue > 0 ? Math.round((monthDelta / prev.revenue) * 100) : 0;
    return { total12m, totalPrevYear, avg, ytd, ytdPrev, ytdYoyDelta, ytdYoyPct, yoyDelta, yoyPct, monthDelta, monthDeltaPct };
  }, [monthlyRevenueData, today]);

  const handleExportMonthlyExcel = useCallback(async () => {
    if (!monthlyRevenueData.length || !rooms || !monthlyBookings) {
      toast({ variant: "destructive", title: "Données indisponibles", description: "Le CA mensuel n'est pas encore chargé." });
      return;
    }
    setIsExportingExcel(true);
    try {
      const XLSX = await import("xlsx");

      // Build per-room × per-month matrix from raw bookings
      const matrix: Record<string, Record<string, { revenue: number; hours: number; bookings: number }>> = {};
      for (const room of rooms) matrix[room.id] = {};
      for (const b of monthlyBookings) {
        const ts = new Date(b.start_time);
        const monthKey = format(ts, "yyyy-MM");
        const room = rooms.find((r) => r.id === b.room_id);
        if (!room) continue;
        const hours = (new Date(b.end_time).getTime() - ts.getTime()) / 3600000;
        const revenue = (room.hourly_rate || 0) * hours;
        if (!matrix[room.id][monthKey]) matrix[room.id][monthKey] = { revenue: 0, hours: 0, bookings: 0 };
        matrix[room.id][monthKey].revenue += revenue;
        matrix[room.id][monthKey].hours += hours;
        matrix[room.id][monthKey].bookings += 1;
      }

      // Sheet 1: Récapitulatif mensuel (N vs N-1)
      const summaryRows: (string | number)[][] = [
        ["Mois", "Réservations (N)", "CA N (€)", "CA N-1 (€)", "YoY (€)", "YoY (%)", "Évolution m-1 (€)", "Évolution m-1 (%)"],
      ];
      monthlyRevenueData.forEach((row, i) => {
        const prev = i > 0 ? monthlyRevenueData[i - 1] : null;
        const delta = prev ? row.revenue - prev.revenue : 0;
        const deltaPct = prev && prev.revenue > 0 ? Math.round((delta / prev.revenue) * 100) : "";
        summaryRows.push([
          row.month, row.bookings, row.revenue, row.revenuePrevYear,
          row.yoyDelta, row.yoyPct ?? "", prev ? delta : "", deltaPct,
        ]);
      });
      summaryRows.push([
        "TOTAL",
        monthlyRevenueData.reduce((s, r) => s + r.bookings, 0),
        monthlyTotals.total12m, monthlyTotals.totalPrevYear,
        monthlyTotals.yoyDelta, monthlyTotals.yoyPct ?? "", "", "",
      ]);
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
      wsSummary["!cols"] = [{ wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 18 }];

      // Sheet 2: CA par salle × mois
      const monthKeys = monthlyRevenueData.map((r) => format(r.date, "yyyy-MM"));
      const monthLabels = monthlyRevenueData.map((r) => r.month);
      const sortedRooms = [...rooms].sort((a, b) => a.name.localeCompare(b.name));

      const byRoomRows: (string | number)[][] = [["Salle", ...monthLabels, "Total (€)"]];
      const colTotals: number[] = monthKeys.map(() => 0);
      let grandTotal = 0;
      for (const room of sortedRooms) {
        const row: (string | number)[] = [room.name];
        let rowTotal = 0;
        monthKeys.forEach((mk, idx) => {
          const value = matrix[room.id]?.[mk] ? Math.round(matrix[room.id][mk].revenue) : 0;
          row.push(value);
          rowTotal += value;
          colTotals[idx] += value;
        });
        row.push(rowTotal);
        grandTotal += rowTotal;
        byRoomRows.push(row);
      }
      byRoomRows.push(["TOTAL", ...colTotals, grandTotal]);
      const wsByRoom = XLSX.utils.aoa_to_sheet(byRoomRows);
      wsByRoom["!cols"] = [{ wch: 22 }, ...monthLabels.map(() => ({ wch: 12 })), { wch: 14 }];

      // Sheet 3: Heures par salle × mois
      const hoursRows: (string | number)[][] = [["Salle", ...monthLabels, "Total (h)"]];
      const hoursColTotals: number[] = monthKeys.map(() => 0);
      let hoursGrand = 0;
      for (const room of sortedRooms) {
        const row: (string | number)[] = [room.name];
        let rowTotal = 0;
        monthKeys.forEach((mk, idx) => {
          const hrs = matrix[room.id]?.[mk] ? Math.round(matrix[room.id][mk].hours * 10) / 10 : 0;
          row.push(hrs);
          rowTotal += hrs;
          hoursColTotals[idx] += hrs;
        });
        row.push(Math.round(rowTotal * 10) / 10);
        hoursGrand += rowTotal;
        hoursRows.push(row);
      }
      hoursRows.push(["TOTAL", ...hoursColTotals.map((v) => Math.round(v * 10) / 10), Math.round(hoursGrand * 10) / 10]);
      const wsHours = XLSX.utils.aoa_to_sheet(hoursRows);
      wsHours["!cols"] = [{ wch: 22 }, ...monthLabels.map(() => ({ wch: 10 })), { wch: 12 }];

      // Sheet 4: Détail des réservations (12 derniers mois N)
      const detailRows: (string | number)[][] = [
        ["Mois", "Date début (Brussels)", "Date fin (Brussels)", "Salle", "Tarif horaire (€)", "Durée (h)", "CA (€)", "Statut"],
      ];
      const fmtBrussels = new Intl.DateTimeFormat("fr-BE", {
        timeZone: "Europe/Brussels",
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit",
      });
      const startN = monthlyRevenueData[0]?.date;
      const detailBookings = monthlyBookings
        .filter((b) => !startN || new Date(b.start_time) >= startN)
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
      for (const b of detailBookings) {
        const room = rooms.find((r) => r.id === b.room_id);
        const start = new Date(b.start_time);
        const end = new Date(b.end_time);
        const hours = Math.round(((end.getTime() - start.getTime()) / 3600000) * 10) / 10;
        const rate = room?.hourly_rate || 0;
        detailRows.push([
          format(start, "MMM yyyy", { locale: fr }),
          fmtBrussels.format(start),
          fmtBrussels.format(end),
          room?.name || "—",
          rate, hours, Math.round(rate * hours), b.status,
        ]);
      }
      const wsDetail = XLSX.utils.aoa_to_sheet(detailRows);
      wsDetail["!cols"] = [{ wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 12 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsSummary, "Récapitulatif N vs N-1");
      XLSX.utils.book_append_sheet(wb, wsByRoom, "CA par salle");
      XLSX.utils.book_append_sheet(wb, wsHours, "Heures par salle");
      XLSX.utils.book_append_sheet(wb, wsDetail, "Détail réservations");

      const filename = `medsquare-ca-mensuel-${format(today, "yyyy-MM-dd")}.xlsx`;
      XLSX.writeFile(wb, filename);

      toast({ title: "Export réussi ✓", description: `Fichier ${filename} téléchargé.` });
    } catch (err) {
      console.error("Excel export error:", err);
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de générer le fichier Excel." });
    } finally {
      setIsExportingExcel(false);
    }
  }, [monthlyRevenueData, monthlyBookings, monthlyTotals, rooms, today, toast]);

  const getBrusselsOffset = (date: Date): number => {
    const month = date.getUTCMonth();
    const day = date.getUTCDate();
    const weekday = date.getUTCDay();
    const isAfterMarchSwitch = month > 2 || (month === 2 && day - weekday >= 25);
    const isBeforeOctoberSwitch = month < 9 || (month === 9 && day - weekday < 25);
    return (isAfterMarchSwitch && isBeforeOctoberSwitch) ? 2 : 1;
  };

  const { chartData, roomOccupancyData, roomSummaryData, roomRevenueData } = useMemo(() => {
    if (!rooms || !bookings || !sessions || !registrations) return { chartData: [], roomOccupancyData: [], roomSummaryData: [], roomRevenueData: [] };

    const filteredRooms = selectedRoomId === "all" ? rooms : rooms.filter((r) => r.id === selectedRoomId);
    const filteredBookings = selectedRoomId === "all" ? bookings : bookings.filter((b) => b.room_id === selectedRoomId);
    const filteredSessions = selectedRoomId === "all" ? sessions : sessions.filter((s) => s.room_id === selectedRoomId);
    const chartData = periods.map(({ start, end, label }) => {
      let revenue = 0;
      const periodBookings = filteredBookings.filter(
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
        const offset = getBrusselsOffset(day);
        const { start: oS, end: oE } = getOpeningHours(day);
        const daySlots = oE - oS;
        totalSlots += daySlots * filteredRooms.length;

        for (const room of filteredRooms) {
          // Privatized rooms count as 100% occupied (immediate or scheduled-active for this day)
          if (isRoomPrivatizedOnDay(room, day)) {
            occupiedSlots += daySlots;
            continue;
          }
          for (let h = oS; h < oE; h++) {
            const slotStartUTC = new Date(day);
            slotStartUTC.setUTCHours(h - offset, 0, 0, 0);
            const slotEndUTC = new Date(day);
            slotEndUTC.setUTCHours(h - offset + 1, 0, 0, 0);

            const isOccupied =
              filteredBookings.some(
                (b) =>
                  b.room_id === room.id &&
                  new Date(b.start_time) >= start &&
                  new Date(b.start_time) < end &&
                  new Date(b.start_time) < slotEndUTC &&
                  new Date(b.end_time) > slotStartUTC
              ) ||
              filteredSessions.some(
                (s) =>
                  s.room_id === room.id &&
                  new Date(s.start_time) >= start &&
                  new Date(s.start_time) < end &&
                  new Date(s.start_time) < slotEndUTC &&
                  new Date(s.end_time) > slotStartUTC
              );
            if (isOccupied) occupiedSlots++;
          }
        }
      }
      const occupancy = totalSlots > 0 ? Math.round((occupiedSlots / totalSlots) * 100) : 0;

      const periodSessionIds = new Set(
        filteredSessions
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

      for (const room of filteredRooms) {
        let total = 0;
        let occupied = 0;
        for (let d = 0; d < days; d++) {
          const day = addDays(start, d);
          const offset = getBrusselsOffset(day);
          const { start: oS, end: oE } = getOpeningHours(day);
          const daySlots = oE - oS;
          total += daySlots;
          // Privatized rooms count as 100% occupied
          if (isRoomPrivatizedOnDay(room, day)) {
            occupied += daySlots;
            continue;
          }
          for (let h = oS; h < oE; h++) {
            const slotStartUTC = new Date(day);
            slotStartUTC.setUTCHours(h - offset, 0, 0, 0);
            const slotEndUTC = new Date(day);
            slotEndUTC.setUTCHours(h - offset + 1, 0, 0, 0);
            const has =
              filteredBookings.some(
                (b) =>
                  b.room_id === room.id &&
                  new Date(b.start_time) >= start &&
                  new Date(b.start_time) < end &&
                  new Date(b.start_time) < slotEndUTC &&
                  new Date(b.end_time) > slotStartUTC
              ) ||
              filteredSessions.some(
                (s) =>
                  s.room_id === room.id &&
                  new Date(s.start_time) >= start &&
                  new Date(s.start_time) < end &&
                  new Date(s.start_time) < slotEndUTC &&
                  new Date(s.end_time) > slotStartUTC
              );
            if (has) occupied++;
          }
        }
        row[room.name] = total > 0 ? Math.round((occupied / total) * 100) : 0;
      }
      return row;
    });

    // Room summary: booked vs available hours over entire period
    const periodStart = periods[0]?.start;
    const periodEnd = periods[periods.length - 1]?.end;
    const roomSummaryData = filteredRooms.map((room) => {
      let totalHours = 0;
      let bookedHours = 0;
      if (periodStart && periodEnd) {
        const totalDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / 86400000);
        for (let d = 0; d < totalDays; d++) {
          const day = addDays(periodStart, d);
          const offset = getBrusselsOffset(day);
          const { start: oS, end: oE } = getOpeningHours(day);
          const daySlots = oE - oS;
          totalHours += daySlots;
          // Privatized rooms count as 100% occupied
          if (isRoomPrivatizedOnDay(room, day)) {
            bookedHours += daySlots;
            continue;
          }
          for (let h = oS; h < oE; h++) {
            const slotStartUTC = new Date(day);
            slotStartUTC.setUTCHours(h - offset, 0, 0, 0);
            const slotEndUTC = new Date(day);
            slotEndUTC.setUTCHours(h - offset + 1, 0, 0, 0);
            const occupied =
              filteredBookings.some(
                (b) => b.room_id === room.id && new Date(b.start_time) < slotEndUTC && new Date(b.end_time) > slotStartUTC
              ) ||
              filteredSessions.some(
                (s) => s.room_id === room.id && new Date(s.start_time) < slotEndUTC && new Date(s.end_time) > slotStartUTC
              );
            if (occupied) bookedHours++;
          }
        }
      }
      return {
        name: room.name,
        bookedHours,
        totalHours,
        occupancy: totalHours > 0 ? Math.round((bookedHours / totalHours) * 100) : 0,
        isPrivatized: isRoomCurrentlyPrivatized(room),
      };
    });

    // Per-room revenue data
    const roomRevenueData = periods.map(({ start, end, label }) => {
      const row: Record<string, string | number> = { period: label };
      for (const room of filteredRooms) {
        let rev = 0;
        const roomBookings = filteredBookings.filter(
          (b) => b.room_id === room.id && new Date(b.start_time) >= start && new Date(b.start_time) < end
        );
        for (const b of roomBookings) {
          const hours = (new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 3600000;
          rev += (room.hourly_rate || 0) * hours;
        }
        row[room.name] = Math.round(rev);
      }
      return row;
    });

    return { chartData, roomOccupancyData, roomSummaryData, roomRevenueData };
  }, [periods, rooms, bookings, sessions, registrations, selectedRoomId]);

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
    revenue: { label: "CA année N (€)", color: "hsl(var(--chart-1))" },
    revenuePrevYear: { label: "CA année N-1 (€)", color: "hsl(var(--chart-2))" },
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
  const filteredRoomsForChart = selectedRoomId === "all" ? (rooms || []) : (rooms || []).filter((r) => r.id === selectedRoomId);
  const roomColors = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];
  const roomOccupancyChartConfig = Object.fromEntries(
    filteredRoomsForChart.map((room, i) => [
      room.name,
      { label: room.name, color: roomColors[i % roomColors.length] },
    ])
  );
  const roomRevenueChartConfig = Object.fromEntries(
    filteredRoomsForChart.map((room, i) => [
      room.name,
      { label: room.name, color: roomColors[i % roomColors.length] },
    ])
  );

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
            <Select value={selectedRoomId} onValueChange={setSelectedRoomId}>
              <SelectTrigger className="w-[180px] h-9 text-xs">
                <MapPin className="h-3.5 w-3.5 mr-1 shrink-0" />
                <SelectValue placeholder="Toutes les salles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les salles</SelectItem>
                {(rooms || []).map((room) => (
                  <SelectItem key={room.id} value={room.id}>{room.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Date range picker with presets */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            {[
              { label: "4 sem.", value: "4w" },
              { label: "3 mois", value: "3m" },
              { label: "6 mois", value: "6m" },
              { label: "12 mois", value: "12m" },
            ].map((p) => (
              <Button
                key={p.value}
                variant="outline"
                size="sm"
                className="text-xs h-8 px-3"
                onClick={() => applyPreset(p.value)}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-8 text-xs gap-1.5 w-[140px] justify-start", !dateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {format(dateFrom, "d MMM yyyy", { locale: fr })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={(d) => d && setDateFrom(d)} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <span className="text-xs text-muted-foreground">→</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-8 text-xs gap-1.5 w-[140px] justify-start", !dateTo && "text-muted-foreground")}>
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {format(dateTo, "d MMM yyyy", { locale: fr })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar mode="single" selected={dateTo} onSelect={(d) => d && setDateTo(d)} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <Badge variant="secondary" className="text-[10px] h-6">
              {granularityLabel}
            </Badge>
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

        {/* ─── Monthly revenue: 12 derniers mois (indépendant du filtre) ─── */}
        <Card className="border-emerald-500/30">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-sm flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-emerald-600" />
                  Chiffre d'affaires — 12 derniers mois
                </CardTitle>
                <CardDescription className="text-xs">
                  Vue indépendante du filtre · CA = tarif horaire salle × heures réservées · comparaison année N vs N-1
                </CardDescription>
              </div>
              <div className="flex items-center gap-3 text-xs flex-wrap">
                <div className="text-right">
                  <div className="text-muted-foreground">Total 12 mois</div>
                  <div className="font-bold text-base text-emerald-600">{monthlyTotals.total12m.toLocaleString("fr-BE")} €</div>
                  {monthlyTotals.yoyPct !== null && (
                    <div className={`text-[10px] font-medium ${monthlyTotals.yoyDelta >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                      {monthlyTotals.yoyDelta >= 0 ? "▲" : "▼"} {monthlyTotals.yoyDelta >= 0 ? "+" : ""}{monthlyTotals.yoyPct}% vs N-1
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-muted-foreground">Moyenne / mois</div>
                  <div className="font-bold text-base">{monthlyTotals.avg.toLocaleString("fr-BE")} €</div>
                </div>
                <div className="text-right">
                  <div className="text-muted-foreground">YTD ({today.getFullYear()})</div>
                  <div className="font-bold text-base text-primary">{monthlyTotals.ytd.toLocaleString("fr-BE")} €</div>
                  {monthlyTotals.ytdYoyPct !== null && (
                    <div className={`text-[10px] font-medium ${monthlyTotals.ytdYoyDelta >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                      {monthlyTotals.ytdYoyDelta >= 0 ? "▲" : "▼"} {monthlyTotals.ytdYoyDelta >= 0 ? "+" : ""}{monthlyTotals.ytdYoyPct}% vs N-1
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ChartContainer config={revenueChartConfig} className="h-[240px] w-full">
              <BarChart data={monthlyRevenueData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="monthShort" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}€`} />
                <ChartTooltip content={<ChartTooltipContent formatter={(v) => `${(v as number).toLocaleString("fr-BE")} €`} />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="revenuePrevYear" name="N-1" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} opacity={0.55} />
                <Bar dataKey="revenue" name="N" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mois</TableHead>
                  <TableHead className="text-right">Réservations</TableHead>
                  <TableHead className="text-right">CA (N)</TableHead>
                  <TableHead className="text-right">CA (N-1)</TableHead>
                  <TableHead className="text-right">YoY</TableHead>
                  <TableHead className="text-right">Évolution m-1</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyRevenueData.map((row, i) => {
                  const prev = i > 0 ? monthlyRevenueData[i - 1] : null;
                  const delta = prev ? row.revenue - prev.revenue : 0;
                  const deltaPct = prev && prev.revenue > 0 ? Math.round((delta / prev.revenue) * 100) : null;
                  return (
                    <TableRow key={row.month}>
                      <TableCell className="font-medium capitalize">{row.month}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{row.bookings}</TableCell>
                      <TableCell className="text-right font-semibold">{row.revenue.toLocaleString("fr-BE")} €</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {row.revenuePrevYear > 0 ? `${row.revenuePrevYear.toLocaleString("fr-BE")} €` : <span className="text-xs">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.yoyPct !== null ? (
                          <span className={row.yoyDelta >= 0 ? "text-emerald-600" : "text-destructive"}>
                            {row.yoyDelta >= 0 ? "+" : ""}{row.yoyDelta.toLocaleString("fr-BE")} €
                            <span className="text-[10px] ml-1 opacity-75">
                              ({row.yoyDelta >= 0 ? "+" : ""}{row.yoyPct}%)
                            </span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {prev ? (
                          <span className={delta >= 0 ? "text-emerald-600" : "text-destructive"}>
                            {delta >= 0 ? "+" : ""}{delta.toLocaleString("fr-BE")} €
                            {deltaPct !== null && (
                              <span className="text-[10px] ml-1 opacity-75">
                                ({delta >= 0 ? "+" : ""}{deltaPct}%)
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="bg-muted/30 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">{monthlyRevenueData.reduce((s, r) => s + r.bookings, 0)}</TableCell>
                  <TableCell className="text-right text-emerald-600">{monthlyTotals.total12m.toLocaleString("fr-BE")} €</TableCell>
                  <TableCell className="text-right text-muted-foreground">{monthlyTotals.totalPrevYear.toLocaleString("fr-BE")} €</TableCell>
                  <TableCell className="text-right">
                    {monthlyTotals.yoyPct !== null ? (
                      <span className={monthlyTotals.yoyDelta >= 0 ? "text-emerald-600" : "text-destructive"}>
                        {monthlyTotals.yoyDelta >= 0 ? "+" : ""}{monthlyTotals.yoyDelta.toLocaleString("fr-BE")} €
                        <span className="text-[10px] ml-1 opacity-75">({monthlyTotals.yoyDelta >= 0 ? "+" : ""}{monthlyTotals.yoyPct}%)</span>
                      </span>
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  <TableCell className="text-right" />
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

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
                Taux d'occupation {selectedRoomId !== "all" && filteredRoomsForChart[0] ? `— ${filteredRoomsForChart[0].name}` : "global"}
              </CardTitle>
              <CardDescription className="text-xs">
                {selectedRoomId === "all" ? "Toutes salles confondues" : "Salle sélectionnée"}
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
        {filteredRoomsForChart.length > 0 && roomOccupancyData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                Occupation par salle
              </CardTitle>
              <CardDescription className="text-xs">
                {selectedRoomId === "all"
                  ? "Taux d'occupation (%) individuel par salle et par période"
                  : `Taux d'occupation de ${filteredRoomsForChart[0]?.name}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={roomOccupancyChartConfig} className="h-[260px] w-full">
                <BarChart data={roomOccupancyData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(v) => `${v}%`} />} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                  {filteredRoomsForChart.map((room, i) => (
                    <Bar
                      key={room.id}
                      dataKey={room.name}
                      fill={roomColors[i % roomColors.length]}
                      radius={[4, 4, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}

        {/* Revenue per room */}
        {filteredRoomsForChart.length > 0 && roomRevenueData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-600" />
                Revenus par salle
              </CardTitle>
              <CardDescription className="text-xs">
                {selectedRoomId === "all"
                  ? "Revenus (€) par salle et par période"
                  : `Revenus de ${filteredRoomsForChart[0]?.name}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={roomRevenueChartConfig} className="h-[260px] w-full">
                <BarChart data={roomRevenueData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v} €`} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(v) => `${v} €`} />} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                  {filteredRoomsForChart.map((room, i) => (
                    <Bar
                      key={room.id}
                      dataKey={room.name}
                      fill={roomColors[i % roomColors.length]}
                      radius={[4, 4, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}

        {filteredRoomsForChart.length > 0 && roomOccupancyData.length > 1 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Tendance d'occupation par salle
              </CardTitle>
              <CardDescription className="text-xs">
                Évolution du taux d'occupation (%) par période
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={roomOccupancyChartConfig} className="h-[280px] w-full">
                <LineChart data={roomOccupancyData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(v) => `${v}%`} />} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                  {filteredRoomsForChart.map((room, i) => (
                    <Line
                      key={room.id}
                      type="monotone"
                      dataKey={room.name}
                      stroke={roomColors[i % roomColors.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  ))}
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}

        {roomSummaryData && roomSummaryData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CalendarCheck className="h-4 w-4 text-primary" />
                Récapitulatif par salle
              </CardTitle>
              <CardDescription className="text-xs">
                Heures réservées vs heures disponibles sur la période sélectionnée
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Salle</TableHead>
                    <TableHead className="text-right">Heures disponibles</TableHead>
                    <TableHead className="text-right">Heures réservées</TableHead>
                    <TableHead className="text-right">Heures libres</TableHead>
                    <TableHead className="text-right">Taux d'occupation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roomSummaryData.map((row) => (
                    <TableRow key={row.name}>
                      <TableCell className="font-medium">
                        {row.name}
                        {row.isPrivatized && (
                          <Badge variant="outline" className="ml-2 text-[10px] py-0">🔒 Privatisé</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{row.totalHours}h</TableCell>
                      <TableCell className="text-right font-semibold text-primary">{row.bookedHours}h</TableCell>
                      <TableCell className="text-right text-muted-foreground">{row.totalHours - row.bookedHours}h</TableCell>
                      <TableCell className="text-right">
                        <span className={row.occupancy >= 70 ? "text-emerald-600 font-semibold" : row.occupancy >= 40 ? "text-orange-600 font-semibold" : "text-destructive font-semibold"}>
                          {row.occupancy}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {roomSummaryData.length > 1 && (
                    <TableRow className="bg-muted/30 font-semibold">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">{roomSummaryData.reduce((s, r) => s + r.totalHours, 0)}h</TableCell>
                      <TableCell className="text-right text-primary">{roomSummaryData.reduce((s, r) => s + r.bookedHours, 0)}h</TableCell>
                      <TableCell className="text-right text-muted-foreground">{roomSummaryData.reduce((s, r) => s + (r.totalHours - r.bookedHours), 0)}h</TableCell>
                      <TableCell className="text-right">
                        {(() => {
                          const totH = roomSummaryData.reduce((s, r) => s + r.totalHours, 0);
                          const totB = roomSummaryData.reduce((s, r) => s + r.bookedHours, 0);
                          const pct = totH > 0 ? Math.round((totB / totH) * 100) : 0;
                          return <span className={pct >= 70 ? "text-emerald-600" : pct >= 40 ? "text-orange-600" : "text-destructive"}>{pct}%</span>;
                        })()}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminAnalytics;
