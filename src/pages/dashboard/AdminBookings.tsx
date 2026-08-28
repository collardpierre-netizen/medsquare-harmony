import { useEffect, useState, useMemo } from "react";
import { CalendarCheck, CheckCircle, XCircle, Plus, Loader2, Repeat, Users, BarChart3, List, Filter, Pencil, CalendarDays, ChevronLeft, ChevronRight, Trash2, CheckSquare, Square, Lock, Download, FileText, AlertTriangle, CalendarClock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import EditBookingDialog from "@/components/dashboard/bookings/EditBookingDialog";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { format, addWeeks, addDays, isAfter, isBefore, parseISO, startOfWeek, isSameDay, startOfDay, getDay, startOfMonth, endOfMonth, eachMonthOfInterval } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { isRoomBlockedOnDay, isRoomCurrentlyPrivatized, isPrivatizationScheduled, formatPrivatizationDate } from "@/lib/roomPrivatization";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getRoomDayHours, getRoomOpenHoursCount } from "@/lib/roomOpeningHours";
import { computeRoomStats, computePractitionerBilling, bookingBilledAmount } from "@/lib/roomBilling";

import WeeklyOverview from "@/components/dashboard/bookings/WeeklyOverview";
import WeeklyAllRoomsOverview from "@/components/dashboard/bookings/WeeklyAllRoomsOverview";
import MonthlyBillingExport from "@/components/dashboard/bookings/MonthlyBillingExport";
import { Progress } from "@/components/ui/progress";

/** Format court en euros (HTVA) */
const eur0 = (v: number) =>
  new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

