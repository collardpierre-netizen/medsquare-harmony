import { useState, useEffect } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Clock, MapPin, User, Pencil, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

const TIME_OPTIONS = Array.from({ length: 24 }, (_, h) =>
  [0, 30].map((m) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`)
).flat();

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

  const [roomId, setRoomId] = useState("");
  const [practitionerId, setPractitionerId] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [status, setStatus] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (booking) {
      const start = new Date(booking.start_time);
      const end = new Date(booking.end_time);
      // Format in Brussels timezone
      const fmt = (d: Date, f: string) =>
        new Intl.DateTimeFormat("fr-BE", {
          timeZone: "Europe/Brussels",
          ...(f === "date"
            ? { year: "numeric", month: "2-digit", day: "2-digit" }
            : { hour: "2-digit", minute: "2-digit", hour12: false }),
        }).format(d);

      // Parse Brussels date parts
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
    const { error } = await supabase
      .from("bookings")
      .update({
        room_id: roomId,
        practitioner_id: practitionerId,
        start_time: newStart.toISOString(),
        end_time: newEnd.toISOString(),
        status,
        notes: notes || null,
      })
      .eq("id", booking.id);

    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Réservation mise à jour ✓" });
      onOpenChange(false);
      onSaved();
    }
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
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="mr-auto" disabled={deleting}>
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
