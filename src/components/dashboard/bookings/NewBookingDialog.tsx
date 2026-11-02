import { useState, useMemo, useEffect } from "react";
import { format, getDay } from "date-fns";
import { fr } from "date-fns/locale";
import { Clock, CalendarDays, Repeat, ArrowRight, Check } from "lucide-react";
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
  /** rooms.opening_hours de la salle concernée. */
  openingHours?: unknown;
}

/** Visual time pill grid — user taps a pill to pick a time */
const TimePillGrid = ({
  options,
  value,
  onChange,
  label,
  disabledBefore,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  label: string;
  disabledBefore?: string;
}) => {
  const disabledMin = disabledBefore ? timeToMinutes(disabledBefore) : -1;

  return (
    <div>
      <Label className="text-xs text-muted-foreground mb-1.5 block">{label}</Label>
      <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
        {options.map((t) => {
          const isDisabled = timeToMinutes(t) <= disabledMin;
          const isSelected = t === value;
          return (
            <button
              key={t}
              type="button"
              disabled={isDisabled}
              onClick={() => onChange(t)}
              className={cn(
                "relative py-2 px-1 rounded-lg text-sm font-medium transition-all border text-center",
                isSelected
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : isDisabled
                  ? "bg-muted/50 text-muted-foreground/40 border-transparent cursor-not-allowed"
                  : "bg-card border-border hover:border-primary hover:bg-primary/5 cursor-pointer"
              )}
            >
              {t}
              {isSelected && (
                <Check className="absolute top-0.5 right-0.5 h-3 w-3" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

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
  openingHours,
}: NewBookingDialogProps) => {
  const [bookingType, setBookingType] = useState<BookingType>("hourly");
  const [recurrence, setRecurrence] = useState<RecurrenceType>("none");
  const [recurrenceWeeks, setRecurrenceWeeks] = useState(4);
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [selectedPractitioner, setSelectedPractitioner] = useState<string>("");

  const { start, end, closed: isClosedDay } = getOpeningHours(selectedDate, openingHours);

  // Time options
  const allTimeOptions = useMemo(() => generateTimeOptions(start, end), [start, end]);

  // Start time derived from selectedSlot
  const initialStartTime = selectedSlot
    ? `${String(selectedSlot.getHours()).padStart(2, "0")}:${String(selectedSlot.getMinutes()).padStart(2, "0")}`
    : allTimeOptions[0] || "08:00";

  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState("");
  // Step: 1 = pick start, 2 = pick end
  const [step, setStep] = useState<1 | 2>(2);

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
      setStep(2); // Start already picked from grid click, go to end
    }
  }, [open, selectedSlot, end]);

  // Start time options (all except last)
  const startTimeOptions = useMemo(() => allTimeOptions.slice(0, -1), [allTimeOptions]);

  // End time options (must be after start time)
  const endTimeOptions = useMemo(() => {
    return allTimeOptions.filter((t) => timeToMinutes(t) > timeToMinutes(startTime));
  }, [startTime, allTimeOptions]);

  // Auto-adjust end time if it's before start
  useEffect(() => {
    if (endTime && timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      const nextOptions = endTimeOptions;
      if (nextOptions.length > 0) {
        const startMin = timeToMinutes(startTime);
        const idealEnd = startMin + 60;
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

  const handleStartChange = (t: string) => {
    setStartTime(t);
    setStep(2);
  };

  const handleSubmit = () => {
    const [sH, sM] = startTime.split(":").map(Number);
    const [eH, eM] = endTime.split(":").map(Number);
    onSubmit({
      bookingType,
      recurrence,
      recurrenceWeeks,
      recurrenceDays,
      practitionerId: isAdmin && selectedPractitioner ? selectedPractitioner : undefined,
      startHour: sH,
      startMinute: sM,
      endHour: eH,
      endMinute: eM,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!v) {
        setBookingType("hourly");
        setRecurrence("none");
        setRecurrenceWeeks(4);
        setSelectedPractitioner("");
        setStep(2);
      }
      onOpenChange(v);
    }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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
                {roomName} • {isClosedDay ? "Fermé ce jour-là" : `Horaires : ${start}h–${end}h`}
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

          {/* Start & End time as pill grids (only for hourly) */}
          {bookingType === "hourly" && (
            <div className="space-y-4">
              {/* Step indicator */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                    step === 1
                      ? "bg-primary text-primary-foreground"
                      : "bg-primary/10 text-primary"
                  )}
                >
                  <span className="w-4 h-4 rounded-full bg-primary-foreground/20 flex items-center justify-center text-[10px]">1</span>
                  Début : {startTime}
                </button>
                <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                    step === 2
                      ? "bg-primary text-primary-foreground"
                      : endTime ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}
                >
                  <span className="w-4 h-4 rounded-full bg-primary-foreground/20 flex items-center justify-center text-[10px]">2</span>
                  Fin : {endTime || "—"}
                </button>
              </div>

              {/* Time pill grid */}
              {step === 1 ? (
                <TimePillGrid
                  options={startTimeOptions}
                  value={startTime}
                  onChange={handleStartChange}
                  label="👆 Choisissez l'heure de début"
                />
              ) : (
                <TimePillGrid
                  options={endTimeOptions}
                  value={endTime}
                  onChange={setEndTime}
                  label="👆 Choisissez l'heure de fin"
                  disabledBefore={startTime}
                />
              )}

              {/* Duration summary */}
              {startTime && endTime && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-primary/5 border border-primary/10">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-primary">
                    {startTime} → {endTime}
                  </span>
                  <span className="text-xs font-medium text-primary/70 ml-auto px-2 py-0.5 rounded-full bg-primary/10">
                    {formatDuration(durationMinutes)}
                  </span>
                </div>
              )}
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
          <Button onClick={handleSubmit} disabled={isSubmitting || isClosedDay || (bookingType === "hourly" && durationMinutes < 30)}>
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