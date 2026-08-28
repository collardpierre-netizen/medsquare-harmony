import { useState, useEffect } from "react";
import { format, addWeeks, addDays, getDay, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Clock, MapPin, User, Pencil, Trash2, Loader2, Repeat, Lock, Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getOpeningHours } from "./utils";

const TIME_OPTIONS = Array.from({ length: 24 }, (_, h) =>
  [0, 30].map((m) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`)
).flat();

const DAYS_OF_WEEK = [
  { key: 1, label: "Lun" },
  { key: 2, label: "Mar" },
  { key: 3, label: "Mer" },
  { key: 4, label: "Jeu" },
  { key: 5, label: "Ven" },
  { key: 6, label: "Sam" },
  { key: 0, label: "Dim" },
];

interface EditBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: any | null;
  rooms: Array<{ id: string; name: string }>;
  practitioners: Array<{ id: string; first_name: string; last_name: string }>;
  onSaved: () => void;
}

const EditBookingDialog = ({
  open,
  onOpenChange,
  booking,
  rooms,
  practitioners,
  onSaved,
}: EditBookingDialogProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [groupCount, setGroupCount] = useState(0);

  const [roomId, setRoomId] = useState("");
  const [practitionerId, setPractitionerId] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [status, setStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [discountType, setDiscountType] = useState<string>("none");
  const [discountValue, setDiscountValue] = useState<string>("");
  const [discountReason, setDiscountReason] = useState("");
  const [recurrence, setRecurrence] = useState(false);
  const [recurrenceWeeks, setRecurrenceWeeks] = useState(4);
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [dateOpen, setDateOpen] = useState(false);


  useEffect(() => {
    if (booking) {
      const start = new Date(booking.start_time);
      const end = new Date(booking.end_time);

      const parts = new Intl.DateTimeFormat("fr-BE", {
        timeZone: "Europe/Brussels",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(start);
      const y = parts.find((p) => p.type === "year")!.value;
      const m = parts.find((p) => p.type === "month")!.value;
      const d = parts.find((p) => p.type === "day")!.value;
      setDate(`${y}-${m}-${d}`);

      const fmtTime = (dt: Date) => {
        const tp = new Intl.DateTimeFormat("fr-BE", {
          timeZone: "Europe/Brussels",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).formatToParts(dt);
        const hh = tp.find((p) => p.type === "hour")!.value;
        const mm = tp.find((p) => p.type === "minute")!.value;
        return `${hh}:${mm}`;
      };

      setStartTime(fmtTime(start));
      setEndTime(fmtTime(end));
      setRoomId(booking.room_id);
      setPractitionerId(booking.practitioner_id);
      setStatus(booking.status);
      setNotes(booking.notes || "");
      setDiscountType(booking.discount_type || "none");
      setDiscountValue(
        booking.discount_value !== null && booking.discount_value !== undefined
          ? String(booking.discount_value)
          : ""
      );
      setDiscountReason(booking.discount_reason || "");


      // Check if this booking belongs to a recurrence group
      if (booking.recurrence_group_id) {
        supabase
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("recurrence_group_id", booking.recurrence_group_id)
          .then(({ count }) => setGroupCount(count || 0));
      } else {
        setGroupCount(0);
      }
    }
  }, [booking]);

  if (!booking) return null;

  const handleSave = async () => {
    if (!date || !startTime || !endTime || !roomId || !practitionerId) {
      toast({ title: "Champs requis manquants", variant: "destructive" });
      return;
    }
    const newStart = new Date(`${date}T${startTime}:00`);
    const newEnd = new Date(`${date}T${endTime}:00`);
    if (newEnd <= newStart) {
      toast({ title: "Horaire invalide", description: "L'heure de fin doit être après l'heure de début.", variant: "destructive" });
      return;
    }

    setSaving(true);

    const hasDiscount = discountType !== "none" && Number(discountValue) > 0;
    const discountPayload = {
      discount_type: hasDiscount ? discountType : null,
      discount_value: hasDiscount ? Number(discountValue) : null,
      discount_reason: hasDiscount ? discountReason || null : null,
    };

    // Update the existing booking
    const { error } = await supabase
      .from("bookings")
      .update({
        room_id: roomId,
        practitioner_id: practitionerId,
        start_time: newStart.toISOString(),
        end_time: newEnd.toISOString(),
        status,
        notes: notes || null,
        ...discountPayload,
      })
      .eq("id", booking.id);


    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    // Create recurring copies if enabled
    if (recurrence && recurrenceWeeks >= 2 && recurrenceDays.length > 0) {
      const groupId = booking.recurrence_group_id || crypto.randomUUID();
      await supabase.from("bookings").update({ recurrence_group_id: groupId }).eq("id", booking.id);

      const bookingsToInsert: any[] = [];
      const bookingDayOfWeek = getDay(newStart);
      const timeDiffMs = newEnd.getTime() - newStart.getTime();

      for (let w = 0; w < recurrenceWeeks; w++) {
        for (const dayNum of recurrenceDays) {
          // Skip the original booking's day in week 0
          if (w === 0 && dayNum === bookingDayOfWeek) continue;

          // Calculate offset from the booking's day
          let dayOffset = dayNum - bookingDayOfWeek;
          if (dayOffset < 0) dayOffset += 7;

          const wStart = addDays(addWeeks(newStart, w), dayOffset);
          const wEnd = new Date(wStart.getTime() + timeDiffMs);

          bookingsToInsert.push({
            room_id: roomId,
            practitioner_id: practitionerId,
            start_time: wStart.toISOString(),
            end_time: wEnd.toISOString(),
            status,
            notes: notes || null,
            recurrence_group_id: groupId,
            ...discountPayload,
          });

        }
      }

      if (bookingsToInsert.length > 0) {
        const { error: recError } = await supabase.from("bookings").insert(bookingsToInsert);
        if (recError) {
          toast({ title: "Réservation mise à jour mais récurrence échouée", description: recError.message, variant: "destructive" });
        } else {
          toast({ title: `Réservation mise à jour + ${bookingsToInsert.length} récurrences créées ✓` });
        }
      } else {
        toast({ title: "Réservation mise à jour ✓" });
      }
    } else {
      toast({ title: "Réservation mise à jour ✓" });
    }

    onOpenChange(false);
    onSaved();
    setSaving(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await supabase.from("bookings").delete().eq("id", booking.id);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Réservation supprimée" });
      onOpenChange(false);
      onSaved();
    }
    setDeleting(false);
  };

  const handleDeleteGroup = async () => {
    if (!booking.recurrence_group_id) return;
    setDeletingGroup(true);
    const { error } = await supabase
      .from("bookings")
      .delete()
      .eq("recurrence_group_id", booking.recurrence_group_id);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${groupCount} réservations récurrentes supprimées` });
      onOpenChange(false);
      onSaved();
    }
    setDeletingGroup(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Pencil className="h-4 w-4 text-primary" />
            </div>
            <DialogTitle>Modifier la réservation</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Practitioner */}
          <div className="space-y-2">
            <Label>Praticien</Label>
            <Select value={practitionerId} onValueChange={setPractitionerId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {practitioners.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Room */}
          <div className="space-y-2">
            <Label>Salle</Label>
            <Select value={roomId} onValueChange={setRoomId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label>Date</Label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="flex-1"
                placeholder="JJ/MM/AAAA"
              />
              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon" type="button" aria-label="Ouvrir le calendrier">
                    <CalendarIcon className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0" align="end" sideOffset={4}>
                  <div className="w-[320px]">
                    <Calendar
                      mode="single"
                      selected={date ? parseISO(date) : undefined}
                      onSelect={(d) => {
                        if (d) setDate(format(d, "yyyy-MM-dd"));
                        setDateOpen(false);
                      }}
                      defaultMonth={date ? parseISO(date) : new Date()}
                      initialFocus
                      locale={fr}
                      className="p-3 pointer-events-auto mx-auto"
                    />
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Heure de début</Label>
              <Select value={startTime} onValueChange={setStartTime}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Heure de fin</Label>
              <Select value={endTime} onValueChange={setEndTime}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label>Statut</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="confirmed">Confirmée</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="cancelled">Annulée</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes…" rows={2} />
          </div>

          {/* Recurrence */}
          <div className="rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Repeat className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label className="text-sm">Ajouter une récurrence</Label>
                  <p className="text-xs text-muted-foreground">Dupliquer cette réservation chaque semaine</p>
                </div>
              </div>
              <Switch
                checked={recurrence}
                onCheckedChange={(checked) => {
                  setRecurrence(checked);
                  if (checked && recurrenceDays.length === 0) {
                    // Pre-select the current booking's day
                    const bookingDay = new Date(date).getDay();
                    setRecurrenceDays([bookingDay]);
                  }
                }}
              />
            </div>
            {recurrence && (
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
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Label className="text-xs whitespace-nowrap">Nombre de semaines :</Label>
                  <Input
                    type="number"
                    min={2}
                    max={52}
                    value={recurrenceWeeks}
                    onChange={(e) => setRecurrenceWeeks(Math.min(52, Math.max(2, parseInt(e.target.value) || 2)))}
                    className="w-20 h-8 text-sm"
                  />
                  <span className="text-xs text-muted-foreground">
                    ({(recurrenceWeeks - 1) * Math.max(recurrenceDays.length, 1)} copies)
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Privatiser */}
          <div className="rounded-xl border border-border p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label className="text-sm">Privatiser la salle</Label>
                  <p className="text-xs text-muted-foreground">Bloquer la salle entière pour ce praticien (journée complète)</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => {
                  const { start: openStart, end: openEnd } = getOpeningHours(new Date(date));
                  setStartTime(`${String(openStart).padStart(2, "0")}:00`);
                  setEndTime(`${String(openEnd).padStart(2, "0")}:00`);
                  setNotes(notes ? notes + " [Privatisé]" : "[Privatisé]");
                  toast({ title: "Horaires étendus à la journée complète 🔒" });
                }}
              >
                <Lock className="h-3 w-3 mr-1" />
                Privatiser
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
          <div className="flex gap-2 mr-auto flex-wrap">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={deleting}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Supprimer
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer cette réservation ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action est irréversible. La réservation sera définitivement supprimée.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    Supprimer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {booking.recurrence_group_id && groupCount > 1 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10" disabled={deletingGroup}>
                    <Repeat className="h-4 w-4 mr-1" />
                    Supprimer la série ({groupCount})
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer toute la série récurrente ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action supprimera les <strong>{groupCount}</strong> réservations liées à cette récurrence. Cette action est irréversible.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteGroup} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      {deletingGroup ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                      Supprimer la série
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Sauvegarde…</> : "Enregistrer"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditBookingDialog;
