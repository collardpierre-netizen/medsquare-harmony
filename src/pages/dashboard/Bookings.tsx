import { useEffect, useState } from "react";
import { addDays, addWeeks, setHours, setMinutes, startOfDay, startOfWeek, getDay } from "date-fns";
import { MapPin, CalendarDays, LayoutGrid, User, Building2, Columns3, BarChart3 } from "lucide-react";
import { useSearchParams } from "react-router-dom";
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
import MyPlanningView from "@/components/dashboard/bookings/MyPlanningView";
import AllRoomsOverview from "@/components/dashboard/bookings/AllRoomsOverview";
import { getOpeningHours, type Booking, type ActivitySessionSlot } from "@/components/dashboard/bookings/utils";
import { checkWithinOpeningHours, describeOpeningHoursViolation } from "@/lib/roomOpeningHours";
import MyRoomsView from "@/components/dashboard/bookings/MyRoomsView";
import type { BookingType, RecurrenceType } from "@/components/dashboard/bookings/NewBookingDialog";

type ViewMode = "day" | "week";
type PlanningMode = "my-planning" | "by-room" | "all-rooms" | "occupation";

const Bookings = () => {
  const { profile, isAdmin } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const roomFromUrl = searchParams.get("room");
  const dateFromUrl = searchParams.get("date");
  const hourFromUrl = searchParams.get("hour");
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
  const [recurrenceGroupCount, setRecurrenceGroupCount] = useState(0);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [practitioners, setPractitioners] = useState<Array<{ id: string; first_name: string; last_name: string }>>([]);
  const [activitySessions, setActivitySessions] = useState<ActivitySessionSlot[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<ActivitySessionSlot | null>(null);
  const [showActivityDetail, setShowActivityDetail] = useState(false);
  const [planningMode, setPlanningMode] = useState<PlanningMode>("my-planning");

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
        const initialRoom = roomFromUrl && data.some((r: any) => r.id === roomFromUrl)
          ? roomFromUrl
          : data[0].id;
        setSelectedRoom(initialRoom);
      }
    };
    fetchRooms();
  }, []);

  // Auto-open booking dialog from occupation view shortcut
  useEffect(() => {
    if (!dateFromUrl || !hourFromUrl || !roomFromUrl || rooms.length === 0) return;
    const targetRoom = rooms.find((r: any) => r.id === roomFromUrl);
    if (!targetRoom) return;
    const date = new Date(dateFromUrl);
    const hour = parseInt(hourFromUrl, 10);
    if (isNaN(hour) || isNaN(date.getTime())) return;
    setSelectedRoom(roomFromUrl);
    setSelectedDate(date);
    setPlanningMode("by-room");
    const slotDate = setMinutes(setHours(date, hour), 0);
    setSelectedSlot(slotDate);
    setShowNewBooking(true);
    // Clear params to avoid re-triggering
    setSearchParams({}, { replace: true });
  }, [rooms, dateFromUrl, hourFromUrl, roomFromUrl]);

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
    recurrenceDays: number[];
    practitionerId?: string;
    startHour: number;
    startMinute: number;
    endHour: number;
    endMinute: number;
  }) => {
    if (!profile || !selectedRoom) return;
    setIsSubmitting(true);
    const targetPractitionerId = options.practitionerId || profile.id;

    // Check privatization restriction: if room is privatized and assigned to someone else, block
    const targetRoom = rooms.find((r: any) => r.id === selectedRoom);
    if (targetRoom) {
      const { canPractitionerBookOnDay } = await import("@/lib/roomPrivatization");
      // Use selected date as proxy day (all bookings created on/around it)
      if (!canPractitionerBookOnDay(targetRoom, targetPractitionerId, selectedDate)) {
        toast({
          variant: "destructive",
          title: "Cabinet privatisé",
          description: targetRoom.assigned_practitioner_id
            ? "Ce cabinet est privatisé pour un autre praticien sur cette période."
            : "Ce cabinet est privatisé et n'est réservable par personne sur cette période.",
        });
        setIsSubmitting(false);
        return;
      }
    }

    const { bookingType, recurrence, recurrenceWeeks, recurrenceDays, startHour, startMinute, endHour, endMinute } = options;
    const roomOpeningHours = rooms.find((r: any) => r.id === selectedRoom)?.opening_hours;
    const { start: openStart, end: openEnd } = getOpeningHours(selectedDate, roomOpeningHours);

    const insertRows: any[] = [];
    const bookingsToCreate: Array<{ startTime: Date; endTime: Date; week: number }> = [];

    if (recurrence === "weekly" && recurrenceDays.length > 0) {
      // Multi-day recurrence
      const groupId = crypto.randomUUID();
      const selectedDayOfWeek = selectedDate.getDay();

      for (let w = 0; w < recurrenceWeeks; w++) {
        for (const dayNum of recurrenceDays) {
          let dayOffset = dayNum - selectedDayOfWeek;
          if (dayOffset < 0) dayOffset += 7;

          const baseDate = addDays(addWeeks(selectedDate, w), dayOffset);
          let startTime: Date;
          let endTime: Date;

          if (bookingType === "full_day") {
            const dayHours = getOpeningHours(baseDate, roomOpeningHours);
            startTime = setMinutes(setHours(new Date(baseDate), dayHours.start), 0);
            endTime = setMinutes(setHours(new Date(baseDate), dayHours.end), 0);
          } else {
            startTime = setMinutes(setHours(new Date(baseDate), startHour), startMinute);
            endTime = setMinutes(setHours(new Date(baseDate), endHour), endMinute);
          }

          bookingsToCreate.push({ startTime, endTime, week: w + 1 });
          insertRows.push({
            practitioner_id: targetPractitionerId,
            room_id: selectedRoom,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            notes: notes || null,
            recurrence_group_id: groupId,
          });
        }
      }
    } else {
      // Single or weekly same-day
      const count = recurrence === "weekly" ? recurrenceWeeks : 1;
      const groupId = count > 1 ? crypto.randomUUID() : null;

      for (let i = 0; i < count; i++) {
        const baseDate = addWeeks(selectedDate, i);
        let startTime: Date;
        let endTime: Date;

        if (bookingType === "full_day") {
          const dayHours = getOpeningHours(baseDate, roomOpeningHours);
          startTime = setMinutes(setHours(new Date(baseDate), dayHours.start), 0);
          endTime = setMinutes(setHours(new Date(baseDate), dayHours.end), 0);
        } else {
          startTime = setMinutes(setHours(new Date(baseDate), startHour), startMinute);
          endTime = setMinutes(setHours(new Date(baseDate), endHour), endMinute);
        }

        bookingsToCreate.push({ startTime, endTime, week: i + 1 });
        insertRows.push({
          practitioner_id: targetPractitionerId,
          room_id: selectedRoom,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          notes: notes || null,
          ...(groupId ? { recurrence_group_id: groupId } : {}),
        });
      }
    }

    // Respect des horaires d'ouverture propres à la salle (grille + périodes exceptionnelles)
    const hoursViolations: string[] = [];
    for (const b of bookingsToCreate) {
      const v = checkWithinOpeningHours(roomOpeningHours, b.startTime, b.endTime);
      if (v) hoursViolations.push(describeOpeningHoursViolation(roomOpeningHours, b.startTime, v));
    }
    if (hoursViolations.length > 0) {
      toast({
        variant: "destructive",
        title: "En dehors des heures d'ouverture",
        description: Array.from(new Set(hoursViolations)).slice(0, 3).join(" "),
      });
      setIsSubmitting(false);
      return;
    }

    // Check for conflicts (bookings + activity sessions)
    const bookingConflicts: Array<{ week: number; detail: string }> = [];

    for (const booking of bookingsToCreate) {
      const [{ data: existingBookings }, { data: existingSessions }] = await Promise.all([
        supabase
          .from("bookings")
          .select("*")
          .eq("room_id", selectedRoom)
          .neq("status", "cancelled")
          .lt("start_time", booking.endTime.toISOString())
          .gt("end_time", booking.startTime.toISOString()),
        supabase
          .from("activity_sessions")
          .select("*, activities(title, practitioner_id)")
          .eq("room_id", selectedRoom)
          .eq("status", "scheduled")
          .lt("start_time", booking.endTime.toISOString())
          .gt("end_time", booking.startTime.toISOString()),
      ]);

      if (existingBookings && existingBookings.length > 0) {
        const b = existingBookings[0];
        bookingConflicts.push({
          week: booking.week,
          detail: `${new Date(b.start_time).toLocaleDateString("fr-FR")} ${new Date(b.start_time).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} (réservation)`,
        });
      }

      // Filter out activity sessions belonging to the same practitioner
      const otherSessions = existingSessions?.filter(
        (s: any) => s.activities?.practitioner_id !== targetPractitionerId
      ) || [];

      if (!existingBookings?.length && otherSessions.length > 0) {
        const s = otherSessions[0];
        bookingConflicts.push({
          week: booking.week,
          detail: `${new Date(s.start_time).toLocaleDateString("fr-FR")} ${new Date(s.start_time).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} — ${s.activities?.title || "activité"}`,
        });
      }
    }

    if (bookingConflicts.length > 0) {
      const conflictDetails = bookingConflicts
        .map((c) => `Semaine ${c.week}: ${c.detail}`)
        .join("\n");

      toast({
        variant: "destructive",
        title: "Conflit détecté",
        description:
          bookingConflicts.length === 1
            ? `Créneau occupé: ${conflictDetails}`
            : `${bookingConflicts.length} créneaux occupés:\n${conflictDetails}`,
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
      const totalCount = insertRows.length;
      const label = totalCount > 1
        ? `${totalCount} réservations créées !`
        : "Réservation créée !";
      toast({ title: label, description: "En attente de confirmation." });
      setShowNewBooking(false);
      setNotes("");
      await refreshBookings();

      // Send email notification for each new booking
      for (const row of insertRows) {
        try {
          // Find the created booking by matching times
          const { data: created } = await supabase
            .from("bookings")
            .select("id")
            .eq("practitioner_id", row.practitioner_id)
            .eq("room_id", row.room_id)
            .eq("start_time", row.start_time)
            .eq("end_time", row.end_time)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (created) {
            supabase.functions.invoke("notify-new-booking", {
              body: { booking_id: created.id },
            }).catch((err) => console.error("Error sending new booking email:", err));

            // Notify admin center
            const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
            fetch(`https://${projectId}.supabase.co/functions/v1/notify-admin-center`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ type: "booking", booking_id: created.id }),
            }).catch(() => {});
          }
        } catch (err) {
          console.error("Error finding created booking:", err);
        }
      }
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

    // Count recurrence group
    if (booking.recurrence_group_id) {
      const { count } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("recurrence_group_id", booking.recurrence_group_id)
        .neq("status", "cancelled");
      setRecurrenceGroupCount(count || 0);
    } else {
      setRecurrenceGroupCount(0);
    }

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

  const handleDeleteRecurrenceGroup = async () => {
    if (!selectedBooking?.recurrence_group_id) return;
    setIsCancelling(true);

    const { error } = await supabase
      .from("bookings")
      .delete()
      .eq("recurrence_group_id", selectedBooking.recurrence_group_id);

    if (error) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de supprimer le groupe." });
    } else {
      toast({ title: "Groupe supprimé", description: `${recurrenceGroupCount} réservations supprimées. Le local est dé-privatisé.` });
      setShowCancelDialog(false);
      setSelectedBooking(null);
      await refreshBookings();
    }
    setIsCancelling(false);
  };

  const handleConfirmBooking = async () => {
    if (!selectedBooking) return;
    setIsUpdatingStatus(true);
    const { error } = await supabase
      .from("bookings")
      .update({ status: "confirmed" })
      .eq("id", selectedBooking.id);
    if (!error) {
      toast({ title: "Réservation confirmée" });
      setShowCancelDialog(false);
      setSelectedBooking(null);
      await refreshBookings();
    } else {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de confirmer." });
    }
    setIsUpdatingStatus(false);
  };

  const handleRefuseBooking = async () => {
    if (!selectedBooking) return;
    setIsUpdatingStatus(true);
    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", selectedBooking.id);
    if (!error) {
      toast({ title: "Réservation refusée" });
      setShowCancelDialog(false);
      setSelectedBooking(null);
      await refreshBookings();
    } else {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de refuser." });
    }
    setIsUpdatingStatus(false);
  };

  const roomName = rooms.find((r: any) => r.id === selectedRoom)?.name || "";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Planning mode toggle */}
        <div className="flex items-center bg-muted rounded-lg p-1 w-fit">
          <button
            onClick={() => setPlanningMode("my-planning")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all",
              planningMode === "my-planning"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <User className="h-4 w-4" />
            Mon Planning
          </button>
          <button
            onClick={() => setPlanningMode("by-room")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all",
              planningMode === "by-room"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Building2 className="h-4 w-4" />
            Par salle
          </button>
          <button
            onClick={() => setPlanningMode("all-rooms")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all",
              planningMode === "all-rooms"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Columns3 className="h-4 w-4" />
            Toutes les salles
          </button>
          <button
            onClick={() => setPlanningMode("occupation")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all",
              planningMode === "occupation"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <BarChart3 className="h-4 w-4" />
            Occupation & Stats
          </button>
        </div>

        {planningMode === "my-planning" ? (
          <>
            {/* Date picker */}
            <WeekDatePicker
              weekStart={weekStart}
              selectedDate={selectedDate}
              onWeekChange={setWeekStart}
              onDateSelect={(day) => setSelectedDate(day)}
            />
            <MyPlanningView
              weekStart={weekStart}
              profileId={profile?.id || ""}
              isAdmin={isAdmin}
              rooms={rooms}
              onBookingClick={handleBookingClick}
              onActivityClick={handleActivityClick}
            />
          </>
        ) : planningMode === "all-rooms" ? (
          <>
            {/* Date picker */}
            <WeekDatePicker
              weekStart={weekStart}
              selectedDate={selectedDate}
              onWeekChange={setWeekStart}
              onDateSelect={(day) => setSelectedDate(day)}
            />
            <AllRoomsOverview
              selectedDate={selectedDate}
              rooms={rooms}
              onSlotClick={(day, roomId) => {
                setSelectedRoom(roomId);
                setSelectedSlot(day);
                setShowNewBooking(true);
              }}
              onBookingClick={handleBookingClick}
              onActivityClick={handleActivityClick}
            />
          </>
        ) : planningMode === "occupation" ? (
          <MyRoomsView />
        ) : (
          <>
            {/* Header with room selector and view toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-bold">Réserver une salle</h2>
                <p className="text-muted-foreground text-sm mt-0.5">
                  Consultez les disponibilités et réservez un créneau.
                </p>
              </div>
              <div className="flex items-center gap-3">
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
              onDateSelect={(day) => setSelectedDate(day)}
            />

            {/* View content */}
            {viewMode === "week" ? (
              <WeeklyOverview
                weekStart={weekStart}
                selectedRoom={selectedRoom}
                rooms={rooms}
                onSlotClick={handleDayClickFromWeek}
                onActivityClick={handleActivityClick}
                onBookingClick={handleBookingClick}
              />
            ) : (
              <TimeSlotsGrid
                selectedDate={selectedDate}
                bookings={bookings}
                activitySessions={activitySessions}
                rooms={rooms}
                openingHours={rooms.find((r: any) => r.id === selectedRoom)?.opening_hours}
                onSlotClick={handleSlotClick}
                onBookingClick={handleBookingClick}
                onActivityClick={handleActivityClick}
              />
            )}
          </>
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
        openingHours={rooms.find((r: any) => r.id === selectedRoom)?.opening_hours}
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
        isAdmin={isAdmin}
        onConfirm={handleConfirmBooking}
        onRefuse={handleRefuseBooking}
        isUpdating={isUpdatingStatus}
        roomName={roomName}
        onDeleteRecurrenceGroup={handleDeleteRecurrenceGroup}
        recurrenceGroupCount={recurrenceGroupCount}
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
