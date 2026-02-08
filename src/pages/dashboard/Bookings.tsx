import { useEffect, useState } from "react";
import { addDays, addMinutes, setHours, setMinutes, startOfDay, startOfWeek } from "date-fns";
import { MapPin, CalendarDays, LayoutGrid } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import WeekDatePicker from "@/components/dashboard/bookings/WeekDatePicker";
import TimeSlotsGrid from "@/components/dashboard/bookings/TimeSlotsGrid";
import NewBookingDialog from "@/components/dashboard/bookings/NewBookingDialog";
import WeeklyOverview from "@/components/dashboard/bookings/WeeklyOverview";
import type { Booking } from "@/components/dashboard/bookings/utils";

type ViewMode = "day" | "week";

const Bookings = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [rooms, setRooms] = useState<any[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string>("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [duration, setDuration] = useState("60");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("week");

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

  // Fetch bookings for selected date & room (day view)
  useEffect(() => {
    if (!selectedRoom || viewMode !== "day") return;

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

      setBookings((data as Booking[]) || []);
    };

    fetchBookings();
  }, [selectedDate, selectedRoom, viewMode]);

  const handleSlotClick = (slot: Date) => {
    setSelectedSlot(slot);
    setShowNewBooking(true);
  };

  const handleDayClickFromWeek = (day: Date) => {
    setSelectedDate(day);
    setViewMode("day");
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
      setBookings((data as Booking[]) || []);
    }

    setIsSubmitting(false);
  };

  const roomName = rooms.find((r: any) => r.id === selectedRoom)?.name || "";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header with room selector and view toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold">Réserver une salle</h2>
            <p className="text-muted-foreground text-sm mt-0.5">
              Consultez les disponibilités et réservez un créneau.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* View toggle */}
            <div className="flex items-center bg-muted rounded-lg p-1">
              <button
                onClick={() => setViewMode("week")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                  viewMode === "week"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Semaine
              </button>
              <button
                onClick={() => setViewMode("day")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                  viewMode === "day"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Jour
              </button>
            </div>

            <div className="h-6 w-px bg-border" />

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

        {/* Date picker (shared for both views) */}
        <WeekDatePicker
          weekStart={weekStart}
          selectedDate={selectedDate}
          onWeekChange={setWeekStart}
          onDateSelect={(day) => {
            setSelectedDate(day);
            if (viewMode === "week") {
              // Stay in week view, just highlight
            }
          }}
        />

        {/* View content */}
        {viewMode === "week" ? (
          <WeeklyOverview
            weekStart={weekStart}
            selectedRoom={selectedRoom}
            rooms={rooms}
            onSlotClick={handleDayClickFromWeek}
          />
        ) : (
          <TimeSlotsGrid
            selectedDate={selectedDate}
            bookings={bookings}
            rooms={rooms}
            onSlotClick={handleSlotClick}
          />
        )}
      </div>

      {/* New booking dialog */}
      <NewBookingDialog
        open={showNewBooking}
        onOpenChange={setShowNewBooking}
        selectedSlot={selectedSlot}
        selectedDate={selectedDate}
        roomName={roomName}
        duration={duration}
        onDurationChange={setDuration}
        notes={notes}
        onNotesChange={setNotes}
        onSubmit={handleCreateBooking}
        isSubmitting={isSubmitting}
      />
    </DashboardLayout>
  );
};

export default Bookings;
