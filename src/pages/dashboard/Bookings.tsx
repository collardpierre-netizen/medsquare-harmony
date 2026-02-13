import { useEffect, useState } from "react";
import { addDays, addMinutes, addWeeks, setHours, setMinutes, startOfDay, startOfWeek, getDay } from "date-fns";
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
import CancelBookingDialog from "@/components/dashboard/bookings/CancelBookingDialog";
import WeeklyOverview from "@/components/dashboard/bookings/WeeklyOverview";
import ActivityDetailDialog from "@/components/dashboard/bookings/ActivityDetailDialog";
import { getOpeningHours, type Booking, type ActivitySessionSlot } from "@/components/dashboard/bookings/utils";
import type { BookingType, RecurrenceType } from "@/components/dashboard/bookings/NewBookingDialog";

type ViewMode = "day" | "week";

const Bookings = () => {
  const { profile, isAdmin } = useAuth();
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
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [futureBookingsCount, setFutureBookingsCount] = useState(0);
  const [isCancelling, setIsCancelling] = useState(false);
  const [practitioners, setPractitioners] = useState<Array<{ id: string; first_name: string; last_name: string }>>([]);
  const [activitySessions, setActivitySessions] = useState<ActivitySessionSlot[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<ActivitySessionSlot | null>(null);
  const [showActivityDetail, setShowActivityDetail] = useState(false);

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

  // Fetch practitioners (admin only)
  useEffect(() => {
    if (!isAdmin) return;
    const fetchPractitioners = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .eq("is_active", true)
        .order("last_name");
      setPractitioners(data || []);
    };
    fetchPractitioners();
  }, [isAdmin]);

  // Fetch bookings for selected date & room (day view)
  useEffect(() => {
    if (!selectedRoom || viewMode !== "day") return;

    const fetchDayData = async () => {
      const dayStart = startOfDay(selectedDate).toISOString();
      const dayEnd = addDays(startOfDay(selectedDate), 1).toISOString();

      const [{ data: bookingsData }, { data: sessionsData }] = await Promise.all([
        supabase
          .from("bookings")
          .select("*, profiles(first_name, last_name)")
          .eq("room_id", selectedRoom)
          .gte("start_time", dayStart)
          .lt("start_time", dayEnd)
          .neq("status", "cancelled")
          .order("start_time"),
        supabase
          .from("activity_sessions")
          .select("*, activities(title, category, profiles(first_name, last_name))")
          .eq("room_id", selectedRoom)
          .gte("start_time", dayStart)
          .lt("start_time", dayEnd)
          .eq("status", "scheduled")
          .order("start_time"),
      ]);

      setBookings((bookingsData as Booking[]) || []);
      setActivitySessions((sessionsData as ActivitySessionSlot[]) || []);
    };

    fetchDayData();
  }, [selectedDate, selectedRoom, viewMode]);

  const handleSlotClick = (slot: Date) => {
    setSelectedSlot(slot);
    setShowNewBooking(true);
  };

  const handleActivityClick = (session: ActivitySessionSlot) => {
    setSelectedActivity(session);
    setShowActivityDetail(true);
  };

  const handleDayClickFromWeek = (day: Date) => {
    setSelectedDate(day);
    setViewMode("day");
  };

  const refreshBookings = async () => {
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

  const handleCreateBooking = async (options: {
    bookingType: BookingType;
    recurrence: RecurrenceType;
    recurrenceWeeks: number;
    practitionerId?: string;
  }) => {
    if (!profile || !selectedSlot || !selectedRoom) return;
    setIsSubmitting(true);
    const targetPractitionerId = options.practitionerId || profile.id;

    const { bookingType, recurrence, recurrenceWeeks } = options;
    const { start: openStart, end: openEnd } = getOpeningHours(selectedDate);

    // Calculate how many bookings to create
    const count = recurrence === "weekly" ? recurrenceWeeks : 1;
    const insertRows: any[] = [];
    const bookingsToCreate: Array<{ startTime: Date; endTime: Date; week: number }> = [];

    for (let i = 0; i < count; i++) {
      const baseDate = addWeeks(selectedDate, i);

      let startTime: Date;
      let endTime: Date;

      if (bookingType === "full_day") {
        // Full day: use opening hours for that specific day
        const dayHours = getOpeningHours(baseDate);
        startTime = setMinutes(setHours(new Date(baseDate), dayHours.start), 0);
        endTime = setMinutes(setHours(new Date(baseDate), dayHours.end), 0);
      } else {
        // Hourly
        startTime = setMinutes(
          setHours(new Date(baseDate), selectedSlot.getHours()),
          selectedSlot.getMinutes()
        );
        endTime = addMinutes(startTime, parseInt(duration));
      }

      bookingsToCreate.push({ startTime, endTime, week: i + 1 });
      insertRows.push({
        practitioner_id: targetPractitionerId,
        room_id: selectedRoom,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        notes: notes || null,
      });
    }

    // Check for conflicts
    const conflicts: Array<{ week: number; conflictingBooking: any }> = [];

    for (const booking of bookingsToCreate) {
      const { data: existingBookings } = await supabase
        .from("bookings")
        .select("*")
        .eq("room_id", selectedRoom)
        .neq("status", "cancelled")
        .gte("end_time", booking.startTime.toISOString())
        .lte("start_time", booking.endTime.toISOString());

      if (existingBookings && existingBookings.length > 0) {
        conflicts.push({
          week: booking.week,
          conflictingBooking: existingBookings[0],
        });
      }
    }

    if (conflicts.length > 0) {
      const conflictDetails = conflicts
        .map(
          (c) =>
            `Semaine ${c.week}: ${new Date(c.conflictingBooking.start_time).toLocaleDateString("fr-FR")} ${new Date(c.conflictingBooking.start_time).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
        )
        .join("\n");

      toast({
        variant: "destructive",
        title: "Conflit de réservation détecté",
        description:
          conflicts.length === 1
            ? `Créneau déjà réservé: ${conflictDetails}`
            : `${conflicts.length} créneaux sont déjà réservés:\n${conflictDetails}`,
      });
      setIsSubmitting(false);
      return;
    }

    const { error } = await supabase.from("bookings").insert(insertRows);

    if (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de créer la réservation.",
      });
    } else {
      const label = count > 1
        ? `${count} réservations créées !`
        : "Réservation créée !";
      toast({ title: label, description: "En attente de confirmation." });
      setShowNewBooking(false);
      setNotes("");
      await refreshBookings();
    }

    setIsSubmitting(false);
  };

  const handleBookingClick = async (booking: Booking) => {
    setSelectedBooking(booking);

    // Find future recurring bookings: same room, same practitioner, same day of week, same start hour
    const bookingStart = new Date(booking.start_time);
    const dayOfWeek = getDay(bookingStart);
    const startHour = bookingStart.getHours();
    const startMinute = bookingStart.getMinutes();

    const { data: futureBookings } = await supabase
      .from("bookings")
      .select("id, start_time")
      .eq("room_id", booking.room_id)
      .eq("practitioner_id", booking.practitioner_id)
      .neq("status", "cancelled")
      .gte("start_time", bookingStart.toISOString());

    // Filter to same day-of-week and same start time
    const matching = (futureBookings || []).filter((b) => {
      const s = new Date(b.start_time);
      return getDay(s) === dayOfWeek && s.getHours() === startHour && s.getMinutes() === startMinute;
    });

    setFutureBookingsCount(matching.length);
    setShowCancelDialog(true);
  };

  const handleCancelSingle = async () => {
    if (!selectedBooking) return;
    setIsCancelling(true);

    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", selectedBooking.id);

    if (error) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible d'annuler la réservation." });
    } else {
      toast({ title: "Réservation annulée", description: "La réservation a été annulée." });
      setShowCancelDialog(false);
      setSelectedBooking(null);
      await refreshBookings();
    }
    setIsCancelling(false);
  };

  const handleCancelAllFuture = async () => {
    if (!selectedBooking) return;
    setIsCancelling(true);

    const bookingStart = new Date(selectedBooking.start_time);
    const dayOfWeek = getDay(bookingStart);
    const startHour = bookingStart.getHours();
    const startMinute = bookingStart.getMinutes();

    // Fetch all future matching bookings
    const { data: futureBookings } = await supabase
      .from("bookings")
      .select("id, start_time")
      .eq("room_id", selectedBooking.room_id)
      .eq("practitioner_id", selectedBooking.practitioner_id)
      .neq("status", "cancelled")
      .gte("start_time", bookingStart.toISOString());

    const matchingIds = (futureBookings || [])
      .filter((b) => {
        const s = new Date(b.start_time);
        return getDay(s) === dayOfWeek && s.getHours() === startHour && s.getMinutes() === startMinute;
      })
      .map((b) => b.id);

    if (matchingIds.length === 0) {
      setIsCancelling(false);
      return;
    }

    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .in("id", matchingIds);

    if (error) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible d'annuler les réservations." });
    } else {
      toast({ title: `${matchingIds.length} réservations annulées`, description: "Toutes les occurrences futures ont été annulées." });
      setShowCancelDialog(false);
      setSelectedBooking(null);
      await refreshBookings();
    }
    setIsCancelling(false);
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

        {/* Date picker */}
        <WeekDatePicker
          weekStart={weekStart}
          selectedDate={selectedDate}
          onWeekChange={setWeekStart}
          onDateSelect={(day) => {
            setSelectedDate(day);
          }}
        />

        {/* View content */}
        {viewMode === "week" ? (
          <WeeklyOverview
            weekStart={weekStart}
            selectedRoom={selectedRoom}
            rooms={rooms}
            onSlotClick={handleDayClickFromWeek}
            onActivityClick={handleActivityClick}
          />
        ) : (
          <TimeSlotsGrid
            selectedDate={selectedDate}
            bookings={bookings}
            activitySessions={activitySessions}
            rooms={rooms}
            onSlotClick={handleSlotClick}
            onBookingClick={handleBookingClick}
            onActivityClick={handleActivityClick}
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
        isAdmin={isAdmin}
        practitioners={practitioners}
        currentProfileId={profile?.id}
      />

      {/* Cancel booking dialog */}
      <CancelBookingDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        booking={selectedBooking}
        futureCount={futureBookingsCount}
        isCancelling={isCancelling}
        onCancelSingle={handleCancelSingle}
        onCancelAllFuture={handleCancelAllFuture}
      />

      {/* Activity detail dialog */}
      <ActivityDetailDialog
        open={showActivityDetail}
        onOpenChange={setShowActivityDetail}
        session={selectedActivity}
        roomName={roomName}
      />
    </DashboardLayout>
  );
};

export default Bookings;
