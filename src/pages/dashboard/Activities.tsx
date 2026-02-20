import { useEffect, useState } from "react";
import { Plus, Edit, Trash2, Users, Calendar, Clock, ImageIcon, Copy, AlertTriangle } from "lucide-react";
import { format, addMinutes, addDays, startOfDay, setHours, setMinutes, nextMonday, nextTuesday, nextWednesday, nextThursday, nextFriday, nextSaturday, nextSunday } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import ImageUpload from "@/components/dashboard/ImageUpload";

const CATEGORIES = [
  { value: "yoga", label: "Yoga" },
  { value: "pilates", label: "Pilates" },
  { value: "meditation", label: "Méditation" },
  { value: "fitness", label: "Fitness" },
  { value: "danse", label: "Danse" },
  { value: "sophrologie", label: "Sophrologie" },
  { value: "nutrition", label: "Atelier Nutrition" },
  { value: "autre", label: "Autre" },
];

const DAYS = [
  { value: "lundi", label: "Lundi" },
  { value: "mardi", label: "Mardi" },
  { value: "mercredi", label: "Mercredi" },
  { value: "jeudi", label: "Jeudi" },
  { value: "vendredi", label: "Vendredi" },
  { value: "samedi", label: "Samedi" },
  { value: "dimanche", label: "Dimanche" },
];

interface RecurrenceSlot {
  day: string;
  start: string;
  end: string;
}

interface ActivityForm {
  title: string;
  description: string;
  category: string;
  duration_minutes: number;
  max_participants: number;
  location: string;
  photo_url: string;
  photos: string[];
  is_free: boolean;
  price: number | null;
  booking_enabled: boolean;
  practitioner_id: string;
  recurrence: RecurrenceSlot[];
}

const emptyForm: ActivityForm = {
  title: "",
  description: "",
  category: "yoga",
  duration_minutes: 60,
  max_participants: 10,
  location: "",
  photo_url: "",
  photos: [],
  is_free: true,
  price: null,
  booking_enabled: false,
  practitioner_id: "",
  recurrence: [],
};

