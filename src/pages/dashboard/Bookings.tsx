import { useEffect, useState, useMemo } from "react";
import {
  addDays,
  format,
  startOfWeek,
  isSameDay,
  setHours,
  setMinutes,
  addMinutes,
  isAfter,
  isBefore,
  startOfDay,
} from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Clock, MapPin, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// Generate time slots between start/end with given interval
const generateTimeSlots = (startHour: number, endHour: number, interval: number) => {
  const slots: Date[] = [];
  const base = new Date(2000, 0, 1);
  let current = setMinutes(setHours(base, startHour), 0);
  const end = setMinutes(setHours(base, endHour), 0);
  while (isBefore(current, end)) {
    slots.push(current);
    current = addMinutes(current, interval);
  }
  return slots;
};

const timeSlots = generateTimeSlots(8, 19, 30);

const Bookings = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [rooms, setRooms] = useState<any[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string>("");
  const [bookings, setBookings] = useState<any[]>([]);
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [duration, setDuration] = useState("60");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Generate week days
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  // Fetch rooms
  useEffect(() => {
    const fetchRooms = async () => {
      const { data } = await supabase
        .from("rooms")
        .select("*")
        .eq("is_available", true)
        .order("name");
      setRooms(data || []);
      if (data && data.length > 0 && !selectedRoom) {
        setSelectedRoom(data[0].id);
      }
    };
    fetchRooms();
  }, []);

  // Fetch bookings for selected date & room
  useEffect(() => {
    if (!selectedRoom) return;

    const fetchBookings = async () => {
      const dayStart = startOfDay(selectedDate).toISOString();
      const dayEnd = addDays(startOfDay(selectedDate), 1).toISOString();

      const { data } = await supabase
        .from("bookings")
        .select("*, profiles(first_name, last_name)")
        .eq("room_id", selectedRoom)
        .gte("start_time", dayStart)
        .lt("start_time", dayEnd)
        .neq("status", "cancelled")
        .order("start_time");

      setBookings(data || []);
    };

    fetchBookings();
  }, [selectedDate, selectedRoom]);

  // Check if a slot is booked
  const isSlotBooked = (slot: Date) => {
    const slotTime = setMinutes(
      setHours(selectedDate, slot.getHours()),
      slot.getMinutes()
    );
    return bookings.some((b: any) => {
      const start = new Date(b.start_time);
      const end = new Date(b.end_time);
      return (
        (isAfter(slotTime, start) || isSameDay(slotTime, start) && slotTime.getHours() === start.getHours() && slotTime.getMinutes() === start.getMinutes()) &&
        isBefore(slotTime, end)
      );
    });
  };

  // Get booking at slot
  const getBookingAtSlot = (slot: Date) => {
    const slotTime = setMinutes(
      setHours(selectedDate, slot.getHours()),
      slot.getMinutes()
    );
    return bookings.find((b: any) => {
      const start = new Date(b.start_time);
      return start.getHours() === slotTime.getHours() && start.getMinutes() === slotTime.getMinutes();
    });
  };

  const handleSlotClick = (slot: Date) => {
    if (isSlotBooked(slot)) return;
    setSelectedSlot(slot);
    setShowNewBooking(true);
  };

  const handleCreateBooking = async () => {
    if (!profile || !selectedSlot || !selectedRoom) return;
    setIsSubmitting(true);

    const startTime = setMinutes(
      setHours(new Date(selectedDate), selectedSlot.getHours()),
      selectedSlot.getMinutes()
    );
    const endTime = addMinutes(startTime, parseInt(duration));

    const { error } = await supabase.from("bookings").insert({
      practitioner_id: profile.id,
      room_id: selectedRoom,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      notes,
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de créer la réservation.",
      });
    } else {
      toast({ title: "Réservation créée !", description: "En attente de confirmation." });
      setShowNewBooking(false);
      setNotes("");
      // Refresh bookings
      const dayStart = startOfDay(selectedDate).toISOString();
      const dayEnd = addDays(startOfDay(selectedDate), 1).toISOString();
      const { data } = await supabase
        .from("bookings")
        .select("*, profiles(first_name, last_name)")
        .eq("room_id", selectedRoom)
        .gte("start_time", dayStart)
        .lt("start_time", dayEnd)
        .neq("status", "cancelled")
        .order("start_time");
      setBookings(data || []);
    }

    setIsSubmitting(false);
  };

  const isPastDate = isBefore(startOfDay(selectedDate), startOfDay(new Date()));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Room selector */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold">Réserver une salle</h2>
            <p className="text-muted-foreground text-sm mt-0.5">
              Sélectionnez une date et un créneau pour réserver.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedRoom} onValueChange={setSelectedRoom}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Choisir une salle" />
              </SelectTrigger>
              <SelectContent>
                {rooms.map((room: any) => (
                  <SelectItem key={room.id} value={room.id}>
                    {room.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Horizontal date picker (Riva.care style) */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setWeekStart(addDays(weekStart, -7))}
                className="p-2 rounded-lg hover:bg-accent transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h3 className="font-display font-semibold text-lg">
                {format(weekStart, "MMMM yyyy", { locale: fr })}
              </h3>
              <button
                onClick={() => setWeekStart(addDays(weekStart, 7))}
                className="p-2 rounded-lg hover:bg-accent transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-2">
              {weekDays.map((day) => {
                const isSelected = isSameDay(day, selectedDate);
                const isToday = isSameDay(day, new Date());
                const isPast = isBefore(day, startOfDay(new Date()));

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(day)}
                    disabled={isPast}
                    className={cn(
                      "flex flex-col items-center py-3 px-2 rounded-xl transition-all text-center",
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-md"
                        : isToday
                        ? "bg-accent text-accent-foreground"
                        : isPast
                        ? "opacity-40 cursor-not-allowed"
                        : "hover:bg-muted cursor-pointer"
                    )}
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-wider">
                      {format(day, "EEE", { locale: fr })}
                    </span>
                    <span className="text-2xl font-bold mt-1">
                      {format(day, "d")}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Time slots grid */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-display text-base">
                {format(selectedDate, "EEEE d MMMM", { locale: fr })}
              </CardTitle>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-accent border border-border" />
                  Disponible
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-primary/20 border border-primary/30" />
                  Réservé
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isPastDate ? (
              <p className="text-muted-foreground text-sm text-center py-8">
                Impossible de réserver dans le passé.
              </p>
            ) : rooms.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">
                Aucune salle disponible.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {timeSlots.map((slot) => {
                  const booked = isSlotBooked(slot);
                  const booking = getBookingAtSlot(slot);
                  const timeStr = format(slot, "HH:mm");

                  return (
                    <button
                      key={timeStr}
                      onClick={() => handleSlotClick(slot)}
                      disabled={booked}
                      className={cn(
                        "relative flex flex-col items-center justify-center py-4 px-3 rounded-xl border transition-all",
                        booked
                          ? "bg-primary/10 border-primary/20 cursor-not-allowed"
                          : "bg-card border-border hover:border-primary hover:shadow-sm cursor-pointer"
                      )}
                    >
                      <Clock className={cn("h-4 w-4 mb-1", booked ? "text-primary/50" : "text-muted-foreground")} />
                      <span className={cn("font-semibold text-sm", booked ? "text-primary/60" : "")}>
                        {timeStr}
                      </span>
                      {booking && (
                        <span className="text-[10px] text-primary/60 mt-1 truncate max-w-full">
                          {booking.profiles?.first_name} {booking.profiles?.last_name?.[0]}.
                        </span>
                      )}
                      {!booked && (
                        <Plus className="h-3 w-3 text-muted-foreground mt-1 opacity-0 group-hover:opacity-100" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* New booking dialog */}
      <Dialog open={showNewBooking} onOpenChange={setShowNewBooking}>
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
                <p className="text-xs text-muted-foreground">
                  {rooms.find((r: any) => r.id === selectedRoom)?.name}
                </p>
              </div>
            </div>

            <div>
              <Label>Durée</Label>
              <Select value={duration} onValueChange={setDuration}>
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
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ajoutez une note pour cette réservation..."
                rows={3}
                className="mt-1.5"
                maxLength={500}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewBooking(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateBooking} disabled={isSubmitting}>
              {isSubmitting ? "Création..." : "Réserver"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Bookings;
