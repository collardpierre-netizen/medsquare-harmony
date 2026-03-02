import { useEffect, useState, useMemo } from "react";
import { CalendarCheck, CheckCircle, XCircle, Plus, Loader2, Repeat, Users, BarChart3, List, Filter, Pencil, CalendarDays, ChevronLeft, ChevronRight, Trash2, CheckSquare, Square, Lock } from "lucide-react";
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
import { format, addWeeks, addDays, isAfter, isBefore, parseISO, startOfWeek, isSameDay, startOfDay, getDay } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
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
import { getOpeningHours } from "@/components/dashboard/bookings/utils";
import WeeklyOverview from "@/components/dashboard/bookings/WeeklyOverview";
import WeeklyAllRoomsOverview from "@/components/dashboard/bookings/WeeklyAllRoomsOverview";
import { Progress } from "@/components/ui/progress";

const TIME_OPTIONS = Array.from({ length: 24 }, (_, h) =>
  [0, 30].map((m) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`)
).flat();

type ViewMode = "list" | "practitioner" | "occupancy" | "planning";

const AdminBookings = () => {
  const { toast } = useToast();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "confirmed" | "cancelled">("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editBooking, setEditBooking] = useState<any>(null);

  // Filters
  const [filterRoom, setFilterRoom] = useState<string>("__all__");
  const [filterPractitioner, setFilterPractitioner] = useState<string>("__all__");
  const [filterDateFrom, setFilterDateFrom] = useState<Date | undefined>(undefined);
  const [filterDateTo, setFilterDateTo] = useState<Date | undefined>(undefined);

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
    let query = supabase
      .from("bookings")
      .select("*, profiles(first_name, last_name), rooms(name), activities(title)")
      .order("start_time", { ascending: false });

    if (filter !== "all") {
      query = query.eq("status", filter);
    }

    const { data } = await query;
    setBookings(data || []);
    setLoading(false);
  };

  const fetchResources = async () => {
    const [{ data: profs }, { data: roomsData }] = await Promise.all([
      supabase.from("profiles").select("id, first_name, last_name").order("last_name"),
      supabase.from("rooms").select("id, name").eq("is_available", true).order("name"),
    ]);
    setPractitioners(profs || []);
    setRooms(roomsData || []);
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

  const toggleCollapsed = (pid: string) => {
    setCollapsedPractitioners(prev => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid); else next.add(pid);
      return next;
    });
  };

  // Occupancy stats per room — uses date filter if set, otherwise current week
  const occupancyData = useMemo(() => {
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

    // Build array of days in range
    const days: Date[] = [];
    let cursor = rangeStart;
    while (cursor <= rangeEnd) {
      days.push(cursor);
      cursor = addDays(cursor, 1);
    }

    const roomStats: Record<string, { name: string; totalHours: number; bookedHours: number; bookingCount: number }> = {};

    rooms.forEach((r) => {
      let totalHours = 0;
      days.forEach((day) => {
        const { start, end } = getOpeningHours(day);
        totalHours += end - start;
      });
      roomStats[r.id] = { name: r.name, totalHours, bookedHours: 0, bookingCount: 0 };
    });

    bookings.forEach((b) => {
      if (b.status === "cancelled") return;
      const start = new Date(b.start_time);
      const end = new Date(b.end_time);
      const bDay = startOfDay(start);
      const inRange = days.some((d) => isSameDay(d, bDay));
      if (!inRange) return;

      if (roomStats[b.room_id]) {
        const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        roomStats[b.room_id].bookedHours += hours;
        roomStats[b.room_id].bookingCount += 1;
      }
    });

    return {
      label,
      rooms: Object.entries(roomStats)
        .map(([id, stats]) => ({
          id,
          ...stats,
          occupancyPct: stats.totalHours > 0 ? Math.round((stats.bookedHours / stats.totalHours) * 100) : 0,
        }))
        .sort((a, b) => b.occupancyPct - a.occupancyPct),
    };
  }, [rooms, bookings, filterDateFrom, filterDateTo]);

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

  const BookingRow = ({ booking }: { booking: any }) => {
    const isSelected = selectedIds.has(booking.id);
    return (
      <div
        className={cn(
          "flex items-center justify-between p-4 rounded-lg border transition-colors cursor-pointer",
          isSelected ? "border-primary/40 bg-primary/5" : "border-border hover:bg-accent/50"
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
            </p>
            {booking.notes && !hideNotes && (
              <p className="text-xs text-muted-foreground mt-1 italic">"{booking.notes}"</p>
            )}
          </div>
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
                      <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !recurrenceEndDate && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {recurrenceEndDate ? format(recurrenceEndDate, "d MMMM yyyy", { locale: fr }) : "Choisir une date de fin…"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={recurrenceEndDate}
                            onSelect={(d) => { setRecurrenceEndDate(d); setEndDateOpen(false); }}
                            disabled={(d) => newBooking.date ? isBefore(d, parseISO(newBooking.date)) : false}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
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
                      const { start, end } = getOpeningHours(d);
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

        {/* Content based on view mode */}
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
              <CardTitle className="font-display text-base">
                Taux d'occupation par salle — {occupancyData.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {occupancyData.rooms.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Aucune salle configurée.</p>
              ) : (
                <div className="space-y-4">
                  {occupancyData.rooms.map((room) => (
                    <div key={room.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{room.name}</span>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{room.bookingCount} réservation{room.bookingCount > 1 ? "s" : ""}</span>
                          <span>{room.bookedHours.toFixed(1)}h / {room.totalHours}h</span>
                          <Badge
                            className={cn(
                              "text-[10px] px-1.5 py-0",
                              room.occupancyPct >= 70
                                ? "bg-destructive/10 text-destructive border-destructive/20"
                                : room.occupancyPct >= 40
                                ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                                : "bg-primary/10 text-primary border-primary/20"
                            )}
                          >
                            {room.occupancyPct}%
                          </Badge>
                        </div>
                      </div>
                      <Progress
                        value={room.occupancyPct}
                        className="h-2"
                      />
                    </div>
                  ))}
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