const Activities = () => {
  const { profile, isAdmin } = useAuth();
  const { toast } = useToast();
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ActivityForm>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [rooms, setRooms] = useState<any[]>([]);
  const [practitioners, setPractitioners] = useState<any[]>([]);
  const [filterPractitioner, setFilterPractitioner] = useState<string>("all");
  const [confirmDisableBooking, setConfirmDisableBooking] = useState<any | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);

  // Session scheduling
  const [showSessionDialog, setShowSessionDialog] = useState(false);
  const [sessionActivityId, setSessionActivityId] = useState<string | null>(null);
  const [sessionForm, setSessionForm] = useState({
    date: "",
    time: "09:00",
    room_id: "",
  });
  const [sessions, setSessions] = useState<Record<string, any[]>>({});

  const fetchActivities = async () => {
    if (!profile && !isAdmin) return;
    let query = supabase
      .from("activities")
      .select("*, profiles(first_name, last_name)")
      .order("created_at", { ascending: false });

    if (!isAdmin) {
      query = query.eq("practitioner_id", profile!.id);
    } else if (filterPractitioner !== "all") {
      query = query.eq("practitioner_id", filterPractitioner);
    }

    const { data } = await query;
    setActivities(data || []);

    // Fetch sessions for all activities
    if (data && data.length > 0) {
      const ids = data.map((a: any) => a.id);
      const { data: sessionsData } = await supabase
        .from("activity_sessions")
        .select("*, rooms(name), activity_registrations(id)")
        .in("activity_id", ids)
        .gte("start_time", new Date().toISOString())
        .order("start_time");

      const grouped: Record<string, any[]> = {};
      (sessionsData || []).forEach((s: any) => {
        if (!grouped[s.activity_id]) grouped[s.activity_id] = [];
        grouped[s.activity_id].push(s);
      });
      setSessions(grouped);
    }

    setLoading(false);
  };

  useEffect(() => {
    const fetchRooms = async () => {
      const { data } = await supabase.from("rooms").select("id, name").eq("is_available", true).order("name");
      setRooms(data || []);
    };
    const fetchPractitionersList = async () => {
      if (!isAdmin) return;
      const { data } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, user_id")
        .eq("is_active", true)
        .order("last_name");
      setPractitioners(data || []);
    };
    fetchRooms();
    fetchPractitionersList();
    fetchActivities();
  }, [profile, filterPractitioner]);

  const dayToNextFn: Record<string, (date: Date) => Date> = {
    lundi: nextMonday,
    mardi: nextTuesday,
    mercredi: nextWednesday,
    jeudi: nextThursday,
    vendredi: nextFriday,
    samedi: nextSaturday,
    dimanche: nextSunday,
  };

  const checkRecurrenceBookings = async (
    slots: RecurrenceSlot[],
    roomId: string,
    practitionerId: string,
  ) => {
    const now = new Date();
    const missingSlots: string[] = [];

    for (const slot of slots) {
      const nextFn = dayToNextFn[slot.day];
      if (!nextFn) continue;

      const nextDate = nextFn(now);
      const [sh, sm] = slot.start.split(":").map(Number);
      const [eh, em] = slot.end.split(":").map(Number);
      const slotStart = setMinutes(setHours(startOfDay(nextDate), sh), sm);
      const slotEnd = setMinutes(setHours(startOfDay(nextDate), eh), em);

      // Check for a booking covering this slot
      const { data: bookings } = await supabase
        .from("bookings")
        .select("id")
        .eq("room_id", roomId)
        .eq("practitioner_id", practitionerId)
        .neq("status", "cancelled")
        .lte("start_time", slotStart.toISOString())
        .gte("end_time", slotEnd.toISOString())
        .limit(1);

      if (!bookings || bookings.length === 0) {
        const dayLabel = DAYS.find((d) => d.value === slot.day)?.label || slot.day;
        missingSlots.push(`${dayLabel} ${slot.start}–${slot.end}`);
      }
    }

    if (missingSlots.length > 0) {
      toast({
        title: "⚠️ Réservation de salle manquante",
        description: `Aucune réservation de salle trouvée pour : ${missingSlots.join(", ")}. Pensez à réserver la salle pour ces créneaux.`,
        variant: "destructive",
        duration: 8000,
      });
    }
  };

  const handleSave = async () => {
    if (!profile && !isAdmin) return;
    if (isAdmin && !editingId && !form.practitioner_id) {
      toast({ variant: "destructive", title: "Praticien requis", description: "Veuillez sélectionner un praticien." });
      return;
    }
    setIsSaving(true);

    const { practitioner_id: formPractitionerId, recurrence, ...formData } = form;
    const recurrenceJson = JSON.parse(JSON.stringify(recurrence));

    if (editingId) {
      const { error } = await supabase
        .from("activities")
        .update({ ...formData, recurrence: recurrenceJson, ...(isAdmin && formPractitionerId ? { practitioner_id: formPractitionerId } : {}) })
        .eq("id", editingId);
      if (error) {
        toast({ variant: "destructive", title: "Erreur", description: error.message });
      } else {
        toast({ title: "Activité mise à jour" });
      }
    } else {
      const targetPractitionerId = isAdmin && formPractitionerId ? formPractitionerId : profile!.id;
      const { error } = await supabase
        .from("activities")
        .insert({ ...formData, recurrence: recurrenceJson, practitioner_id: targetPractitionerId });
      if (error) {
        toast({ variant: "destructive", title: "Erreur", description: error.message });
      } else {
        toast({ title: "Activité créée !" });
      }
    }

    // Auto-generate sessions from recurrence
    if (recurrence.length > 0) {
      const { error: rpcError } = await supabase.rpc("generate_recurring_sessions");
      if (rpcError) {
        console.error("Error generating recurring sessions:", rpcError);
      } else {
        toast({ title: "Séances générées automatiquement 🗓️", description: "Les 4 prochaines semaines ont été planifiées." });
      }
    }

    // Check if recurrence slots match existing room bookings
    if (recurrence.length > 0 && form.location) {
      const targetPractId = editingId
        ? (isAdmin && formPractitionerId ? formPractitionerId : form.practitioner_id)
        : (isAdmin && formPractitionerId ? formPractitionerId : profile!.id);
      const selectedRoom = rooms.find((r) => r.name === form.location);

      if (selectedRoom && targetPractId) {
        await checkRecurrenceBookings(recurrence, selectedRoom.id, targetPractId);
      }
    }

    setIsSaving(false);
    setShowDialog(false);
    setEditingId(null);
    setForm(emptyForm);
    fetchActivities();
  };

  const handleEdit = (activity: any) => {
    setEditingId(activity.id);
    setForm({
      title: activity.title,
      description: activity.description || "",
      category: activity.category,
      duration_minutes: activity.duration_minutes,
      max_participants: activity.max_participants,
      location: activity.location || "",
      photo_url: activity.photo_url || "",
      photos: activity.photos || [],
      is_free: activity.is_free ?? true,
      price: activity.price ?? null,
      booking_enabled: activity.booking_enabled ?? false,
      practitioner_id: activity.practitioner_id || "",
      recurrence: Array.isArray(activity.recurrence) ? activity.recurrence : [],
    });
    setShowDialog(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("activities").delete().eq("id", id);
    if (!error) {
      toast({ title: "Activité supprimée" });
      setConfirmDelete(null);
      fetchActivities();
    }
  };

  const toggleActive = async (activity: any) => {
    await supabase
      .from("activities")
      .update({ is_active: !activity.is_active })
      .eq("id", activity.id);
    fetchActivities();
  };

  const handleCreateSession = async () => {
    if (!sessionActivityId || !sessionForm.date || !sessionForm.time) return;
    setIsSaving(true);

    const activity = activities.find((a: any) => a.id === sessionActivityId);
    const startTime = new Date(`${sessionForm.date}T${sessionForm.time}:00`);
    const endTime = addMinutes(startTime, activity?.duration_minutes || 60);
    const roomId = sessionForm.room_id || null;

    // Conflict detection when a room is selected
    if (roomId) {
      const [{ data: conflictingBookings }, { data: conflictingSessions }] = await Promise.all([
        supabase
          .from("bookings")
          .select("*, profiles(first_name, last_name)")
          .eq("room_id", roomId)
          .neq("status", "cancelled")
          .lt("start_time", endTime.toISOString())
          .gt("end_time", startTime.toISOString()),
        supabase
          .from("activity_sessions")
          .select("*, activities(title)")
          .eq("room_id", roomId)
          .eq("status", "scheduled")
          .lt("start_time", endTime.toISOString())
          .gt("end_time", startTime.toISOString()),
      ]);

      const roomName = rooms.find((r: any) => r.id === roomId)?.name || "la salle";

      if (conflictingBookings && conflictingBookings.length > 0) {
        const b = conflictingBookings[0];
        const bStart = new Date(b.start_time);
        toast({
          variant: "destructive",
          title: "Conflit avec une réservation",
          description: `${roomName} est déjà réservée par ${b.profiles?.first_name} ${b.profiles?.last_name} de ${bStart.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} à ${new Date(b.end_time).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}.`,
        });
        setIsSaving(false);
        return;
      }

      if (conflictingSessions && conflictingSessions.length > 0) {
        const s = conflictingSessions[0];
        const sStart = new Date(s.start_time);
        toast({
          variant: "destructive",
          title: "Conflit avec une activité",
          description: `${roomName} est déjà occupée par « ${s.activities?.title || "une activité"} » de ${sStart.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} à ${new Date(s.end_time).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}.`,
        });
        setIsSaving(false);
        return;
      }
    }

    const { error } = await supabase.from("activity_sessions").insert({
      activity_id: sessionActivityId,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      room_id: roomId,
      max_participants: activity?.max_participants || 10,
    });

    if (error) {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    } else {
      toast({ title: "Séance planifiée !" });
      setShowSessionDialog(false);
      setSessionForm({ date: "", time: "09:00", room_id: "" });
      fetchActivities();
    }
    setIsSaving(false);
  };

  const categoryLabel = (cat: string) =>
    CATEGORIES.find((c) => c.value === cat)?.label || cat;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold">
              {isAdmin ? "Gestion des activités" : "Mes activités"}
            </h2>
            <p className="text-muted-foreground text-sm mt-0.5">
              {isAdmin
                ? "Créez et gérez les activités pour tous les praticiens."
                : "Gérez vos cours, ateliers et séances collectives."}
            </p>
          </div>
          <Button
            onClick={() => {
              setEditingId(null);
              setForm(emptyForm);
              setShowDialog(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle activité
          </Button>
        </div>

        {/* Admin: practitioner filter */}
        {isAdmin && practitioners.length > 0 && (
          <div className="flex items-center gap-3">
            <Label className="text-sm whitespace-nowrap">Praticien :</Label>
            <Select value={filterPractitioner} onValueChange={setFilterPractitioner}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Tous les praticiens" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les praticiens</SelectItem>
                {practitioners.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.first_name} {p.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : activities.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                Aucune activité. Créez votre première activité pour proposer des cours.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {activities.map((activity: any) => {
              const actSessions = sessions[activity.id] || [];

              return (
                <Card key={activity.id}>
                  <CardContent className="pt-6">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                        <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-display font-semibold">{activity.title}</h3>
                          <Badge variant="secondary" className="text-[10px]">
                            {categoryLabel(activity.category)}
                          </Badge>
                          {!activity.is_active && (
                            <Badge variant="destructive" className="text-[10px]">
                              Inactif
                            </Badge>
                          )}
                          {isAdmin && activity.profiles && (
                            <Badge variant="outline" className="text-[10px]">
                              {activity.profiles.first_name} {activity.profiles.last_name}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {activity.description || "Aucune description"}
                        </p>
                        <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {activity.duration_minutes} min
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            {activity.max_participants} places max
                          </span>
                          <Badge variant={activity.is_free ? "secondary" : "default"} className="text-[10px]">
                            {activity.is_free ? "Gratuit" : `${activity.price ?? "—"} €`}
                          </Badge>
                          {activity.booking_enabled && (
                            <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                              Réservation en ligne
                            </Badge>
                          )}
                          {(activity.photos?.length || 0) > 0 && (
                            <span className="flex items-center gap-1">
                              <ImageIcon className="h-3.5 w-3.5" />
                              {activity.photos.length} photo{activity.photos.length > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>

                        {/* Recurrence schedule */}
                        {(() => {
                          let slots: { day: string; start: string; end: string }[] = [];
                          try {
                            const raw = typeof activity.recurrence === "string" ? JSON.parse(activity.recurrence) : activity.recurrence;
                            if (Array.isArray(raw)) slots = raw;
                          } catch {}
                          if (slots.length === 0) return null;
                          return (
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
                              {slots.map((s, i) => {
                                const dayLabel = DAYS.find((d) => d.value === s.day)?.label || s.day;
                                return (
                                  <Badge key={i} variant="outline" className="text-[10px] font-normal gap-1">
                                    {dayLabel} {s.start}–{s.end}
                                  </Badge>
                                );
                              })}
                            </div>
                          );
                        })()}

                        {/* Upcoming sessions */}
                        {actSessions.length > 0 && (
                          <div className="mt-4 space-y-1.5">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              Prochaines séances
                            </p>
                            {actSessions.slice(0, 3).map((session: any) => (
                              <div
                                key={session.id}
                                className="flex items-center gap-3 text-xs p-2 rounded-lg bg-muted/50"
                              >
                                <Calendar className="h-3.5 w-3.5 text-primary" />
                                <span className="font-medium">
                                  {format(new Date(session.start_time), "EEE d MMM • HH:mm", { locale: fr })}
                                </span>
                                {session.rooms?.name && (
                                  <Badge variant="outline" className="text-[9px]">
                                    {session.rooms.name}
                                  </Badge>
                                )}
                                <span className="text-muted-foreground ml-auto">
                                  {session.activity_registrations?.length || 0}/{session.max_participants} inscrits
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex sm:flex-col items-center gap-2">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={activity.is_active}
                              onCheckedChange={() => toggleActive(activity)}
                            />
                            <span className="text-[10px] text-muted-foreground">Actif</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={activity.booking_enabled}
                              onCheckedChange={async () => {
                                if (activity.booking_enabled) {
                                  // Désactivation → demander confirmation
                                  setConfirmDisableBooking(activity);
                                } else {
                                  // Activation → immédiate
                                  await supabase
                                    .from("activities")
                                    .update({ booking_enabled: true })
                                    .eq("id", activity.id);
                                  fetchActivities();
                                }
                              }}
                            />
                            <span className="text-[10px] text-muted-foreground">Résa en ligne</span>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSessionActivityId(activity.id);
                            setShowSessionDialog(true);
                          }}
                        >
                          <Calendar className="h-3.5 w-3.5 mr-1.5" />
                          Planifier
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(activity)}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Dupliquer"
                          onClick={() => {
                            setEditingId(null);
                            setForm({
                              title: activity.title + " (copie)",
                              description: activity.description || "",
                              category: activity.category,
                              duration_minutes: activity.duration_minutes,
                              max_participants: activity.max_participants,
                              location: activity.location || "",
                              photo_url: activity.photo_url || "",
                              photos: activity.photos || [],
                              is_free: activity.is_free ?? true,
                              price: activity.price ?? null,
                              booking_enabled: false,
                              practitioner_id: activity.practitioner_id || "",
                              recurrence: Array.isArray(activity.recurrence) ? activity.recurrence : [],
                            });
                            setShowDialog(true);
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmDelete(activity)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Activity create/edit dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editingId ? "Modifier l'activité" : "Nouvelle activité"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Admin: practitioner selector */}
            {isAdmin && practitioners.length > 0 && (
              <div>
                <Label>Praticien</Label>
                <Select
                  value={form.practitioner_id}
                  onValueChange={(v) => setForm({ ...form, practitioner_id: v })}
                >
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
              </div>
            )}
            <div>
              <Label>Photos de l'activité</Label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {form.photos.map((url, idx) => (
                  <div key={idx} className="relative group w-24 h-24">
                    <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover rounded-xl border border-border" />
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, photos: form.photos.filter((_, i) => i !== idx) })}
                      className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <ImageUpload
                  bucket="activity-photos"
                  folder={profile?.user_id || "unknown"}
                  currentUrl={null}
                  onUpload={(url) => setForm({ ...form, photos: [...form.photos, url] })}
                  shape="rounded"
                  className="w-24 h-24"
                  placeholder={
                    <div className="w-24 h-24 flex flex-col items-center justify-center gap-1">
                      <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
                      <span className="text-[9px] text-muted-foreground/60">Ajouter</span>
                    </div>
                  }
                />
              </div>
            </div>

            {/* Pricing */}
            <div className="rounded-xl border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Activité gratuite</Label>
                  <p className="text-xs text-muted-foreground">Désactivez pour définir un prix</p>
                </div>
                <Switch
                  checked={form.is_free}
                  onCheckedChange={(checked) => setForm({ ...form, is_free: checked, price: checked ? null : form.price })}
                />
              </div>
              {!form.is_free && (
                <div>
                  <Label>Prix (€)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    value={form.price ?? ""}
                    onChange={(e) => setForm({ ...form, price: e.target.value ? parseFloat(e.target.value) : null })}
                    placeholder="Ex: 15"
                    className="mt-1.5 w-32"
                  />
                </div>
              )}
            </div>

            {/* Online booking toggle */}
            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Réservation en ligne activée</Label>
                  <p className="text-xs text-muted-foreground">Les patients pourront réserver un créneau directement depuis votre page</p>
                </div>
                <Switch
                  checked={form.booking_enabled}
                  onCheckedChange={(checked) => setForm({ ...form, booking_enabled: checked })}
                />
              </div>
            </div>

            <div>
              <Label>Titre</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex: Yoga Vinyasa"
                className="mt-1.5"
                required
              />
            </div>
            <div>
              <Label>Catégorie</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Décrivez votre activité..."
                rows={3}
                className="mt-1.5"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Durée (min)</Label>
                <Input
                  type="number"
                  value={form.duration_minutes}
                  onChange={(e) => setForm({ ...form, duration_minutes: parseInt(e.target.value) || 60 })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Participants max</Label>
                <Input
                  type="number"
                  value={form.max_participants}
                  onChange={(e) => setForm({ ...form, max_participants: parseInt(e.target.value) || 10 })}
                  className="mt-1.5"
                />
              </div>
            </div>
            <div>
              <Label>Lieu</Label>
              <Select
                value={form.location}
                onValueChange={(v) => setForm({ ...form, location: v })}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Sélectionner une salle" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map((r) => (
                    <SelectItem key={r.id} value={r.name}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Jours et horaires */}
            <div>
              <Label>Jours et horaires</Label>
              <p className="text-xs text-muted-foreground mb-2">Indiquez les créneaux récurrents de cette activité.</p>
              <div className="space-y-2">
                {form.recurrence.map((slot, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Select
                      value={slot.day}
                      onValueChange={(v) => {
                        const updated = [...form.recurrence];
                        updated[idx] = { ...updated[idx], day: v };
                        setForm({ ...form, recurrence: updated });
                      }}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DAYS.map((d) => (
                          <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="time"
                      value={slot.start}
                      onChange={(e) => {
                        const updated = [...form.recurrence];
                        updated[idx] = { ...updated[idx], start: e.target.value };
                        setForm({ ...form, recurrence: updated });
                      }}
                      className="w-28"
                    />
                    <span className="text-muted-foreground text-sm">→</span>
                    <Input
                      type="time"
                      value={slot.end}
                      onChange={(e) => {
                        const updated = [...form.recurrence];
                        updated[idx] = { ...updated[idx], end: e.target.value };
                        setForm({ ...form, recurrence: updated });
                      }}
                      className="w-28"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setForm({ ...form, recurrence: form.recurrence.filter((_, i) => i !== idx) })}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setForm({ ...form, recurrence: [...form.recurrence, { day: "lundi", start: "09:00", end: "10:00" }] })}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Ajouter un créneau
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !form.title}>
              {isSaving ? "Enregistrement..." : editingId ? "Mettre à jour" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Session scheduling dialog */}
      <Dialog open={showSessionDialog} onOpenChange={setShowSessionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Planifier une séance</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={sessionForm.date}
                onChange={(e) => setSessionForm({ ...sessionForm, date: e.target.value })}
                min={new Date().toISOString().split("T")[0]}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Heure</Label>
              <Input
                type="time"
                value={sessionForm.time}
                onChange={(e) => setSessionForm({ ...sessionForm, time: e.target.value })}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Salle (optionnel)</Label>
              <Select
                value={sessionForm.room_id}
                onValueChange={(v) => setSessionForm({ ...sessionForm, room_id: v })}
              >
                <SelectTrigger className="mt-1.5">
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSessionDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateSession} disabled={isSaving || !sessionForm.date}>
              {isSaving ? "Planification..." : "Planifier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm disable booking dialog */}
      <Dialog open={!!confirmDisableBooking} onOpenChange={() => setConfirmDisableBooking(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Désactiver la réservation en ligne ?</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <p className="text-sm text-muted-foreground">
              Les visiteurs ne pourront plus s'inscrire en ligne à{" "}
              <span className="font-semibold text-foreground">
                {confirmDisableBooking?.title}
              </span>
              .
            </p>
            <p className="text-sm text-muted-foreground">
              Les inscriptions existantes ne seront pas affectées.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDisableBooking(null)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await supabase
                  .from("activities")
                  .update({ booking_enabled: false })
                  .eq("id", confirmDisableBooking.id);
                setConfirmDisableBooking(null);
                fetchActivities();
                toast({ title: "Réservation en ligne désactivée" });
              }}
            >
              Désactiver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Supprimer cette activité ?</AlertDialogTitle>
            <AlertDialogDescription>
              L'activité <strong>« {confirmDelete?.title} »</strong> sera définitivement supprimée,
              ainsi que toutes ses séances planifiées. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && handleDelete(confirmDelete.id)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default Activities;
