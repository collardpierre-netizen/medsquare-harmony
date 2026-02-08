import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Clock } from "lucide-react";
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
  onSubmit: () => void;
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Nouvelle réservation</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-accent">
            <Clock className="h-5 w-5 text-accent-foreground" />
            <div>
              <p className="font-semibold text-sm">
                {selectedSlot && format(selectedSlot, "HH:mm")}
                {" — "}
                {format(selectedDate, "EEEE d MMMM", { locale: fr })}
              </p>
              <p className="text-xs text-muted-foreground">{roomName}</p>
            </div>
          </div>

          <div>
            <Label>Durée</Label>
            <Select value={duration} onValueChange={onDurationChange}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="60">1 heure</SelectItem>
                <SelectItem value="90">1h30</SelectItem>
                <SelectItem value="120">2 heures</SelectItem>
                <SelectItem value="180">3 heures</SelectItem>
                <SelectItem value="240">4 heures</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Notes (optionnel)</Label>
            <Textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="Ajoutez une note pour cette réservation..."
              rows={3}
              className="mt-1.5"
              maxLength={500}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Création..." : "Réserver"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NewBookingDialog;