const TIME_OPTIONS = Array.from({ length: 24 }, (_, h) =>
  [0, 30].map((m) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`)
).flat();

type ViewMode = "list" | "practitioner" | "occupancy" | "planning";

const AdminBookings = () => {
  const { toast } = useToast();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "confirmed" | "cancelled">("all");
  const [packages, setPackages] = useState<any[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]);

  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editBooking, setEditBooking] = useState<any>(null);

  // Filters
  const [filterRoom, setFilterRoom] = useState<string>("__all__");
  const [filterPractitioner, setFilterPractitioner] = useState<string>("__all__");
  const [filterDateFrom, setFilterDateFrom] = useState<Date | undefined>(() => startOfMonth(new Date()));
  const [filterDateTo, setFilterDateTo] = useState<Date | undefined>(() => endOfMonth(new Date()));

  // Planning view state
  const [planningWeekStart, setPlanningWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [planningRoom, setPlanningRoom] = useState<string>("");

  // Practitioner view toggles
  const [hideCancelled, setHideCancelled] = useState(false);
  const [hideNotes, setHideNotes] = useState(false);
  const [collapsedPractitioners, setCollapsedPractitioners] = useState<Set<string>>(new Set());
  const [deleteBookingId, setDeleteBookingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // New booking dialog state
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [practitioners, setPractitioners] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [allRooms, setAllRooms] = useState<any[]>([]);
  const [practitionerActivities, setPractitionerActivities] = useState<any[]>([]);

  const [newBooking, setNewBooking] = useState({
    practitioner_id: "",
    room_id: "",
    date: "",
    start_time: "08:00",
    end_time: "09:00",
    notes: "",
    status: "confirmed",
    activity_id: "",
  });

  // Recurrence
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date | undefined>(undefined);
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [endDateOpen, setEndDateOpen] = useState(false);

  const DAYS_OF_WEEK = [
    { key: 1, label: "Lun" },
    { key: 2, label: "Mar" },
    { key: 3, label: "Mer" },
    { key: 4, label: "Jeu" },
    { key: 5, label: "Ven" },
    { key: 6, label: "Sam" },
    { key: 0, label: "Dim" },
  ];

  const fetchBookings = async () => {
    setLoading(true);

    const pageSize = 1000;
    const allBookings: any[] = [];
    let from = 0;

    while (true) {
      let query = supabase
        .from("bookings")
        .select("*, profiles(first_name, last_name), rooms(name), activities(title)")
        .order("start_time", { ascending: false })
        .order("id", { ascending: false })
        .range(from, from + pageSize - 1);

      if (filter !== "all") {
        query = query.eq("status", filter);
      }

      const { data, error } = await query;

      if (error) {
        toast({
          title: "Erreur de chargement",
          description: error.message,
          variant: "destructive",
        });
        break;
      }

      const batch = data || [];
      allBookings.push(...batch);

      if (batch.length < pageSize) {
        break;
      }

      from += pageSize;
    }

    setBookings(allBookings);
    setLoading(false);
  };

  const fetchResources = async () => {
    const [{ data: profs }, { data: roomsData }, { data: allRoomsData }, { data: pkgData }, { data: discountData }] = await Promise.all([
      supabase.from("profiles").select("id, first_name, last_name").order("last_name"),
      supabase.from("rooms").select("id, name").eq("is_available", true).order("name"),
      supabase.from("rooms").select("id, name, is_available, privatized_from, privatized_until, hourly_rate, privatization_monthly_fee, opening_hours").order("name"),
      supabase.from("practitioner_room_packages").select("practitioner_id, room_id, monthly_fee").eq("is_active", true),
      supabase
        .from("practitioner_discounts")
        .select("practitioner_id, room_id, discount_type, discount_value, label, start_date, end_date, is_active")
        .eq("is_active", true),
    ]);
    setPractitioners(profs || []);
    setPackages(pkgData || []);
    setDiscounts(discountData || []);
    setRooms(roomsData || []);
    setAllRooms(allRoomsData || []);

    if (roomsData && roomsData.length > 0 && !planningRoom) {
      setPlanningRoom(roomsData[0].id);
    }
  };

  const fetchPractitionerActivities = async (practitionerId: string) => {
    if (!practitionerId) {
      setPractitionerActivities([]);
      return;
    }
    const { data } = await supabase
      .from("activities")
      .select("id, title")
      .eq("practitioner_id", practitionerId)
      .eq("is_active", true)
      .order("title");
    setPractitionerActivities(data || []);
  };

  useEffect(() => {
    fetchBookings();
  }, [filter]);

  useEffect(() => {
    fetchResources();
  }, []);

  // Filtered bookings
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (filterRoom !== "__all__" && b.room_id !== filterRoom) return false;
      if (filterPractitioner !== "__all__" && b.practitioner_id !== filterPractitioner) return false;
      if (filterDateFrom) {
        const bStart = new Date(b.start_time);
        if (bStart < startOfDay(filterDateFrom)) return false;
      }
      if (filterDateTo) {
        const bStart = new Date(b.start_time);
        // Include the entire "to" day
        const endOfTo = new Date(filterDateTo);
        endOfTo.setHours(23, 59, 59, 999);
        if (bStart > endOfTo) return false;
      }
      return true;
    });
  }, [bookings, filterRoom, filterPractitioner, filterDateFrom, filterDateTo]);

  // Grouped by practitioner
  const groupedByPractitioner = useMemo(() => {
    const groups: Record<string, { name: string; bookings: any[] }> = {};
    const source = hideCancelled ? filteredBookings.filter(b => b.status !== "cancelled") : filteredBookings;
    source.forEach((b) => {
      const pid = b.practitioner_id;
      if (!groups[pid]) {
        groups[pid] = {
          name: `${b.profiles?.first_name || ""} ${b.profiles?.last_name || ""}`.trim() || "Inconnu",
          bookings: [],
        };
      }
      groups[pid].bookings.push(b);
    });
    return Object.entries(groups).sort(([, a], [, b]) => a.name.localeCompare(b.name));
  }, [filteredBookings, hideCancelled]);

  // Collapse all practitioner groups by default whenever the list of practitioners changes
  useEffect(() => {
    setCollapsedPractitioners(new Set(groupedByPractitioner.map(([pid]) => pid)));
  }, [groupedByPractitioner.map(([pid]) => pid).join(",")]);

  const toggleCollapsed = (pid: string) => {
    setCollapsedPractitioners(prev => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid); else next.add(pid);
      return next;
    });
  };

  // Occupancy stats per room — uses date filter if set, otherwise current week
  const occupancyData = useMemo(() => {
    const BUFFER_MINUTES = 15; // 15 min avant et après chaque réservation

    let rangeStart: Date;
    let rangeEnd: Date;
    let label: string;

    if (filterDateFrom && filterDateTo) {
      rangeStart = startOfDay(filterDateFrom);
      rangeEnd = startOfDay(filterDateTo);
      label = `${format(filterDateFrom, "d MMM", { locale: fr })} — ${format(filterDateTo, "d MMM yyyy", { locale: fr })}`;
    } else if (filterDateFrom) {
      rangeStart = startOfDay(filterDateFrom);
      rangeEnd = addDays(rangeStart, 6);
      label = `à partir du ${format(filterDateFrom, "d MMM yyyy", { locale: fr })}`;
    } else {
      const now = new Date();
      rangeStart = startOfWeek(now, { weekStartsOn: 1 });
      rangeEnd = addDays(rangeStart, 6);
      label = "semaine en cours";
    }

    const days: Date[] = [];
    let cursor = rangeStart;
    while (cursor <= rangeEnd) {
      days.push(cursor);
      cursor = addDays(cursor, 1);
    }

    // Mois couverts par la période
    const monthsInRange = eachMonthOfInterval({ start: startOfMonth(rangeStart), end: startOfMonth(rangeEnd) });

    // Calcul pur (testé) : heures ouvrables, occupation, CA forfait/horaire HTVA
    const baseStats = computeRoomStats({
      rooms: allRooms as any,
      bookings: bookings as any,
      packages: packages as any,
      discounts: discounts as any,
      days,
      months: monthsInRange,
    });

    const roomList = baseStats.map((s) => {
      const room = allRooms.find((r) => r.id === s.id) as any;
      const isPrivatised = s.totalHours > 0 && s.privatizedHours === s.totalHours;
      const scheduled = room && isPrivatizationScheduled(room)
        ? { from: room.privatized_from as string, until: (room.privatized_until as string) || null }
        : null;
      return {
        ...s,
        isPrivatised,
        scheduledPrivatization: scheduled,
        scheduledLabel: scheduled
          ? scheduled.until
            ? `Privatisation programmée du ${formatPrivatizationDate(scheduled.from)} au ${formatPrivatizationDate(scheduled.until)}`
            : `Privatisation programmée dès le ${formatPrivatizationDate(scheduled.from)}`
          : null,
      };
    });

    // Moyenne globale
    const globalAvg = roomList.length > 0
      ? Math.round(roomList.reduce((sum, r) => sum + r.occupancyPct, 0) / roomList.length)
      : 0;
    const globalConfirmedAvg = roomList.length > 0
      ? Math.round(roomList.reduce((sum, r) => sum + r.confirmedOccupancyPct, 0) / roomList.length)
      : 0;

    const totalRevenue = roomList.reduce((sum, r) => sum + r.revenue, 0);
    const totalFlatRevenue = roomList.reduce((sum, r) => sum + r.flatRevenue, 0);
    const totalHourlyRevenue = roomList.reduce((sum, r) => sum + r.hourlyRevenue, 0);
    const totalPendingRevenue = roomList.reduce((sum, r) => sum + r.pendingHourlyRevenue, 0);
    const totalDiscount = roomList.reduce((sum, r) => sum + r.discountTotal, 0);
    const totalPendingHours = roomList.reduce((sum, r) => sum + r.pendingHours, 0);
    const totalCoveredHourly = roomList.reduce((sum, r) => sum + r.coveredHourlyValue, 0);
    const totalAvailableHours = roomList.reduce((sum, r) => sum + r.availableHours, 0);

    return {
      label,
      rooms: roomList,
      globalAvg,
      globalConfirmedAvg,
      totalRevenue,
      totalFlatRevenue,
      totalHourlyRevenue,
      totalPendingRevenue,
      totalPendingHours,
      totalDiscount,
      totalCoveredHourly,
      totalAvailableHours,
    };
  }, [allRooms, bookings, filterDateFrom, filterDateTo, packages, discounts]);



  // Conflict detection: overlapping bookings in same room by DIFFERENT practitioners
  const conflicts = useMemo(() => {
    const active = filteredBookings.filter((b) => b.status !== "cancelled");
    const byRoom: Record<string, any[]> = {};
    active.forEach((b) => {
      if (!byRoom[b.room_id]) byRoom[b.room_id] = [];
      byRoom[b.room_id].push(b);
    });

    const pairs: { a: any; b: any; roomName: string }[] = [];
    Object.values(byRoom).forEach((list) => {
      const sorted = [...list].sort(
        (x, y) => new Date(x.start_time).getTime() - new Date(y.start_time).getTime()
      );
      for (let i = 0; i < sorted.length; i++) {
        const a = sorted[i];
        const aStart = new Date(a.start_time).getTime();
        const aEnd = new Date(a.end_time).getTime();
        for (let j = i + 1; j < sorted.length; j++) {
          const b = sorted[j];
          const bStart = new Date(b.start_time).getTime();
          if (bStart >= aEnd) break;
          const bEnd = new Date(b.end_time).getTime();
          if (aStart < bEnd && bStart < aEnd && a.practitioner_id !== b.practitioner_id) {
            pairs.push({ a, b, roomName: a.rooms?.name || "Salle" });
          }
        }
      }
    });
    return pairs;
  }, [filteredBookings]);

  const conflictBookingIds = useMemo(() => {
    const s = new Set<string>();
    conflicts.forEach((c) => { s.add(c.a.id); s.add(c.b.id); });
    return s;
  }, [conflicts]);

  const handlePractitionerChange = (practitionerId: string) => {
    setNewBooking((b) => ({ ...b, practitioner_id: practitionerId, activity_id: "" }));
    fetchPractitionerActivities(practitionerId);
  };

  const resetDialog = () => {
    setNewBooking({
      practitioner_id: "",
      room_id: "",
      date: "",
      start_time: "08:00",
      end_time: "09:00",
      notes: "",
      status: "confirmed",
      activity_id: "",
    });
    setIsRecurring(false);
    setRecurrenceEndDate(undefined);
    setRecurrenceDays([]);
    setPractitionerActivities([]);
  };

  const computeBookingDates = (startDateStr: string): Date[] => {
    const start = parseISO(startDateStr);
    if (!isRecurring || !recurrenceEndDate) return [start];
    
    const selectedDays = recurrenceDays.length > 0 ? recurrenceDays : [getDay(start)];
    const dates: Date[] = [];
    let current = start;
    
    while (!isAfter(current, recurrenceEndDate)) {
      // For each day in the week starting from current
      for (const dayNum of selectedDays) {
        const currentDayOfWeek = getDay(current);
        let dayOffset = dayNum - currentDayOfWeek;
        if (dayOffset < 0) dayOffset += 7;
        const targetDate = addDays(current, dayOffset);
        if (!isBefore(targetDate, start) && !isAfter(targetDate, recurrenceEndDate)) {
          // Avoid duplicates
          if (!dates.some(d => isSameDay(d, targetDate))) {
            dates.push(targetDate);
          }
        }
      }
      current = addWeeks(current, 1);
    }
    
    return dates.sort((a, b) => a.getTime() - b.getTime());
  };

  const handleCreateBooking = async () => {
    const { practitioner_id, room_id, date, start_time, end_time, notes, status, activity_id } = newBooking;
    if (!practitioner_id || !room_id || !date || !start_time || !end_time) {
      toast({ title: "Champs requis manquants", description: "Praticien, salle, date et horaires sont obligatoires.", variant: "destructive" });
      return;
    }
    const testStart = new Date(`${date}T${start_time}:00`);
    const testEnd = new Date(`${date}T${end_time}:00`);
    if (testEnd <= testStart) {
      toast({ title: "Horaire invalide", description: "L'heure de fin doit être après l'heure de début.", variant: "destructive" });
      return;
    }
    if (isRecurring && !recurrenceEndDate) {
      toast({ title: "Date de fin requise", description: "Veuillez choisir une date de fin pour la récurrence.", variant: "destructive" });
      return;
    }
    const dates = computeBookingDates(date);
    setCreating(true);
    const groupId = dates.length > 1 ? crypto.randomUUID() : null;
    const rows = dates.map((d) => {
      const dateStr = format(d, "yyyy-MM-dd");
      return {
        practitioner_id,
        room_id,
        start_time: new Date(`${dateStr}T${start_time}:00`).toISOString(),
        end_time: new Date(`${dateStr}T${end_time}:00`).toISOString(),
        notes: notes || null,
        status,
        ...(activity_id ? { activity_id } : {}),
        ...(groupId ? { recurrence_group_id: groupId } : {}),
      };
    });
    const { error } = await supabase.from("bookings").insert(rows);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: dates.length > 1 ? `${dates.length} réservations créées !` : "Réservation créée !" });
      resetDialog();
      setOpen(false);
      fetchBookings();
    }
    setCreating(false);
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
    if (!error) {
      toast({ title: status === "confirmed" ? "Réservation confirmée" : "Réservation annulée" });
      fetchBookings();
      try {
        const { data: result } = await supabase.functions.invoke("notify-booking-status", {
          body: { booking_id: id, new_status: status },
        });
        if (result?.sent) console.log("Email notification sent");
      } catch (err) {
        console.error("Error sending email notification:", err);
      }
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return <Badge className="bg-primary/10 text-primary border-primary/20">Confirmée</Badge>;
      case "pending":
        return <Badge variant="secondary" className="opacity-80">En attente</Badge>;
      case "cancelled":
        return <Badge variant="secondary" className="bg-destructive/10 text-destructive border-destructive/20">Annulée</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const previewDates = newBooking.date && isRecurring && recurrenceEndDate
    ? computeBookingDates(newBooking.date)
    : [];

  const handleEditBooking = (booking: any) => {
    setEditBooking(booking);
    setEditOpen(true);
  };

  const handleDeleteBooking = async (id: string) => {
    const { error } = await supabase.from("bookings").delete().eq("id", id);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Réservation supprimée" });
      fetchBookings();
    }
    setDeleteBookingId(null);
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredBookings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredBookings.map((b) => b.id)));
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from("bookings").delete().in("id", ids);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${ids.length} réservation${ids.length > 1 ? "s" : ""} supprimée${ids.length > 1 ? "s" : ""}` });
      setSelectedIds(new Set());
      fetchBookings();
    }
    setBulkDeleteOpen(false);
  };

  const exportOccupancyCSV = () => {
    const header = ["Salle", "Statut", "Réservations", "Heures réservées", "Heures disponibles", "Taux d'occupation (%)"];
    const rows = occupancyData.rooms.map((r) => [
      r.name,
      r.isPrivatised ? "Privatisé" : "Actif",
      r.isPrivatised ? "-" : String(r.bookingCount),
      r.isPrivatised ? "-" : r.bookedHours.toFixed(1).replace(".", ","),
      r.isPrivatised ? "-" : String(r.totalHours),
      String(r.occupancyPct),
    ]);
    rows.push(["Moyenne globale", "", "", "", "", String(occupancyData.globalAvg)]);

    const csv = [header, ...rows]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `occupation-salles-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Export CSV téléchargé" });
  };

  const exportOccupancyPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Taux d'occupation par salle", pageWidth / 2, y, { align: "center" });
    y += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Période : ${occupancyData.label}`, pageWidth / 2, y, { align: "center" });
    y += 5;
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text("Horaires : 08h–22h (lun–ven), 09h–21h (sam–dim) · 15 min de battement avant/après", pageWidth / 2, y, { align: "center" });
    doc.setTextColor(0);
    y += 10;

    // Header row
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    const cols = [
      { label: "Salle", x: 14, w: 70 },
      { label: "Réservations", x: 84, w: 30 },
      { label: "Heures", x: 114, w: 35 },
      { label: "Taux", x: 149, w: 40 },
    ];
    cols.forEach((c) => doc.text(c.label, c.x, y));
    y += 2;
    doc.setLineWidth(0.3);
    doc.line(14, y, pageWidth - 14, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    occupancyData.rooms.forEach((r) => {
      doc.text(r.name + (r.isPrivatised ? " (Privatisé)" : ""), cols[0].x, y);
      doc.text(r.isPrivatised ? "-" : String(r.bookingCount), cols[1].x, y);
      doc.text(r.isPrivatised ? "-" : `${r.bookedHours.toFixed(1)}h / ${r.totalHours}h`, cols[2].x, y);
      doc.text(`${r.occupancyPct}%`, cols[3].x, y);
      y += 6;
      if (y > 270) { doc.addPage(); y = 20; }
    });

    y += 4;
    doc.setLineWidth(0.5);
    doc.line(14, y, pageWidth - 14, y);
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.text("Taux d'occupation moyen global", cols[0].x, y);
    doc.text(`${occupancyData.globalAvg}%`, cols[3].x, y);

    doc.save(`occupation-salles-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    toast({ title: "Export PDF téléchargé" });
  };

  const bookingHours = (b: any) =>
    (new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 3600000;

  const formatHours = (h: number) =>
    `${Number.isInteger(h) ? h : h.toFixed(1).replace(".", ",")} h`;

  /** Une réservation est-elle couverte par un forfait locataire (praticien + salle, mois de la résa) ? */
  const isBookingCoveredByPackage = (b: any) =>
    packages.some((p) => p.practitioner_id === b.practitioner_id && p.room_id === b.room_id);

  /** Montant HTVA d'une réservation, remise (ponctuelle ou contractuelle) déduite. */
  const bookingAmount = (b: any) => {
    const room = allRooms.find((r) => r.id === b.room_id);
    return bookingBilledAmount(b as any, Number(room?.hourly_rate || 0), discounts as any);
  };

  const bookingRevenue = (b: any) => {
    const room = allRooms.find((r) => r.id === b.room_id);
    if (!room) return 0;
    // Couvert par un forfait mensuel → pas de facturation horaire en sus
    if (isBookingCoveredByPackage(b)) return 0;
    return bookingAmount(b).net;
  };

  /**
   * Total facturable HTVA d'un praticien : forfaits mensuels (le forfait prend le lead
   * sur le tarif horaire) + réservations horaires non couvertes par un forfait,
   * remises déduites. Les pré-réservations sont isolées.
   */
  const practitionerBilling = (list: any[]) =>
    computePractitionerBilling({
      bookings: list as any,
      rooms: allRooms as any,
      packages: packages as any,
      discounts: discounts as any,
    });




  const formatMoney = (amount: number) =>
    new Intl.NumberFormat("fr-BE", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(amount);


  const BookingRow = ({ booking }: { booking: any }) => {
    const isSelected = selectedIds.has(booking.id);
    const isConflict = conflictBookingIds.has(booking.id);
    return (
      <div
        className={cn(
          "flex items-center justify-between p-4 rounded-lg border transition-colors cursor-pointer",
          isConflict
            ? "border-destructive/50 bg-destructive/5 hover:bg-destructive/10"
            : isSelected
            ? "border-primary/40 bg-primary/5"
            : "border-border hover:bg-accent/50"
        )}
        onClick={() => handleEditBooking(booking)}
      >
        <div className="flex items-center gap-3 flex-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => toggleSelected(booking.id)}
            className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
          >
            {isSelected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
          </button>
          <div className="flex-1 cursor-pointer" onClick={() => handleEditBooking(booking)}>
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <p className="font-medium text-sm">
                {booking.profiles?.first_name} {booking.profiles?.last_name}
              </p>
              {isConflict && (
                <Badge variant="outline" className="text-xs gap-1 border-destructive/40 text-destructive bg-destructive/10">
                  <AlertTriangle className="h-3 w-3" /> Conflit
                </Badge>
              )}
              {booking.notes?.includes("[Privatisé]") && (
                <Badge variant="outline" className="text-xs gap-1">
                  <Lock className="h-3 w-3" /> Privatisé
                </Badge>
              )}
              {statusBadge(booking.status)}
              {booking.activities?.title && (
                <Badge variant="outline" className="text-xs">{booking.activities.title}</Badge>
              )}
              <Pencil className="h-3 w-3 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">
              {booking.rooms?.name} •{" "}
              {format(new Date(booking.start_time), "EEEE d MMMM • HH:mm", { locale: fr })}
              {" — "}
              {format(new Date(booking.end_time), "HH:mm")}
              {" • "}
              <span className="font-medium text-foreground">{formatHours(bookingHours(booking))}</span>
            </p>

            {booking.notes && !hideNotes && (
              <p className="text-xs text-muted-foreground mt-1 italic">"{booking.notes}"</p>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 ml-4">
          {isBookingCoveredByPackage(booking) ? (
            <>
              <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                Inclus au forfait
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                {booking.rooms?.hourly_rate ? `valeur horaire ${formatMoney((booking.rooms.hourly_rate || 0) * bookingHours(booking))} HTVA — non facturée` : ""}
              </span>
            </>
          ) : (
            (() => {
              const amount = bookingAmount(booking);
              const isPending = booking.status === "pending";
              return (
                <>
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      isPending ? "text-amber-600" : "text-emerald-600"
                    )}
                  >
                    {formatMoney(amount.net)} HTVA
                  </span>
                  {amount.discount > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      <span className="line-through">{formatMoney(amount.gross)}</span>{" "}
                      — remise {formatMoney(amount.discount)}
                      {amount.label ? ` (${amount.label})` : ""}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {isPending ? "potentiel — pré-réservation · " : ""}
                    {booking.rooms?.hourly_rate ? `${booking.rooms.hourly_rate} €/h` : ""}
                  </span>
                </>
              );
            })()
          )}
        </div>

        <div className="flex items-center gap-2 ml-4" onClick={(e) => e.stopPropagation()}>
          {booking.status === "pending" && (
            <>
              <Button size="sm" onClick={() => updateStatus(booking.id, "confirmed")}>
                <CheckCircle className="h-4 w-4 mr-1" />
                Confirmer
              </Button>
              <Button variant="outline" size="sm" onClick={() => updateStatus(booking.id, "cancelled")}>
                <XCircle className="h-4 w-4 mr-1" />
                Refuser
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => setDeleteBookingId(booking.id)}
            title="Supprimer la réservation"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-display text-xl font-bold">Toutes les réservations</h2>
            <p className="text-muted-foreground text-sm mt-0.5">
              Validez ou refusez les demandes de réservation.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <MonthlyBillingExport />

            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetDialog(); }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle réservation
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Créer une réservation</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                {/* Practitioner */}
                <div className="space-y-2">
                  <Label>Praticien *</Label>
                  <Select value={newBooking.practitioner_id} onValueChange={handlePractitionerChange}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner un praticien…" /></SelectTrigger>
                    <SelectContent>
                      {practitioners.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {practitionerActivities.length > 0 && (
                  <div className="space-y-2">
                    <Label>Lier à une activité <span className="text-muted-foreground font-normal">(facultatif)</span></Label>
                    <Select
                      value={newBooking.activity_id}
                      onValueChange={(v) => setNewBooking((b) => ({ ...b, activity_id: v === "__none__" ? "" : v }))}
                    >
                      <SelectTrigger><SelectValue placeholder="Aucune activité liée" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Aucune</SelectItem>
                        {practitionerActivities.map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Espace / Salle *</Label>
                  <Select value={newBooking.room_id} onValueChange={(v) => setNewBooking((b) => ({ ...b, room_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner une salle…" /></SelectTrigger>
                    <SelectContent>
                      {rooms.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Date de début *</Label>
                  <Input type="date" value={newBooking.date} onChange={(e) => setNewBooking((b) => ({ ...b, date: e.target.value }))} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Heure de début *</Label>
                    <Select value={newBooking.start_time} onValueChange={(v) => setNewBooking((b) => ({ ...b, start_time: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIME_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Heure de fin *</Label>
                    <Select value={newBooking.end_time} onValueChange={(v) => setNewBooking((b) => ({ ...b, end_time: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIME_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="rounded-xl border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Repeat className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <Label className="text-sm">Récurrence hebdomadaire</Label>
                        <p className="text-xs text-muted-foreground">Répéter chaque semaine jusqu'à une date</p>
                      </div>
                    </div>
                    <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
                  </div>
                  {isRecurring && (
                    <div className="space-y-3 pt-1">
                      {/* Day pills */}
                      <div>
                        <Label className="text-xs mb-1.5 block">Jours de la semaine :</Label>
                        <div className="flex gap-1.5 flex-wrap">
                          {DAYS_OF_WEEK.map((d) => (
                            <button
                              key={d.key}
                              type="button"
                              onClick={() => {
                                setRecurrenceDays((prev) =>
                                  prev.includes(d.key)
                                    ? prev.filter((x) => x !== d.key)
                                    : [...prev, d.key]
                                );
                              }}
                              className={cn(
                                "px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors",
                                recurrenceDays.includes(d.key)
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-background text-muted-foreground border-border hover:bg-accent"
                              )}
                            >
                              {d.label}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setRecurrenceDays([1, 2, 3, 4, 5])}
                            className="px-2.5 py-1 rounded-full text-[11px] font-medium border border-border text-muted-foreground hover:bg-accent transition-colors"
                          >
                            Lun-Ven
                          </button>
                        </div>
                      </div>
                      <Label className="text-xs">Date de fin de récurrence *</Label>
                      <div className="flex gap-2">
                        <Input
                          type="date"
                          value={recurrenceEndDate ? format(recurrenceEndDate, "yyyy-MM-dd") : ""}
                          min={newBooking.date || undefined}
                          onChange={(e) => {
                            const v = e.target.value;
                            setRecurrenceEndDate(v ? parseISO(v) : undefined);
                          }}
                          className="flex-1"
                          placeholder="JJ/MM/AAAA"
                        />
                        <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="icon" type="button" aria-label="Ouvrir le calendrier">
                              <CalendarIcon className="h-4 w-4" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[320px] p-0" align="end" sideOffset={4}>
                            <div className="w-[320px]">
                              <Calendar
                                mode="single"
                                selected={recurrenceEndDate}
                                onSelect={(d) => { setRecurrenceEndDate(d); setEndDateOpen(false); }}
                                disabled={(d) => newBooking.date ? isBefore(d, parseISO(newBooking.date)) : false}
                                defaultMonth={recurrenceEndDate || (newBooking.date ? parseISO(newBooking.date) : new Date())}
                                initialFocus
                                className="p-3 pointer-events-auto mx-auto"
                              />
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                      {recurrenceEndDate && (
                        <p className="text-xs text-muted-foreground">
                          Sélectionné : {format(recurrenceEndDate, "EEEE d MMMM yyyy", { locale: fr })}
                        </p>
                      )}
                      {previewDates.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          → {previewDates.length} réservation{previewDates.length > 1 ? "s" : ""} seront créées
                          {previewDates.length <= 5 && (
                            <> ({previewDates.map((d) => format(d, "d MMM", { locale: fr })).join(", ")})</>
                          )}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Privatiser button */}
                {newBooking.room_id && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-primary/30 text-primary hover:bg-primary/5"
                    onClick={() => {
                      const d = newBooking.date ? parseISO(newBooking.date) : new Date();
                      const selectedRoom = allRooms.find((r) => r.id === newBooking.room_id);
                      const { start, end } = getRoomDayHours((selectedRoom as any)?.opening_hours, d);
                      setNewBooking((b) => ({
                        ...b,
                        start_time: `${String(start).padStart(2, "0")}:00`,
                        end_time: `${String(end).padStart(2, "0")}:00`,
                        notes: b.notes.includes("[Privatisé]") ? b.notes : `[Privatisé] ${b.notes}`.trim(),
                      }));
                      // Auto-enable recurrence with all 7 days
                      setIsRecurring(true);
                      setRecurrenceDays([0, 1, 2, 3, 4, 5, 6]);
                      toast({ title: "🔒 Local privatisé", description: `Horaires ${start}h–${end}h, 7j/7. Choisissez la date de fin de récurrence.` });
                    }}
                  >
                    <Lock className="h-4 w-4 mr-2" />
                    🔒 Privatiser le local (7j/7)
                  </Button>
                )}

                <div className="space-y-2">
                  <Label>Statut initial</Label>
                  <Select value={newBooking.status} onValueChange={(v) => setNewBooking((b) => ({ ...b, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="confirmed">Confirmée directement</SelectItem>
                      <SelectItem value="pending">En attente de validation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Notes (facultatif)</Label>
                  <Textarea placeholder="Informations complémentaires…" rows={2} value={newBooking.notes} onChange={(e) => setNewBooking((b) => ({ ...b, notes: e.target.value }))} />
                </div>

                <Button onClick={handleCreateBooking} disabled={creating} className="w-full">
                  {creating
                    ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Création en cours…</>
                    : <><Plus className="h-4 w-4 mr-2" />{previewDates.length > 1 ? `Créer ${previewDates.length} réservations` : "Créer la réservation"}</>}
                </Button>
              </div>
            </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Status filters + View mode toggle */}
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex gap-2 flex-wrap">
            {(["all", "pending", "confirmed", "cancelled"] as const).map((f) => (
              <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)}>
                {f === "all" ? "Toutes" : f === "pending" ? "En attente" : f === "confirmed" ? "Confirmées" : "Annulées"}
              </Button>
            ))}
          </div>
          <div className="flex items-center bg-muted rounded-lg p-1">
            <button
              onClick={() => setViewMode("list")}
              className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all", viewMode === "list" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              <List className="h-3.5 w-3.5" />
              Liste
            </button>
            <button
              onClick={() => setViewMode("practitioner")}
              className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all", viewMode === "practitioner" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              <Users className="h-3.5 w-3.5" />
              Par praticien
            </button>
            <button
              onClick={() => setViewMode("occupancy")}
              className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all", viewMode === "occupancy" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Occupation
            </button>
            <button
              onClick={() => setViewMode("planning")}
              className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all", viewMode === "planning" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Planning
            </button>
          </div>
        </div>

        {/* Room / Practitioner filters */}
        <div className="flex gap-3 flex-wrap items-end">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Filtres :</span>
          </div>
          <div className="min-w-[180px]">
            <Select value={filterRoom} onValueChange={setFilterRoom}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Toutes les salles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Toutes les salles</SelectItem>
                {rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[200px]">
            <Select value={filterPractitioner} onValueChange={setFilterPractitioner}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Tous les praticiens" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tous les praticiens</SelectItem>
                {practitioners.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date range filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("h-9 text-sm gap-1.5", filterDateFrom && "border-primary/40")}>
                <CalendarIcon className="h-3.5 w-3.5" />
                {filterDateFrom ? format(filterDateFrom, "dd/MM/yy", { locale: fr }) : "Du"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filterDateFrom}
                onSelect={setFilterDateFrom}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <span className="text-xs text-muted-foreground">→</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("h-9 text-sm gap-1.5", filterDateTo && "border-primary/40")}>
                <CalendarIcon className="h-3.5 w-3.5" />
                {filterDateTo ? format(filterDateTo, "dd/MM/yy", { locale: fr }) : "Au"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filterDateTo}
                onSelect={setFilterDateTo}
                disabled={(date) => filterDateFrom ? date < filterDateFrom : false}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          {(filterRoom !== "__all__" || filterPractitioner !== "__all__" || filterDateFrom || filterDateTo) && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setFilterRoom("__all__"); setFilterPractitioner("__all__"); setFilterDateFrom(undefined); setFilterDateTo(undefined); }}>
              Réinitialiser
            </Button>
          )}
        </div>

        {/* Conflict warnings */}
        {conflicts.length > 0 && (
          <Alert variant="destructive" className="border-destructive/40">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="font-display">
              {conflicts.length} conflit{conflicts.length > 1 ? "s" : ""} de réservation détecté{conflicts.length > 1 ? "s" : ""}
            </AlertTitle>
            <AlertDescription>
              <p className="text-xs mb-2 opacity-90">
                Plusieurs praticiens occupent la même salle au même moment :
              </p>
              <ul className="space-y-1 text-xs max-h-40 overflow-y-auto">
                {conflicts.slice(0, 8).map((c, i) => {
                  const aName = `${c.a.profiles?.first_name || ""} ${c.a.profiles?.last_name || ""}`.trim() || "Inconnu";
                  const bName = `${c.b.profiles?.first_name || ""} ${c.b.profiles?.last_name || ""}`.trim() || "Inconnu";
                  const day = format(new Date(c.a.start_time), "EEE d MMM", { locale: fr });
                  const aTime = `${format(new Date(c.a.start_time), "HH:mm")}–${format(new Date(c.a.end_time), "HH:mm")}`;
                  const bTime = `${format(new Date(c.b.start_time), "HH:mm")}–${format(new Date(c.b.end_time), "HH:mm")}`;
                  return (
                    <li key={i} className="flex items-start gap-2">
                      <span className="font-medium shrink-0">🏥 {c.roomName} · {day}</span>
                      <span className="opacity-90">
                        <button onClick={() => handleEditBooking(c.a)} className="underline hover:no-underline">
                          {aName} ({aTime})
                        </button>
                        {" ⚠ "}
                        <button onClick={() => handleEditBooking(c.b)} className="underline hover:no-underline">
                          {bName} ({bTime})
                        </button>
                      </span>
                    </li>
                  );
                })}
                {conflicts.length > 8 && (
                  <li className="opacity-75 italic">… et {conflicts.length - 8} autre{conflicts.length - 8 > 1 ? "s" : ""}</li>
                )}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {viewMode === "planning" ? (
          /* ─── Planning View ─── */
          <div className="space-y-4">
            {/* Week navigation + room selector */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPlanningWeekStart((w) => addDays(w, -7))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium min-w-[180px] text-center">
                  {format(planningWeekStart, "d MMM", { locale: fr })} — {format(addDays(planningWeekStart, 6), "d MMM yyyy", { locale: fr })}
                </span>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPlanningWeekStart((w) => addDays(w, 7))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setPlanningWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
                Aujourd'hui
              </Button>
              <div className="min-w-[200px]">
                <Select value={planningRoom} onValueChange={setPlanningRoom}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Sélectionner une salle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">🗓️ Toutes les salles</SelectItem>
                    {rooms.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {planningRoom === "__all__" ? (
              <WeeklyAllRoomsOverview
                weekStart={planningWeekStart}
                rooms={rooms}
                onBookingClick={(booking) => { setEditBooking(booking); setEditOpen(true); }}
              />
            ) : planningRoom ? (
              <WeeklyOverview
                weekStart={planningWeekStart}
                selectedRoom={planningRoom}
                rooms={rooms}
                onSlotClick={() => {}}
                onBookingClick={(booking) => { setEditBooking(booking); setEditOpen(true); }}
              />
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground text-sm">
                  Sélectionnez une salle pour afficher le planning.
                </CardContent>
              </Card>
            )}
          </div>
        ) : viewMode === "occupancy" ? (
          /* ─── Occupancy View ─── */
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <CardTitle className="font-display text-base">
                    Taux d'occupation par salle — {occupancyData.label}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Horaires : 08h–22h (lun–ven), 09h–21h (sam–dim) · 15 min de battement avant/après chaque réservation
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportOccupancyCSV}
                    disabled={occupancyData.rooms.length === 0}
                    className="gap-1.5"
                  >
                    <Download className="h-3.5 w-3.5" /> CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportOccupancyPDF}
                    disabled={occupancyData.rooms.length === 0}
                    className="gap-1.5"
                  >
                    <FileText className="h-3.5 w-3.5" /> PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {occupancyData.rooms.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Aucune salle configurée.</p>
              ) : (
                <div className="space-y-4">
                  {occupancyData.rooms.map((room) => (
                    <div key={room.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium flex items-center gap-2">
                          {room.name}
                          {room.isPrivatised && (
                            <Badge variant="outline" className="text-[10px] gap-1">
                              <Lock className="h-3 w-3" /> Privatisé
                            </Badge>
                          )}
                          {room.scheduledLabel && (
                            <Badge variant="outline" className="text-[10px] gap-1 border-warning/50 bg-warning/10 text-warning">
                              <CalendarClock className="h-3 w-3" />
                              {room.scheduledLabel}
                            </Badge>
                          )}
                        </span>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {room.isPrivatised ? (
                            <span>Privatisé</span>
                          ) : (
                            <>
                              <span>{room.bookingCount} réservation{room.bookingCount > 1 ? "s" : ""}</span>
                              <span>{room.bookedHours.toFixed(1)}h / {room.totalHours}h</span>
                            </>
                          )}
                          <span className="font-medium text-foreground">
                            {new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(room.revenue)} HTVA
                          </span>
                          <Badge
                            className={cn(
                              "text-[10px] px-1.5 py-0",
                              room.occupancyPct >= 70
                                ? "bg-destructive/10 text-destructive border-destructive/20"
                                : room.occupancyPct >= 40
                                ? "bg-amber-500/10 text-amber-700 border-amber-500/20"
                                : "bg-primary/10 text-primary border-primary/20"
                            )}
                          >
                            {room.occupancyPct}%
                          </Badge>
                        </div>
                      </div>
                      {/* Barre empilée : confirmé + pré-réservations */}
                      <div className="h-2 w-full rounded-full bg-secondary overflow-hidden flex">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${room.confirmedOccupancyPct}%` }}
                        />
                        <div
                          className="h-full bg-amber-400/70 [background-image:repeating-linear-gradient(45deg,transparent,transparent_3px,hsl(var(--background))_3px,hsl(var(--background))_5px)]"
                          style={{ width: `${Math.max(0, room.occupancyPct - room.confirmedOccupancyPct)}%` }}
                        />
                      </div>
                      {room.pendingHours > 0 && (
                        <p className="text-[11px] text-amber-700">
                          dont {room.pendingHours.toFixed(1)}h en pré-réservation (
                          {room.occupancyPct - room.confirmedOccupancyPct}% d'occupation potentielle)
                        </p>
                      )}
                      {/* Séparation visuelle : forfait / horaire facturé / disponible */}
                      <div className="grid gap-2 sm:grid-cols-4 text-[11px]">
                        <div className="rounded-md border border-primary/30 bg-primary/5 px-2 py-1.5">
                          <p className="text-primary font-medium">Inclus au forfait</p>
                          <p className="font-semibold text-foreground">{eur0(room.flatRevenue)} HTVA</p>
                          {room.coveredHourlyValue > 0 && (
                            <p className="text-muted-foreground italic">
                              dont {eur0(room.coveredHourlyValue)} d'heures couvertes (non facturées en sus)
                            </p>
                          )}
                        </div>
                        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-2 py-1.5">
                          <p className="text-emerald-700 font-medium">Horaire facturé</p>
                          <p className="font-semibold text-foreground">{eur0(room.hourlyRevenue)} HTVA</p>
                          <p className="text-muted-foreground">
                            {room.bookedHours.toFixed(1)}h réservées (battement inclus)
                          </p>
                          {room.discountTotal > 0 && (
                            <p className="text-muted-foreground italic">
                              après {eur0(room.discountTotal)} de remises
                            </p>
                          )}
                        </div>
                        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-1.5">
                          <p className="text-amber-700 font-medium">Potentiel (en attente)</p>
                          <p className="font-semibold text-foreground">{eur0(room.pendingHourlyRevenue)} HTVA</p>
                          <p className="text-muted-foreground">
                            {room.pendingHours.toFixed(1)}h pré-réservées
                          </p>
                        </div>
                        <div className="rounded-md border border-border bg-muted/40 px-2 py-1.5">
                          <p className="font-medium">Heures disponibles</p>
                          <p className="font-semibold text-foreground">
                            {room.availableHours.toFixed(1)}h / {room.totalHours}h
                          </p>
                          <p className="text-muted-foreground">
                            {room.privatizedHours > 0
                              ? `${room.privatizedHours.toFixed(1)}h bloquées (privatisation)`
                              : "selon les plages d'ouverture"}
                          </p>
                        </div>
                      </div>


                    </div>
                  ))}

                  {/* Global average */}
                  <div className="border-t pt-4 mt-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold">Taux d'occupation moyen global</span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-foreground">
                          Total : {new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(occupancyData.totalRevenue)} HTVA
                        </span>
                        <Badge
                          className={cn(
                            "text-xs px-2 py-0.5",
                            occupancyData.globalAvg >= 70
                              ? "bg-destructive/10 text-destructive border-destructive/20"
                              : occupancyData.globalAvg >= 40
                              ? "bg-amber-500/10 text-amber-700 border-amber-500/20"
                              : "bg-primary/10 text-primary border-primary/20"
                          )}
                        >
                          {occupancyData.globalAvg}%
                        </Badge>
                      </div>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-secondary overflow-hidden flex mt-1.5">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${occupancyData.globalConfirmedAvg}%` }}
                      />
                      <div
                        className="h-full bg-amber-400/70 [background-image:repeating-linear-gradient(45deg,transparent,transparent_3px,hsl(var(--background))_3px,hsl(var(--background))_5px)]"
                        style={{ width: `${Math.max(0, occupancyData.globalAvg - occupancyData.globalConfirmedAvg)}%` }}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                      <span>
                        Confirmé :{" "}
                        <span className="font-medium text-foreground">
                          {occupancyData.globalConfirmedAvg}%
                        </span>
                      </span>
                      <span>
                        Inclus au forfait :{" "}
                        <span className="font-medium text-foreground">
                          {eur0(occupancyData.totalFlatRevenue)} HTVA
                        </span>
                      </span>
                      <span>
                        Horaire facturé :{" "}
                        <span className="font-medium text-foreground">
                          {eur0(occupancyData.totalHourlyRevenue)} HTVA
                        </span>
                      </span>
                      <span className="text-amber-700">
                        Potentiel (en attente) :{" "}
                        <span className="font-medium">
                          {eur0(occupancyData.totalPendingRevenue)} HTVA · {occupancyData.totalPendingHours.toFixed(1)}h
                        </span>
                      </span>
                      <span>
                        Heures disponibles :{" "}
                        <span className="font-medium text-foreground">
                          {occupancyData.totalAvailableHours.toFixed(1)}h
                        </span>
                      </span>

                      {occupancyData.totalDiscount > 0 && (
                        <span className="italic">
                          − {eur0(occupancyData.totalDiscount)} de remises accordées
                        </span>
                      )}
                      {occupancyData.totalCoveredHourly > 0 && (
                        <span className="italic">
                          + {eur0(occupancyData.totalCoveredHourly)} d'heures déjà couvertes par les
                          forfaits
                        </span>
                      )}

                      <span className="ml-auto">
                        Taux calculés sur les plages d'ouverture définies par salle
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                </div>
              ) : filteredBookings.length === 0 ? (
                <div className="text-center py-12">
                  <CalendarCheck className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">Aucune réservation trouvée.</p>
                </div>
              ) : viewMode === "practitioner" ? (
                /* ─── Grouped by Practitioner ─── */
                <div className="space-y-6">
                  {/* Toggles + Bulk actions */}
                  <div className="flex flex-wrap items-center gap-4 pb-2 border-b border-border">
                    <button onClick={toggleSelectAll} className="text-muted-foreground hover:text-primary transition-colors">
                      {selectedIds.size === filteredBookings.length && filteredBookings.length > 0
                        ? <CheckSquare className="h-4 w-4 text-primary" />
                        : <Square className="h-4 w-4" />}
                    </button>
                    <span className="text-xs text-muted-foreground">
                      {selectedIds.size > 0 ? `${selectedIds.size} sélectionnée${selectedIds.size > 1 ? "s" : ""}` : "Tout sélectionner"}
                    </span>
                    {selectedIds.size > 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="text-xs"
                        onClick={() => setBulkDeleteOpen(true)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Supprimer ({selectedIds.size})
                      </Button>
                    )}
                    <div className="flex items-center gap-2 ml-auto">
                      <Switch id="hide-cancelled" checked={hideCancelled} onCheckedChange={setHideCancelled} />
                      <Label htmlFor="hide-cancelled" className="text-xs cursor-pointer">Masquer les annulées</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch id="hide-notes" checked={hideNotes} onCheckedChange={setHideNotes} />
                      <Label htmlFor="hide-notes" className="text-xs cursor-pointer">Masquer les notes</Label>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        if (collapsedPractitioners.size === groupedByPractitioner.length) {
                          setCollapsedPractitioners(new Set());
                        } else {
                          setCollapsedPractitioners(new Set(groupedByPractitioner.map(([pid]) => pid)));
                        }
                      }}
                    >
                      {collapsedPractitioners.size === groupedByPractitioner.length ? "Tout déplier" : "Tout replier"}
                    </Button>
                  </div>
                  {groupedByPractitioner.map(([pid, group]) => {
                    const allGroupIds = group.bookings.map((b: any) => b.id);
                    const allSelected = allGroupIds.length > 0 && allGroupIds.every((id: string) => selectedIds.has(id));
                    const someSelected = allGroupIds.some((id: string) => selectedIds.has(id));

                    const toggleSelectPractitioner = (e: React.MouseEvent) => {
                      e.stopPropagation();
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        if (allSelected) {
                          allGroupIds.forEach((id: string) => next.delete(id));
                        } else {
                          allGroupIds.forEach((id: string) => next.add(id));
                        }
                        return next;
                      });
                    };

                    return (
                    <div key={pid}>
                      <div className="flex items-center gap-2 mb-3">
                        <button
                          className="flex items-center gap-2 flex-1 text-left hover:bg-accent/50 rounded-lg p-1.5 -ml-1.5 transition-colors"
                          onClick={() => toggleCollapsed(pid)}
                        >
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Users className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-sm">{group.name}</p>
                            <p className="text-xs text-muted-foreground">{group.bookings.length} réservation{group.bookings.length > 1 ? "s" : ""}</p>
                          </div>
                          {(() => {
                            const billing = practitionerBilling(group.bookings);
                            return (
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="text-xs shrink-0">
                                  Total {formatHours(group.bookings.reduce((s: number, b: any) => s + bookingHours(b), 0))}
                                </Badge>
                                {billing.hasFlat && (
                                  <Badge variant="outline" className="text-xs shrink-0 border-primary/30 text-primary bg-primary/5">
                                    Inclus au forfait {formatMoney(billing.flat)} HTVA
                                    {billing.coveredHours > 0 && ` · ${formatHours(billing.coveredHours)}`}
                                  </Badge>
                                )}
                                <Badge variant="outline" className="text-xs shrink-0 text-emerald-700 border-emerald-500/30 bg-emerald-500/5">
                                  Horaire facturé {formatMoney(billing.hourly)} HTVA
                                  {billing.billedHours > 0 && ` · ${formatHours(billing.billedHours)}`}
                                </Badge>
                                {billing.discountTotal > 0 && (
                                  <Badge variant="outline" className="text-xs shrink-0 text-sky-700 border-sky-500/30 bg-sky-500/5">
                                    Remises −{formatMoney(billing.discountTotal)} HTVA
                                  </Badge>
                                )}
                                {billing.pendingHours > 0 && (
                                  <Badge variant="outline" className="text-xs shrink-0 text-amber-700 border-amber-500/30 bg-amber-500/5">
                                    Pré-réservations {formatMoney(billing.pendingHourly)} HTVA · {formatHours(billing.pendingHours)}
                                  </Badge>
                                )}
                                <Badge variant="outline" className="text-xs shrink-0 font-semibold text-emerald-600 border-emerald-200">
                                  Total {formatMoney(billing.total)} HTVA
                                </Badge>

                              </div>

                            );
                          })()}

                          <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", !collapsedPractitioners.has(pid) && "rotate-90")} />
                        </button>
                        <Button
                          variant={allSelected ? "default" : "outline"}
                          size="sm"
                          className="text-xs shrink-0"
                          onClick={toggleSelectPractitioner}
                        >
                          {allSelected ? <CheckSquare className="h-3.5 w-3.5 mr-1" /> : <Square className="h-3.5 w-3.5 mr-1" />}
                          {allSelected ? "Désélectionner tout" : someSelected ? `${allGroupIds.filter((id: string) => selectedIds.has(id)).length}/${allGroupIds.length}` : "Tout sélectionner"}
                        </Button>
                      </div>
                      {!collapsedPractitioners.has(pid) && (
                        <div className="space-y-2 pl-10">
                          {group.bookings.map((b: any) => (
                            <BookingRow key={b.id} booking={b} />
                          ))}
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              ) : (
                /* ─── Default List ─── */
                <div className="space-y-3">
                  {/* Bulk action bar */}
                  <div className="flex items-center gap-3 pb-2 border-b border-border">
                    <button onClick={toggleSelectAll} className="text-muted-foreground hover:text-primary transition-colors">
                      {selectedIds.size === filteredBookings.length && filteredBookings.length > 0
                        ? <CheckSquare className="h-4 w-4 text-primary" />
                        : <Square className="h-4 w-4" />}
                    </button>
                    <span className="text-xs text-muted-foreground">
                      {selectedIds.size > 0 ? `${selectedIds.size} sélectionnée${selectedIds.size > 1 ? "s" : ""}` : "Tout sélectionner"}
                    </span>
                    {selectedIds.size > 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="ml-auto text-xs"
                        onClick={() => setBulkDeleteOpen(true)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Supprimer ({selectedIds.size})
                      </Button>
                    )}
                  </div>
                  {filteredBookings.map((booking: any) => (
                    <BookingRow key={booking.id} booking={booking} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <EditBookingDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        booking={editBooking}
        rooms={rooms}
        practitioners={practitioners}
        onSaved={fetchBookings}
      />

      <AlertDialog open={!!deleteBookingId} onOpenChange={(open) => { if (!open) setDeleteBookingId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette réservation ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La réservation sera définitivement supprimée du planning.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteBookingId && handleDeleteBooking(deleteBookingId)}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {selectedIds.size} réservation{selectedIds.size > 1 ? "s" : ""} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Les réservations sélectionnées seront définitivement supprimées du planning.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleBulkDelete}
            >
              Supprimer ({selectedIds.size})
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default AdminBookings;
