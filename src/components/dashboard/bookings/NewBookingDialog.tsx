import { useState } from "react";
import { format, isWeekend } from "date-fns";
import { fr } from "date-fns/locale";
import { Clock, CalendarDays, Repeat } from "lucide-react";
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
  onSubmit: (options: { bookingType: BookingType; recurrence: RecurrenceType; recurrenceWeeks: number }) => void;
  isSubmitting: boolean;
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
}: NewBookingDialogProps) => {
  const [bookingType, setBookingType] = useState<BookingType>("hourly");
  const [recurrence, setRecurrence] = useState<RecurrenceType>("none");
  const [recurrenceWeeks, setRecurrenceWeeks] = useState(4);

  const { start, end } = getOpeningHours(selectedDate);
  const isWE = isWeekend(selectedDate);

  const handleSubmit = () => {
    onSubmit({ bookingType, recurrence, recurrenceWeeks });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!v) {
        setBookingType("hourly");
        setRecurrence("none");
        setRecurrenceWeeks(4);
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
            <Clock className="h-5 w-5 text-accent-foreground shrink-0" />
            <div>
              <p className="font-semibold text-sm">
                {selectedSlot && format(selectedSlot, "HH:mm")}
                {" — "}
                {format(selectedDate, "EEEE d MMMM", { locale: fr })}
              </p>
              <p className="text-xs text-muted-foreground">
                {roomName} • Horaires : {start}h–{end}h {isWE ? "(week-end)" : "(semaine)"}
              </p>
            </div>
          </div>

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

          {/* Duration (only for hourly) */}
          {bookingType === "hourly" && (
            <div>
              <Label>Durée</Label>
              <Select value={duration} onValueChange={onDurationChange}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="60">1 heure</SelectItem>
                  <SelectItem value="120">2 heures</SelectItem>
                  <SelectItem value="180">3 heures</SelectItem>
                  <SelectItem value="240">4 heures</SelectItem>
                  <SelectItem value="300">5 heures</SelectItem>
                  <SelectItem value="360">6 heures</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Recurrence */}
          <div className="rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Repeat className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label className="text-sm">Récurrence hebdomadaire</Label>
                  <p className="text-xs text-muted-foreground">Répéter chaque semaine le même jour</p>
                </div>
              </div>
              <Switch
                checked={recurrence === "weekly"}
                onCheckedChange={(checked) => setRecurrence(checked ? "weekly" : "none")}
              />
            </div>
            {recurrence === "weekly" && (
              <div className="flex items-center gap-3 pt-1">
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
                  ({recurrenceWeeks} réservations)
                </span>
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
          <Button onClick={handleSubmit} disabled={isSubmitting}>
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
