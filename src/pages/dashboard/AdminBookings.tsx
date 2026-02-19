import { useEffect, useState } from "react";
import { CalendarCheck, CheckCircle, XCircle, Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
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

const AdminBookings = () => {
  const { toast } = useToast();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "confirmed" | "cancelled">("all");

  // New booking dialog
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [practitioners, setPractitioners] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [newBooking, setNewBooking] = useState({
    practitioner_id: "",
    room_id: "",
    date: "",
    start_time: "08:00",
    end_time: "09:00",
    notes: "",
    status: "confirmed",
  });

  const fetchBookings = async () => {
    let query = supabase
      .from("bookings")
      .select("*, profiles(first_name, last_name), rooms(name)")
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

  useEffect(() => {
    fetchBookings();
  }, [filter]);

  useEffect(() => {
    fetchResources();
  }, []);

  const handleCreateBooking = async () => {
    const { practitioner_id, room_id, date, start_time, end_time, notes, status } = newBooking;

    if (!practitioner_id || !room_id || !date || !start_time || !end_time) {
      toast({ title: "Champs requis manquants", description: "Praticien, salle, date et horaires sont obligatoires.", variant: "destructive" });
      return;
    }

    const start = new Date(`${date}T${start_time}:00`);
    const end = new Date(`${date}T${end_time}:00`);

    if (end <= start) {
      toast({ title: "Horaire invalide", description: "L'heure de fin doit être après l'heure de début.", variant: "destructive" });
      return;
    }

    setCreating(true);
    const { error } = await supabase.from("bookings").insert({
      practitioner_id,
      room_id,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      notes: notes || null,
      status,
    });

    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Réservation créée !" });
      setNewBooking({ practitioner_id: "", room_id: "", date: "", start_time: "08:00", end_time: "09:00", notes: "", status: "confirmed" });
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
        if (result.sent) {
          console.log("Email notification sent");
        } else if (result.skipped) {
          console.log("Email notification skipped:", result.reason);
        }
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
        return <Badge variant="secondary" className="bg-yellow-50 text-yellow-700 border-yellow-200">En attente</Badge>;
      case "cancelled":
        return <Badge variant="secondary" className="bg-red-50 text-red-600 border-red-200">Annulée</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const TIME_OPTIONS = Array.from({ length: 24 }, (_, h) =>
    [0, 30].map((m) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`)
  ).flat();

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

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle réservation
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Créer une réservation</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Praticien *</Label>
                  <Select value={newBooking.practitioner_id} onValueChange={(v) => setNewBooking((b) => ({ ...b, practitioner_id: v }))}>
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

                <div className="space-y-2">
                  <Label>Date *</Label>
                  <Input
                    type="date"
                    value={newBooking.date}
                    onChange={(e) => setNewBooking((b) => ({ ...b, date: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Heure de début *</Label>
                    <Select value={newBooking.start_time} onValueChange={(v) => setNewBooking((b) => ({ ...b, start_time: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_OPTIONS.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Heure de fin *</Label>
                    <Select value={newBooking.end_time} onValueChange={(v) => setNewBooking((b) => ({ ...b, end_time: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_OPTIONS.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Statut initial</Label>
                  <Select value={newBooking.status} onValueChange={(v) => setNewBooking((b) => ({ ...b, status: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="confirmed">Confirmée directement</SelectItem>
                      <SelectItem value="pending">En attente de validation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

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
                  {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                  Créer la réservation
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {(["all", "pending", "confirmed", "cancelled"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {f === "all"
                ? "Toutes"
                : f === "pending"
                ? "En attente"
                : f === "confirmed"
                ? "Confirmées"
                : "Annulées"}
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
                        <Button
                          size="sm"
                          onClick={() => updateStatus(booking.id, "confirmed")}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Confirmer
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateStatus(booking.id, "cancelled")}
                        >
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
