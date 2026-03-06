import { useState, useEffect } from "react";
import { format, addDays, startOfDay, addMinutes, isBefore } from "date-fns";
import { fr } from "date-fns/locale";
import { Clock, Calendar, MapPin, User, Mail, Phone, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface Activity {
  id: string;
  title: string;
  duration_minutes: number;
  price: number | null;
  is_free: boolean;
  max_participants: number | null;
  category: string;
}

interface PatientBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  practitionerId: string;
  practitionerName: string;
  activities: Activity[];
}

interface DaySchedule {
  day: string;
  start: string;
  end: string;
}

interface AvailableSlot {
  start: Date;
  end: Date;
}

const DAYS_MAP: Record<string, number> = {
  lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6, dimanche: 0,
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 0,
};

const PatientBookingDialog = ({
  open,
  onOpenChange,
  practitionerId,
  practitionerName,
  activities,
}: PatientBookingDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState<"activity" | "date" | "slot" | "form" | "done">("activity");
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [guestForm, setGuestForm] = useState({ name: "", email: "", phone: "" });

  const [practitionerSchedule, setPractitionerSchedule] = useState<DaySchedule[]>([]);
  const [practitionerBreak, setPractitionerBreak] = useState(15);

  // Fetch practitioner schedule once on open
  useEffect(() => {
    if (!open) return;
    const fetchSchedule = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("schedule, break_minutes")
        .eq("id", practitionerId)
        .single();
      const schedule: DaySchedule[] = profile?.schedule
        ? (typeof profile.schedule === "string" ? JSON.parse(profile.schedule) : profile.schedule)
        : [];
      setPractitionerSchedule(schedule);
      setPractitionerBreak((profile as any)?.break_minutes ?? 15);
    };
    fetchSchedule();
  }, [open, practitionerId]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep(activities.length === 1 ? "date" : "activity");
      setSelectedActivity(activities.length === 1 ? activities[0] : null);
      setSelectedDate("");
      setAvailableSlots([]);
      setSelectedSlot(null);
      setGuestForm({ name: "", email: "", phone: "" });
    }
  }, [open, activities]);

  // Generate available dates (next 14 days, filtered by schedule days)
  const generateDates = () => {
    const scheduleDays = new Set(practitionerSchedule.map((s) => DAYS_MAP[s.day]));
    const dates: string[] = [];
    for (let i = 1; i <= 14; i++) {
      const d = addDays(new Date(), i);
      if (scheduleDays.has(d.getDay())) {
        dates.push(format(d, "yyyy-MM-dd"));
      }
    }
    return dates;
  };

  // Fetch available slots for selected date + activity
  const fetchAvailableSlots = async (dateStr: string) => {
    if (!selectedActivity) return;
    setLoadingSlots(true);

    const date = new Date(dateStr);
    const dayIndex = date.getDay();

    const schedule = practitionerSchedule;
    const breakMin = practitionerBreak;

    // Find schedule entries for this day (match by day number, supports both FR and EN names)
    const daySlots = schedule.filter((s) => DAYS_MAP[s.day] === dayIndex);

    if (daySlots.length === 0) {
      setAvailableSlots([]);
      setLoadingSlots(false);
      return;
    }

    // Get existing bookings and sessions for this practitioner on this date
    const dayStart = startOfDay(date).toISOString();
    const dayEnd = addDays(startOfDay(date), 1).toISOString();

    const [{ data: existingBookings }, { data: existingSessions }] = await Promise.all([
      supabase
        .from("bookings")
        .select("start_time, end_time")
        .eq("practitioner_id", practitionerId)
        .neq("status", "cancelled")
        .gte("start_time", dayStart)
        .lt("start_time", dayEnd),
      supabase
        .from("activity_sessions")
        .select("start_time, end_time, activity_registrations(id)")
        .in("activity_id", activities.map((a) => a.id))
        .gte("start_time", dayStart)
        .lt("start_time", dayEnd)
        .eq("status", "scheduled"),
    ]);

    const occupied = [
      ...(existingBookings || []).map((b) => ({ start: new Date(b.start_time), end: new Date(b.end_time) })),
      ...(existingSessions || [])
        .filter((s: any) => (s.activity_registrations?.length || 0) > 0)
        .map((s) => ({ start: new Date(s.start_time), end: new Date(s.end_time) })),
    ];

    // Generate slots
    const duration = selectedActivity.duration_minutes;
    const slots: AvailableSlot[] = [];
    const now = new Date();

    for (const daySlot of daySlots) {
      const [startH, startM] = daySlot.start.split(":").map(Number);
      const [endH, endM] = daySlot.end.split(":").map(Number);

      let slotStart = new Date(date);
      slotStart.setHours(startH, startM, 0, 0);

      const scheduleEnd = new Date(date);
      scheduleEnd.setHours(endH, endM, 0, 0);

      while (addMinutes(slotStart, duration) <= scheduleEnd) {
        const slotEnd = addMinutes(slotStart, duration);

        // Skip if in the past
        if (isBefore(slotStart, now)) {
          slotStart = addMinutes(slotEnd, breakMin);
          continue;
        }

        // Check for conflicts
        const hasConflict = occupied.some(
          (o) => slotStart < o.end && slotEnd > o.start
        );

        if (!hasConflict) {
          slots.push({ start: new Date(slotStart), end: new Date(slotEnd) });
        }

        slotStart = addMinutes(slotEnd, breakMin);
      }
    }

    setAvailableSlots(slots);
    setLoadingSlots(false);
  };

  useEffect(() => {
    if (selectedDate && selectedActivity) {
      fetchAvailableSlots(selectedDate);
    }
  }, [selectedDate, selectedActivity]);

  const handleSubmit = async () => {
    if (!selectedSlot || !selectedActivity) return;

    const email = user ? undefined : guestForm.email.trim();
    const name = user ? undefined : guestForm.name.trim();

    if (!user && (!email || !name)) {
      toast({ variant: "destructive", title: "Champs requis", description: "Veuillez renseigner votre nom et email." });
      return;
    }

    if (!user && email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        toast({ variant: "destructive", title: "Email invalide" });
        return;
      }
    }

    setIsSubmitting(true);

    // Create the session
    const { data: session, error: sessionError } = await supabase
      .from("activity_sessions")
      .insert({
        activity_id: selectedActivity.id,
        start_time: selectedSlot.start.toISOString(),
        end_time: selectedSlot.end.toISOString(),
        max_participants: selectedActivity.max_participants || 1,
        status: "scheduled",
      })
      .select("id")
      .single();

    if (sessionError) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de réserver ce créneau." });
      setIsSubmitting(false);
      return;
    }

    // Create the registration
    const regData: any = {
      session_id: session.id,
      user_id: user?.id || null,
      guest_name: name || null,
      guest_email: email || null,
      guest_phone: !user ? (guestForm.phone.trim() || null) : null,
    };

    const { data: registration, error: regError } = await supabase
      .from("activity_registrations")
      .insert(regData)
      .select("id")
      .single();

    if (regError) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de finaliser l'inscription." });
      setIsSubmitting(false);
      return;
    }

    // Send notification emails (fire-and-forget)
    if (registration?.id) {
      supabase.functions.invoke("notify-registration-guest", {
        body: { registration_id: registration.id },
      }).catch(() => {});
      supabase.functions.invoke("notify-registration", {
        body: { session_id: session.id, registration_id: registration.id },
      }).catch(() => {});
      // Notify admin center
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      fetch(`https://${projectId}.supabase.co/functions/v1/notify-admin-center`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "registration", session_id: session.id, registration_id: registration.id }),
      }).catch(() => {});
    }

    setStep("done");
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">
            {step === "done" ? "Réservation confirmée ! 🎉" : `Réserver avec ${practitionerName}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Step 1: Choose activity */}
          {step === "activity" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Choisissez une prestation :</p>
              {activities.map((act) => (
                <button
                  key={act.id}
                  onClick={() => { setSelectedActivity(act); setStep("date"); }}
                  className="w-full text-left rounded-xl border border-border p-4 hover:border-primary hover:bg-accent/30 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">{act.title}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                        <Clock className="h-3 w-3" /> {act.duration_minutes} min
                      </p>
                    </div>
                    <Badge variant={act.is_free ? "secondary" : "default"} className="text-xs">
                      {act.is_free ? "Gratuit" : `${act.price} €`}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Step 2: Choose date */}
          {step === "date" && selectedActivity && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="outline">{selectedActivity.title}</Badge>
                <button onClick={() => setStep("activity")} className="text-xs text-primary hover:underline">
                  Changer
                </button>
              </div>
              <p className="text-sm text-muted-foreground">Choisissez une date :</p>
              <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto">
                {generateDates().map((d) => (
                  <button
                    key={d}
                    onClick={() => { setSelectedDate(d); setStep("slot"); }}
                    className="rounded-lg border border-border p-2 text-center hover:border-primary hover:bg-accent/30 transition-all text-xs"
                  >
                    <p className="font-medium capitalize">
                      {format(new Date(d), "EEE", { locale: fr })}
                    </p>
                    <p className="text-muted-foreground">
                      {format(new Date(d), "d MMM", { locale: fr })}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Choose slot */}
          {step === "slot" && selectedActivity && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <Badge variant="outline">{selectedActivity.title}</Badge>
                <Badge variant="outline">
                  {format(new Date(selectedDate), "EEEE d MMMM", { locale: fr })}
                </Badge>
                <button onClick={() => setStep("date")} className="text-xs text-primary hover:underline">
                  Changer
                </button>
              </div>
              <p className="text-sm text-muted-foreground">Choisissez un créneau :</p>
              {loadingSlots ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="rounded-lg bg-muted p-4 text-center">
                  <p className="text-sm text-muted-foreground">Aucun créneau disponible ce jour.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 max-h-[250px] overflow-y-auto">
                  {availableSlots.map((slot, i) => (
                    <button
                      key={i}
                      onClick={() => { setSelectedSlot(slot); setStep("form"); }}
                      className="rounded-lg border border-border p-2 text-center hover:border-primary hover:bg-accent/30 transition-all text-sm font-medium"
                    >
                      {format(slot.start, "HH:mm")}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Contact form */}
          {step === "form" && selectedSlot && selectedActivity && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-accent/30 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="font-medium capitalize">
                    {format(selectedSlot.start, "EEEE d MMMM yyyy", { locale: fr })}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-primary" />
                  <span>{format(selectedSlot.start, "HH:mm")} – {format(selectedSlot.end, "HH:mm")}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-primary" />
                  <span>{selectedActivity.title}</span>
                </div>
                {!selectedActivity.is_free && selectedActivity.price && (
                  <Badge className="mt-1">{selectedActivity.price} €</Badge>
                )}
              </div>

              <button onClick={() => setStep("slot")} className="text-xs text-primary hover:underline">
                ← Changer de créneau
              </button>

              {user ? (
                <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
                  <p className="text-sm">
                    Vous réservez en tant que <strong>{user.email}</strong>
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="book_name" className="text-xs">Nom complet *</Label>
                    <Input
                      id="book_name"
                      value={guestForm.name}
                      onChange={(e) => setGuestForm({ ...guestForm, name: e.target.value })}
                      placeholder="Jean Dupont"
                      className="mt-1"
                      maxLength={100}
                    />
                  </div>
                  <div>
                    <Label htmlFor="book_email" className="text-xs">Email *</Label>
                    <Input
                      id="book_email"
                      type="email"
                      value={guestForm.email}
                      onChange={(e) => setGuestForm({ ...guestForm, email: e.target.value })}
                      placeholder="jean@exemple.com"
                      className="mt-1"
                      maxLength={255}
                    />
                  </div>
                  <div>
                    <Label htmlFor="book_phone" className="text-xs">Téléphone (optionnel)</Label>
                    <Input
                      id="book_phone"
                      value={guestForm.phone}
                      onChange={(e) => setGuestForm({ ...guestForm, phone: e.target.value })}
                      placeholder="+32 ..."
                      className="mt-1"
                      maxLength={20}
                    />
                  </div>
                </div>
              )}

              <Button className="w-full" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? "Réservation en cours..." : "Confirmer la réservation"}
              </Button>

              {!user && (
                <p className="text-xs text-center text-muted-foreground">
                  Ou{" "}
                  <button onClick={() => navigate("/login")} className="text-primary hover:underline font-medium">
                    connectez-vous
                  </button>{" "}
                  pour un suivi personnalisé.
                </p>
              )}
            </div>
          )}

          {/* Step 5: Confirmation */}
          {step === "done" && (
            <div className="text-center space-y-4 py-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="font-semibold">Votre rendez-vous est confirmé !</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Vous recevrez un email de confirmation avec tous les détails.
                </p>
              </div>
              <Button onClick={() => onOpenChange(false)} className="w-full">
                Fermer
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PatientBookingDialog;
