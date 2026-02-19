import { useEffect, useState } from "react";
import { CalendarCheck, CheckCircle, XCircle, Plus, Loader2, Repeat } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { format, addWeeks, isAfter, isBefore, parseISO } from "date-fns";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TIME_OPTIONS = Array.from({ length: 24 }, (_, h) =>
  [0, 30].map((m) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`)
).flat();

const AdminBookings = () => {
  const { toast } = useToast();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "confirmed" | "cancelled">("all");

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
  const [endDateOpen, setEndDateOpen] = useState(false);

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
    setPractitionerActivities([]);
  };

  // Compute all booking dates based on recurrence
  const computeBookingDates = (startDateStr: string): Date[] => {
    const start = parseISO(startDateStr);
    if (!isRecurring || !recurrenceEndDate) return [start];

    const dates: Date[] = [];
    let current = start;
    while (!isAfter(current, recurrenceEndDate)) {
      dates.push(new Date(current));
      current = addWeeks(current, 1);
    }
    return dates;
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
      };
    });

    const { error } = await supabase.from("bookings").insert(rows);

    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: dates.length > 1
          ? `${dates.length} réservations créées !`
          : "Réservation créée !",
      });
      resetDialog();
      setOpen(false);
      fetchBookings();
    }
    setCreating(false);
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("bookings")
      .update({ status })
      .eq("id", id);

    if (!error) {
      toast({
        title: status === "confirmed" ? "Réservation confirmée" : "Réservation annulée",
      });
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

  // Compute preview of recurrence dates
  const previewDates = newBooking.date && isRecurring && recurrenceEndDate
    ? computeBookingDates(newBooking.date)
    : [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
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
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un praticien…" />
                    </SelectTrigger>
                    <SelectContent>
                      {practitioners.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.first_name} {p.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Activity (only if practitioner has activities) */}
                {practitionerActivities.length > 0 && (
                  <div className="space-y-2">
                    <Label>Lier à une activité <span className="text-muted-foreground font-normal">(facultatif)</span></Label>
                    <Select
                      value={newBooking.activity_id}
                      onValueChange={(v) => setNewBooking((b) => ({ ...b, activity_id: v === "__none__" ? "" : v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Aucune activité liée" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Aucune</SelectItem>
                        {practitionerActivities.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Room */}
                <div className="space-y-2">
                  <Label>Espace / Salle *</Label>
                  <Select value={newBooking.room_id} onValueChange={(v) => setNewBooking((b) => ({ ...b, room_id: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une salle…" />
                    </SelectTrigger>
                    <SelectContent>
                      {rooms.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date */}
                <div className="space-y-2">
                  <Label>Date de début *</Label>
                  <Input
                    type="date"
                    value={newBooking.date}
                    onChange={(e) => setNewBooking((b) => ({ ...b, date: e.target.value }))}
                  />
                </div>

                {/* Times */}
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

                {/* Recurrence */}
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
                    <div className="space-y-2 pt-1">
                      <Label className="text-xs">Date de fin de récurrence *</Label>
                      <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn("w-full justify-start text-left font-normal", !recurrenceEndDate && "text-muted-foreground")}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {recurrenceEndDate
                              ? format(recurrenceEndDate, "d MMMM yyyy", { locale: fr })
                              : "Choisir une date de fin…"}
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

                {/* Status */}
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

                {/* Notes */}
                <div className="space-y-2">
                  <Label>Notes (facultatif)</Label>
                  <Textarea
                    placeholder="Informations complémentaires…"
                    rows={2}
                    value={newBooking.notes}
                    onChange={(e) => setNewBooking((b) => ({ ...b, notes: e.target.value }))}
                  />
                </div>

                <Button onClick={handleCreateBooking} disabled={creating} className="w-full">
                  {creating
                    ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Création en cours…</>
                    : <><Plus className="h-4 w-4 mr-2" />
                      {previewDates.length > 1
                        ? `Créer ${previewDates.length} réservations`
                        : "Créer la réservation"}
                    </>
                  }
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {(["all", "pending", "confirmed", "cancelled"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "Toutes" : f === "pending" ? "En attente" : f === "confirmed" ? "Confirmées" : "Annulées"}
            </Button>
          ))}
        </div>

        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            ) : bookings.length === 0 ? (
              <div className="text-center py-12">
                <CalendarCheck className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">Aucune réservation trouvée.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {bookings.map((booking: any) => (
                  <div
                    key={booking.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <p className="font-medium text-sm">
                          {booking.profiles?.first_name} {booking.profiles?.last_name}
                        </p>
                        {statusBadge(booking.status)}
                        {booking.activities?.title && (
                          <Badge variant="outline" className="text-xs">
                            {booking.activities.title}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {booking.rooms?.name} •{" "}
                        {format(new Date(booking.start_time), "EEEE d MMMM • HH:mm", { locale: fr })}
                        {" — "}
                        {format(new Date(booking.end_time), "HH:mm")}
                      </p>
                      {booking.notes && (
                        <p className="text-xs text-muted-foreground mt-1 italic">
                          "{booking.notes}"
                        </p>
                      )}
                    </div>

                    {booking.status === "pending" && (
                      <div className="flex gap-2 ml-4">
                        <Button size="sm" onClick={() => updateStatus(booking.id, "confirmed")}>
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Confirmer
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => updateStatus(booking.id, "cancelled")}>
                          <XCircle className="h-4 w-4 mr-1" />
                          Refuser
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminBookings;
