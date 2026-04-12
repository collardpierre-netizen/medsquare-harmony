import { useState, useMemo, useEffect } from "react";
import { format, isWeekend, getDay, addDays, addWeeks } from "date-fns";
import { fr } from "date-fns/locale";
import { Clock, CalendarDays, Repeat, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { getOpeningHours } from "./utils";
import { cn } from "@/lib/utils";

export type BookingType = "hourly" | "full_day";
export type RecurrenceType = "none" | "weekly";

const DAYS_OF_WEEK = [
  { key: 1, label: "Lun" },
  { key: 2, label: "Mar" },
  { key: 3, label: "Mer" },
  { key: 4, label: "Jeu" },
  { key: 5, label: "Ven" },
  { key: 6, label: "Sam" },
  { key: 0, label: "Dim" },
];

/** Generate time options as "HH:mm" strings from startHour to endHour in 30min steps */
const generateTimeOptions = (startHour: number, endHour: number): string[] => {
  const options: string[] = [];
  for (let h = startHour; h <= endHour; h++) {
    for (let m = 0; m < 60; m += 30) {
      if (h === endHour && m > 0) break;
      options.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return options;
};

const timeToMinutes = (time: string): number => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

const formatDuration = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
};

interface NewBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedSlot: Date | null;
  selectedDate: Date;
  roomName: string;
  duration: string;
  onDurationChange: (v: string) => void;
  notes: string;
  onNotesChange: (v: string) => void;
  onSubmit: (options: { bookingType: BookingType; recurrence: RecurrenceType; recurrenceWeeks: number; recurrenceDays: number[]; practitionerId?: string; startHour: number; startMinute: number; endHour: number; endMinute: number }) => void;
  isSubmitting: boolean;
  isAdmin?: boolean;
  practitioners?: Array<{ id: string; first_name: string; last_name: string }>;
  currentProfileId?: string;
}

const NewBookingDialog = ({
  open,
  onOpenChange,
  selectedSlot,
  selectedDate,
  roomName,
  duration,
  onDurationChange,
  notes,
  onNotesChange,
  onSubmit,
  isSubmitting,
  isAdmin,
  practitioners,
  currentProfileId,
}: NewBookingDialogProps) => {
  const [bookingType, setBookingType] = useState<BookingType>("hourly");
  const [recurrence, setRecurrence] = useState<RecurrenceType>("none");
  const [recurrenceWeeks, setRecurrenceWeeks] = useState(4);
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [selectedPractitioner, setSelectedPractitioner] = useState<string>("");

  const { start, end } = getOpeningHours(selectedDate);

  // Time options
  const allTimeOptions = useMemo(() => generateTimeOptions(start, end), [start, end]);

  // Start time derived from selectedSlot
  const initialStartTime = selectedSlot
    ? `${String(selectedSlot.getHours()).padStart(2, "0")}:${String(selectedSlot.getMinutes()).padStart(2, "0")}`
    : allTimeOptions[0] || "08:00";

  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState("");

  // Reset times when dialog opens with a new slot
  useEffect(() => {
    if (open && selectedSlot) {
      const st = `${String(selectedSlot.getHours()).padStart(2, "0")}:${String(selectedSlot.getMinutes()).padStart(2, "0")}`;
      setStartTime(st);
      // Default end time: start + 1h
      const startMin = timeToMinutes(st);
      const defaultEndMin = Math.min(startMin + 60, end * 60);
      const endH = Math.floor(defaultEndMin / 60);
      const endM = defaultEndMin % 60;
      setEndTime(`${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`);
    }
  }, [open, selectedSlot, end]);

  // Compute available end times (must be after start time)
  const endTimeOptions = useMemo(() => {
    const startMin = timeToMinutes(startTime);
    return allTimeOptions.filter((t) => timeToMinutes(t) > startMin);
  }, [startTime, allTimeOptions]);

  // Auto-adjust end time if it's before start
  useEffect(() => {
    if (endTime && timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      const nextOptions = endTimeOptions;
      if (nextOptions.length > 0) {
        // Try to keep same duration, otherwise pick first available
        const startMin = timeToMinutes(startTime);
        const currentDur = endTime ? timeToMinutes(endTime) - timeToMinutes(initialStartTime) : 60;
        const idealEnd = startMin + Math.max(currentDur, 60);
        const idealStr = `${String(Math.floor(idealEnd / 60)).padStart(2, "0")}:${String(idealEnd % 60).padStart(2, "0")}`;
        setEndTime(nextOptions.includes(idealStr) ? idealStr : nextOptions[0]);
      }
    }
  }, [startTime]);

  // Sync duration prop for parent (in minutes)
  const durationMinutes = useMemo(() => {
    if (!startTime || !endTime) return 60;
    return Math.max(timeToMinutes(endTime) - timeToMinutes(startTime), 30);
  }, [startTime, endTime]);

  useEffect(() => {
    onDurationChange(String(durationMinutes));
  }, [durationMinutes]);

  const handleSubmit = () => {
    onSubmit({
      bookingType,
      recurrence,
      recurrenceWeeks,
      recurrenceDays,
      practitionerId: isAdmin && selectedPractitioner ? selectedPractitioner : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!v) {
        setBookingType("hourly");
        setRecurrence("none");
        setRecurrenceWeeks(4);
        setSelectedPractitioner("");
      }
      onOpenChange(v);
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Nouvelle réservation</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Date & room info */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-accent">
            <CalendarDays className="h-5 w-5 text-accent-foreground shrink-0" />
            <div>
              <p className="font-semibold text-sm">
                {format(selectedDate, "EEEE d MMMM yyyy", { locale: fr })}
              </p>
              <p className="text-xs text-muted-foreground">
                {roomName} • Horaires : {start}h–{end}h
              </p>
            </div>
          </div>

          {/* Admin: practitioner selector */}
          {isAdmin && practitioners && practitioners.length > 0 && (
            <div>
              <Label className="text-sm font-medium mb-2 block">Praticien</Label>
              <Select value={selectedPractitioner} onValueChange={setSelectedPractitioner}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Choisir un praticien" />
                </SelectTrigger>
                <SelectContent>
                  {practitioners.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.first_name} {p.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Laissez vide pour réserver à votre nom.
              </p>
            </div>
          )}

          {/* Booking type toggle */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Type de réservation</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setBookingType("hourly")}
                className={cn(
                  "flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all",
                  bookingType === "hourly"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:border-primary/40"
                )}
              >
                <Clock className="h-4 w-4" />
                À l'heure
              </button>
              <button
                type="button"
                onClick={() => setBookingType("full_day")}
                className={cn(
                  "flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all",
                  bookingType === "full_day"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:border-primary/40"
                )}
              >
                <CalendarDays className="h-4 w-4" />
                Journée entière
              </button>
            </div>
            {bookingType === "full_day" && (
              <p className="text-xs text-muted-foreground mt-2">
                Réservation de {start}h à {end}h ({end - start} heures)
              </p>
            )}
          </div>

          {/* Start & End time selectors (only for hourly) */}
          {bookingType === "hourly" && (
            <div className="space-y-3">
              <Label className="text-sm font-medium block">Horaire</Label>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground mb-1 block">Début</Label>
                  <Select value={startTime} onValueChange={setStartTime}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[250px]">
                      {allTimeOptions.slice(0, -1).map((t) => (
                        <SelectItem key={`s-${t}`} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground mt-5 shrink-0" />
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground mb-1 block">Fin</Label>
                  <Select value={endTime} onValueChange={setEndTime}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[250px]">
                      {endTimeOptions.map((t) => (
                        <SelectItem key={`e-${t}`} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {/* Duration summary */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10">
                <Clock className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">
                  {startTime} → {endTime}
                </span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {formatDuration(durationMinutes)}
                </span>
              </div>
            </div>
          )}

          {/* Recurrence */}
          <div className="rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Repeat className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label className="text-sm">Récurrence hebdomadaire</Label>
                  <p className="text-xs text-muted-foreground">Répéter chaque semaine</p>
                </div>
              </div>
              <Switch
                checked={recurrence === "weekly"}
                onCheckedChange={(checked) => {
                  setRecurrence(checked ? "weekly" : "none");
                  if (checked && recurrenceDays.length === 0 && selectedDate) {
                    setRecurrenceDays([getDay(selectedDate)]);
                  }
                }}
              />
            </div>
            {recurrence === "weekly" && (
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
                    ({recurrenceWeeks * Math.max(recurrenceDays.length, 1)} réservations)
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <Label>Notes (optionnel)</Label>
            <Textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="Ajoutez une note pour cette réservation..."
              rows={2}
              className="mt-1.5"
              maxLength={500}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || (bookingType === "hourly" && durationMinutes < 30)}>
            {isSubmitting ? "Création..." : recurrence === "weekly"
              ? `Réserver (${recurrenceWeeks} semaines)`
              : "Réserver"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NewBookingDialog;
