import { useEffect, useState } from "react";
import { Plus, Edit, Trash2, Users, Calendar, Clock, ImageIcon } from "lucide-react";
import { format, addMinutes } from "date-fns";
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
};

const Activities = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ActivityForm>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [rooms, setRooms] = useState<any[]>([]);

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
    if (!profile) return;
    const { data } = await supabase
      .from("activities")
      .select("*")
      .eq("practitioner_id", profile.id)
      .order("created_at", { ascending: false });
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
    fetchRooms();
    fetchActivities();
  }, [profile]);

  const handleSave = async () => {
    if (!profile) return;
    setIsSaving(true);

    if (editingId) {
      const { error } = await supabase
        .from("activities")
        .update({ ...form })
        .eq("id", editingId);
      if (error) {
        toast({ variant: "destructive", title: "Erreur", description: error.message });
      } else {
        toast({ title: "Activité mise à jour" });
      }
    } else {
      const { error } = await supabase
        .from("activities")
        .insert({ ...form, practitioner_id: profile.id });
      if (error) {
        toast({ variant: "destructive", title: "Erreur", description: error.message });
      } else {
        toast({ title: "Activité créée !" });
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
    });
    setShowDialog(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("activities").delete().eq("id", id);
    if (!error) {
      toast({ title: "Activité supprimée" });
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

    const { error } = await supabase.from("activity_sessions").insert({
      activity_id: sessionActivityId,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      room_id: sessionForm.room_id || null,
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
            <h2 className="font-display text-xl font-bold">Mes activités</h2>
            <p className="text-muted-foreground text-sm mt-0.5">
              Gérez vos cours, ateliers et séances collectives.
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
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-display font-semibold">{activity.title}</h3>
                          <Badge variant="secondary" className="text-[10px]">
                            {categoryLabel(activity.category)}
                          </Badge>
                          {!activity.is_active && (
                            <Badge variant="destructive" className="text-[10px]">
                              Inactif
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
                          {(activity.photos?.length || 0) > 0 && (
                            <span className="flex items-center gap-1">
                              <ImageIcon className="h-3.5 w-3.5" />
                              {activity.photos.length} photo{activity.photos.length > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>

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
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={activity.is_active}
                            onCheckedChange={() => toggleActive(activity)}
                          />
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
                          onClick={() => handleDelete(activity.id)}
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editingId ? "Modifier l'activité" : "Nouvelle activité"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Photos gallery upload */}
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
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Ex: Salle Sérénité, En ligne..."
                className="mt-1.5"
              />
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
    </DashboardLayout>
  );
};

export default Activities;
