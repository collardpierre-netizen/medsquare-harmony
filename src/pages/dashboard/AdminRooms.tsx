import { useEffect, useState, useCallback } from "react";
import { DoorOpen, Plus, Edit, Trash2, Users, Euro, Maximize, MapPin, Image as ImageIcon, X, Settings, Lock, CalendarClock, AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isRoomCurrentlyPrivatized, isPrivatizationScheduled, getPrivatizationLabel } from "@/lib/roomPrivatization";
import RoomStatusBadge from "@/components/rooms/RoomStatusBadge";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import ImageUpload from "@/components/dashboard/ImageUpload";

interface PricingItem {
  label: string;
  price: number;
}

interface Room {
  id: string;
  name: string;
  description: string | null;
  capacity: number | null;
  hourly_rate: number | null;
  equipment: string[] | null;
  photos: string[] | null;
  is_available: boolean;
  floor: string | null;
  surface_area: number | null;
  pricing: PricingItem[] | null;
  credits_info: string | null;
  privatized_from: string | null;
  privatized_until: string | null;
}

const AdminRooms = () => {
  const { toast } = useToast();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showDefaultsDialog, setShowDefaultsDialog] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [defaultPricing, setDefaultPricing] = useState<PricingItem[]>([]);
  const [defaultCreditsInfo, setDefaultCreditsInfo] = useState("");
  const [defaultsForm, setDefaultsForm] = useState<{ pricing: PricingItem[]; credits_info: string }>({ pricing: [], credits_info: "" });
  const [conflictBookings, setConflictBookings] = useState<any[]>([]);
  const [loadingConflicts, setLoadingConflicts] = useState(false);
  const [showCancelConflictsConfirm, setShowCancelConflictsConfirm] = useState(false);
  const [cancellingConflicts, setCancellingConflicts] = useState(false);

  const handleCancelAllConflicts = async () => {
    if (!conflictBookings.length) return;
    setCancellingConflicts(true);
    const ids = conflictBookings.map((b) => b.id);
    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .in("id", ids);
    setCancellingConflicts(false);
    setShowCancelConflictsConfirm(false);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Réservations annulées",
      description: `${ids.length} réservation${ids.length > 1 ? "s" : ""} annulée${ids.length > 1 ? "s" : ""} avec succès.`,
    });
    setConflictBookings([]);
  };
  const [form, setForm] = useState({
    name: "",
    description: "",
    capacity: "1",
    hourly_rate: "0",
    equipment: "",
    floor: "",
    surface_area: "",
    is_available: true,
    photos: [] as string[],
    pricing: [] as PricingItem[],
    credits_info: "",
    min_monthly_price: "",
    min_monthly_hours: "",
    privatized_from: "",
    privatized_until: "",
  });

  const fetchRooms = async () => {
    const { data } = await supabase.from("rooms").select("*").order("name");
    setRooms((data as unknown as Room[]) || []);
    setLoading(false);
  };

  const fetchDefaults = useCallback(async () => {
    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "default_room_pricing")
      .maybeSingle();
    if (data?.value) {
      const val = data.value as any;
      setDefaultPricing(val.pricing || []);
      setDefaultCreditsInfo(val.credits_info || "");
    }
  }, []);

  useEffect(() => {
    fetchRooms();
    fetchDefaults();
  }, [fetchDefaults]);

  // Load bookings that conflict with the scheduled privatization period
  useEffect(() => {
    const loadConflicts = async () => {
      if (!editingRoom || !form.privatized_from) {
        setConflictBookings([]);
        return;
      }
      setLoadingConflicts(true);
      const startISO = `${form.privatized_from}T00:00:00`;
      // If no end date, look 1 year ahead
      const endDate = form.privatized_until || (() => {
        const d = new Date(form.privatized_from);
        d.setFullYear(d.getFullYear() + 1);
        return d.toISOString().slice(0, 10);
      })();
      const endISO = `${endDate}T23:59:59`;

      const { data } = await supabase
        .from("bookings")
        .select("id, start_time, end_time, status, notes, profiles(first_name, last_name)")
        .eq("room_id", editingRoom.id)
        .neq("status", "cancelled")
        .gte("start_time", startISO)
        .lte("start_time", endISO)
        .order("start_time", { ascending: true });

      setConflictBookings(data || []);
      setLoadingConflicts(false);
    };
    loadConflicts();
  }, [editingRoom, form.privatized_from, form.privatized_until]);

  const openNew = () => {
    setEditingRoom(null);
    setForm({
      name: "", description: "", capacity: "1", hourly_rate: "0",
      equipment: "", floor: "", surface_area: "", is_available: true, photos: [],
      pricing: [...defaultPricing],
      credits_info: defaultCreditsInfo,
      min_monthly_price: "",
      min_monthly_hours: "",
      privatized_from: "",
      privatized_until: "",
    });
    setShowDialog(true);
  };

  const openDefaultsDialog = () => {
    setDefaultsForm({ pricing: [...defaultPricing], credits_info: defaultCreditsInfo });
    setShowDefaultsDialog(true);
  };

  const addDefaultPricingItem = () => {
    setDefaultsForm((prev) => ({ ...prev, pricing: [...prev.pricing, { label: "", price: 0 }] }));
  };

  const updateDefaultPricingItem = (index: number, field: keyof PricingItem, value: string | number) => {
    setDefaultsForm((prev) => ({
      ...prev,
      pricing: prev.pricing.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    }));
  };

  const removeDefaultPricingItem = (index: number) => {
    setDefaultsForm((prev) => ({ ...prev, pricing: prev.pricing.filter((_, i) => i !== index) }));
  };

  const saveDefaults = async () => {
    const cleanPricing = defaultsForm.pricing.filter((p) => p.label.trim());
    const { error } = await supabase
      .from("settings")
      .update({ value: { pricing: cleanPricing, credits_info: defaultsForm.credits_info } as any })
      .eq("key", "default_room_pricing");
    if (error) {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
      return;
    }
    setDefaultPricing(cleanPricing);
    setDefaultCreditsInfo(defaultsForm.credits_info);
    setShowDefaultsDialog(false);
    toast({ title: "Tarifs par défaut enregistrés ✅" });
  };

  const openEdit = (room: Room) => {
    setEditingRoom(room);
    setForm({
      name: room.name,
      description: room.description || "",
      capacity: String(room.capacity || 1),
      hourly_rate: String(room.hourly_rate || 0),
      equipment: (room.equipment || []).join(", "),
      floor: room.floor || "",
      surface_area: room.surface_area ? String(room.surface_area) : "",
      is_available: room.is_available,
      photos: room.photos || [],
      pricing: (room.pricing as PricingItem[]) || [],
      credits_info: room.credits_info || "",
      min_monthly_price: (room as any).min_monthly_price != null ? String((room as any).min_monthly_price) : "",
      min_monthly_hours: (room as any).min_monthly_hours != null ? String((room as any).min_monthly_hours) : "",
      privatized_from: room.privatized_from || "",
      privatized_until: room.privatized_until || "",
    });
    setShowDialog(true);
  };

  const addPricingItem = () => {
    setForm((prev) => ({
      ...prev,
      pricing: [...prev.pricing, { label: "", price: 0 }],
    }));
  };

  const updatePricingItem = (index: number, field: keyof PricingItem, value: string | number) => {
    setForm((prev) => ({
      ...prev,
      pricing: prev.pricing.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const removePricingItem = (index: number) => {
    setForm((prev) => ({
      ...prev,
      pricing: prev.pricing.filter((_, i) => i !== index),
    }));
  };

  const handleSave = async () => {
    const payload: any = {
      name: form.name,
      description: form.description,
      capacity: parseInt(form.capacity) || 1,
      hourly_rate: parseFloat(form.hourly_rate) || 0,
      equipment: form.equipment.split(",").map((s) => s.trim()).filter(Boolean),
      floor: form.floor,
      surface_area: form.surface_area ? parseInt(form.surface_area) : null,
      is_available: form.is_available,
      photos: form.photos,
      pricing: form.pricing.filter((p) => p.label.trim()),
      credits_info: form.credits_info,
      min_monthly_price: form.min_monthly_price ? parseFloat(form.min_monthly_price) : null,
      min_monthly_hours: form.min_monthly_hours ? parseFloat(form.min_monthly_hours) : null,
      privatized_from: form.privatized_from || null,
      privatized_until: form.privatized_until || null,
    };

    // Validation: end date must be >= start date
    if (form.privatized_from && form.privatized_until && form.privatized_until < form.privatized_from) {
      toast({ variant: "destructive", title: "Dates invalides", description: "La date de fin doit être postérieure à la date de début." });
      return;
    }
    // Validation: end date alone is meaningless
    if (form.privatized_until && !form.privatized_from) {
      toast({ variant: "destructive", title: "Date de début manquante", description: "Veuillez aussi renseigner la date de début de privatisation." });
      return;
    }

    const previousFrom = editingRoom?.privatized_from || null;
    const previousUntil = editingRoom?.privatized_until || null;
    const newFrom = payload.privatized_from;
    const newUntil = payload.privatized_until;
    const privatizationChanged =
      payload.is_available &&
      newFrom &&
      (previousFrom !== newFrom || previousUntil !== newUntil);

    let savedRoomId: string | null = editingRoom?.id || null;

    if (editingRoom) {
      const { error } = await supabase.from("rooms").update(payload).eq("id", editingRoom.id);
      if (error) {
        toast({ variant: "destructive", title: "Erreur", description: error.message });
        return;
      }
      toast({ title: "Salle modifiée ✅" });
    } else {
      const { data, error } = await supabase.from("rooms").insert(payload).select("id").single();
      if (error) {
        toast({ variant: "destructive", title: "Erreur", description: error.message });
        return;
      }
      savedRoomId = data?.id || null;
      toast({ title: "Salle créée ✅" });
    }

    // Notify practitioners with conflicting bookings (in-app + email)
    if (privatizationChanged && savedRoomId) {
      const { data: notifResult, error: notifErr } = await supabase.functions.invoke(
        "notify-privatization-immediate",
        { body: { room_id: savedRoomId } }
      );
      if (notifErr) {
        console.error("notify-privatization-immediate failed", notifErr);
      } else if (notifResult?.notified > 0) {
        toast({
          title: "Praticiens notifiés 📧",
          description: `${notifResult.notified} praticien${notifResult.notified > 1 ? "s" : ""} concerné${notifResult.notified > 1 ? "s" : ""} prévenu${notifResult.notified > 1 ? "s" : ""} par notification et email.`,
        });
      }
    }

    setShowDialog(false);
    fetchRooms();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("rooms").delete().eq("id", deleteId);
    if (!error) {
      toast({ title: "Salle supprimée" });
      fetchRooms();
    }
    setDeleteId(null);
  };

  const addPhoto = (url: string) => {
    setForm((prev) => ({ ...prev, photos: [...prev.photos, url] }));
  };

  const removePhoto = (index: number) => {
    setForm((prev) => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index),
    }));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-bold">Nos Cabinets</h2>
            <p className="text-muted-foreground text-sm mt-0.5">
              Gérez vos espaces, tarifs et disponibilités.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={openDefaultsDialog}>
              <Settings className="h-4 w-4 mr-2" />
              Tarifs par défaut
            </Button>
            <Button onClick={openNew}>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau cabinet
            </Button>
          </div>
        </div>

        {/* Room cards */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : rooms.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <DoorOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">Aucun cabinet créé.</p>
                <Button variant="outline" className="mt-3" onClick={openNew}>
                  Créer un cabinet
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {rooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                onEdit={() => openEdit(room)}
                onDelete={() => setDeleteId(room.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editingRoom ? "Modifier le cabinet" : "Nouveau cabinet"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Photos */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Photos</Label>
              <div className="flex flex-wrap gap-3">
                {form.photos.map((url, i) => (
                  <div key={i} className="relative group w-24 h-24 rounded-xl overflow-hidden border border-border">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute top-1 right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <ImageUpload
                  bucket="room-photos"
                  folder={editingRoom?.id || "new"}
                  currentUrl={null}
                  onUpload={addPhoto}
                  shape="rounded"
                  className="w-24 h-24"
                  placeholder={
                    <div className="flex flex-col items-center gap-1 p-2">
                      <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
                      <span className="text-[9px] text-muted-foreground/60">Ajouter</span>
                    </div>
                  }
                />
              </div>
            </div>

            <div>
              <Label>Nom du cabinet</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1.5"
                placeholder="Ex: Cabinet 01"
                required
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="mt-1.5"
                rows={3}
                placeholder="Décrivez le cabinet, son ambiance, ses caractéristiques..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Étage</Label>
                <Input
                  value={form.floor}
                  onChange={(e) => setForm({ ...form, floor: e.target.value })}
                  className="mt-1.5"
                  placeholder="Ex: RDC, 1er, 2ème"
                />
              </div>
              <div>
                <Label>Superficie (m²)</Label>
                <Input
                  type="number"
                  value={form.surface_area}
                  onChange={(e) => setForm({ ...form, surface_area: e.target.value })}
                  className="mt-1.5"
                  min="0"
                  placeholder="Ex: 15"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Capacité (personnes)</Label>
                <Input
                  type="number"
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                  className="mt-1.5"
                  min="1"
                />
              </div>
              <div>
                <Label>Tarif horaire (€)</Label>
                <Input
                  type="number"
                  value={form.hourly_rate}
                  onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })}
                  className="mt-1.5"
                  min="0"
                  step="0.5"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Forfait mensuel min (€)</Label>
                <Input
                  type="number"
                  value={form.min_monthly_price}
                  onChange={(e) => setForm({ ...form, min_monthly_price: e.target.value })}
                  className="mt-1.5"
                  min="0"
                  step="1"
                  placeholder="Ex: 158"
                />
              </div>
              <div>
                <Label>Heures/mois minimum</Label>
                <Input
                  type="number"
                  value={form.min_monthly_hours}
                  onChange={(e) => setForm({ ...form, min_monthly_hours: e.target.value })}
                  className="mt-1.5"
                  min="0"
                  step="0.5"
                  placeholder="Ex: 4"
                />
              </div>
            </div>

            <div>
              <Label>Équipements (séparés par des virgules)</Label>
              <Input
                value={form.equipment}
                onChange={(e) => setForm({ ...form, equipment: e.target.value })}
                placeholder="Wi-Fi, Bureau, Lit d'examen, Eau..."
                className="mt-1.5"
              />
            </div>

            {/* Pricing / Forfaits */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Grille tarifaire (forfaits)</Label>
              <div>
                <Label className="text-xs text-muted-foreground">Note crédits (ex: 1€ = 2 crédits)</Label>
                <Input
                  value={form.credits_info}
                  onChange={(e) => setForm({ ...form, credits_info: e.target.value })}
                  className="mt-1 mb-3"
                  placeholder="Ex: 1€ = 2 crédits. Exemple: 25€ = 50 crédits."
                />
              </div>
              <div className="space-y-2">
                {form.pricing.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={item.label}
                      onChange={(e) => updatePricingItem(i, "label", e.target.value)}
                      placeholder="Ex: 1j/sem."
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={item.price}
                      onChange={(e) => updatePricingItem(i, "price", parseFloat(e.target.value) || 0)}
                      className="w-24"
                      min="0"
                    />
                    <span className="text-xs text-muted-foreground">€</span>
                    <button
                      type="button"
                      onClick={() => removePricingItem(i)}
                      className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-destructive/10 text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" className="mt-2" onClick={addPricingItem}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Ajouter un forfait
              </Button>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label className="text-sm">Privatisé immédiatement</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Désactivez pour privatiser ce cabinet de façon permanente (jusqu'à réactivation manuelle).
                </p>
              </div>
              <Switch
                checked={form.is_available}
                onCheckedChange={(checked) => setForm({ ...form, is_available: checked })}
              />
            </div>

            {/* Scheduled privatization */}
            <div className="rounded-lg border border-border p-3 space-y-3">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-primary" />
                <Label className="text-sm font-medium">Privatisation programmée (optionnel)</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Programmez la privatisation du cabinet à partir d'une date. Laissez la date de fin vide pour une privatisation indéfinie.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">À partir du</Label>
                  <Input
                    type="date"
                    value={form.privatized_from}
                    onChange={(e) => setForm({ ...form, privatized_from: e.target.value })}
                    className="mt-1"
                    disabled={!form.is_available}
                  />
                </div>
                <div>
                  <Label className="text-xs">Jusqu'au (optionnel)</Label>
                  <Input
                    type="date"
                    value={form.privatized_until}
                    onChange={(e) => setForm({ ...form, privatized_until: e.target.value })}
                    className="mt-1"
                    min={form.privatized_from || undefined}
                    disabled={!form.is_available || !form.privatized_from}
                  />
                </div>
              </div>
              {(form.privatized_from || form.privatized_until) && (
                <button
                  type="button"
                  onClick={() => setForm({ ...form, privatized_from: "", privatized_until: "" })}
                  className="text-xs text-muted-foreground hover:text-destructive underline"
                >
                  Effacer les dates programmées
                </button>
              )}
              {!form.is_available && (form.privatized_from || form.privatized_until) && (
                <p className="text-xs text-destructive bg-destructive/10 px-2 py-1 rounded">
                  ⚠ Le cabinet est privatisé immédiatement, la programmation est ignorée.
                </p>
              )}

              {/* Conflict warning: existing bookings overlapping the scheduled period */}
              {editingRoom && form.is_available && form.privatized_from && (
                <>
                  {loadingConflicts ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Vérification des réservations existantes…
                    </div>
                  ) : conflictBookings.length > 0 ? (
                    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                        <div className="text-xs">
                          <p className="font-medium text-destructive">
                            {conflictBookings.length} réservation{conflictBookings.length > 1 ? "s" : ""} en conflit avec cette période
                          </p>
                          <p className="text-muted-foreground mt-0.5">
                            Ces créneaux sont déjà réservés sur la période programmée. Pensez à prévenir les praticiens concernés ou à les annuler manuellement avant la date d'effet.
                          </p>
                        </div>
                      </div>
                      <ul className="max-h-40 overflow-y-auto space-y-1 text-xs pl-6">
                        {conflictBookings.slice(0, 20).map((b: any) => {
                          const start = new Date(b.start_time);
                          const end = new Date(b.end_time);
                          const dateStr = new Intl.DateTimeFormat("fr-BE", {
                            timeZone: "Europe/Brussels",
                            day: "2-digit", month: "2-digit", year: "numeric",
                          }).format(start);
                          const startStr = new Intl.DateTimeFormat("fr-BE", {
                            timeZone: "Europe/Brussels",
                            hour: "2-digit", minute: "2-digit",
                          }).format(start);
                          const endStr = new Intl.DateTimeFormat("fr-BE", {
                            timeZone: "Europe/Brussels",
                            hour: "2-digit", minute: "2-digit",
                          }).format(end);
                          const name = b.profiles
                            ? `${b.profiles.first_name || ""} ${b.profiles.last_name || ""}`.trim() || "Praticien"
                            : "Praticien";
                          return (
                            <li key={b.id} className="flex items-center justify-between gap-2 text-foreground">
                              <span className="truncate">
                                <span className="font-medium">{dateStr}</span>{" "}
                                <span className="text-muted-foreground">{startStr}–{endStr}</span>{" "}
                                · {name}
                              </span>
                              {b.status === "pending" && (
                                <Badge variant="outline" className="h-5 text-[10px]">en attente</Badge>
                              )}
                            </li>
                          );
                        })}
                        {conflictBookings.length > 20 && (
                          <li className="text-muted-foreground italic">
                            …et {conflictBookings.length - 20} autre{conflictBookings.length - 20 > 1 ? "s" : ""}
                          </li>
                        )}
                      </ul>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="w-full"
                        onClick={() => setShowCancelConflictsConfirm(true)}
                        disabled={cancellingConflicts}
                      >
                        {cancellingConflicts ? (
                          <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Annulation…</>
                        ) : (
                          <>Annuler toutes les réservations en conflit ({conflictBookings.length})</>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      ✓ Aucune réservation existante sur cette période.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={!form.name.trim()}>
              {editingRoom ? "Enregistrer" : "Créer le cabinet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce cabinet ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Toutes les réservations associées seront également supprimées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel all conflicting bookings confirmation */}
      <AlertDialog open={showCancelConflictsConfirm} onOpenChange={setShowCancelConflictsConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler {conflictBookings.length} réservation{conflictBookings.length > 1 ? "s" : ""} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Toutes les réservations en conflit avec la période de privatisation programmée vont passer au statut <strong>annulé</strong>. Les praticiens concernés recevront une notification automatique. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancellingConflicts}>Retour</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelAllConflicts}
              disabled={cancellingConflicts}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancellingConflicts ? "Annulation…" : "Confirmer l'annulation"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Default Pricing Dialog */}
      <Dialog open={showDefaultsDialog} onOpenChange={setShowDefaultsDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Tarifs par défaut</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Ces tarifs seront automatiquement pré-remplis lors de la création d'un nouveau cabinet.
          </p>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-muted-foreground">Note crédits</Label>
              <Input
                value={defaultsForm.credits_info}
                onChange={(e) => setDefaultsForm({ ...defaultsForm, credits_info: e.target.value })}
                className="mt-1"
                placeholder="Ex: 1€ = 2 crédits"
              />
            </div>

            <div>
              <Label className="text-sm font-medium mb-2 block">Forfaits</Label>
              <div className="space-y-2">
                {defaultsForm.pricing.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={item.label}
                      onChange={(e) => updateDefaultPricingItem(i, "label", e.target.value)}
                      placeholder="Ex: 1j/sem."
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={item.price}
                      onChange={(e) => updateDefaultPricingItem(i, "price", parseFloat(e.target.value) || 0)}
                      className="w-24"
                      min="0"
                    />
                    <span className="text-xs text-muted-foreground">€</span>
                    <button
                      type="button"
                      onClick={() => removeDefaultPricingItem(i)}
                      className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-destructive/10 text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" className="mt-2" onClick={addDefaultPricingItem}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Ajouter un forfait
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDefaultsDialog(false)}>Annuler</Button>
            <Button onClick={saveDefaults}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

/* ─── Room Card Component ─── */

const RoomCard = ({
  room,
  onEdit,
  onDelete,
}: {
  room: Room;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  const mainPhoto = room.photos?.[0];

  return (
    <Card className="overflow-hidden group hover:shadow-md transition-shadow">
      {/* Photo */}
      <div className="relative h-48 bg-muted">
        {mainPhoto ? (
          <img src={mainPhoto} alt={room.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <DoorOpen className="h-12 w-12 text-muted-foreground/20" />
          </div>
        )}

        {/* Photo count badge */}
        {room.photos && room.photos.length > 1 && (
          <div className="absolute bottom-2 left-2 bg-foreground/70 text-background text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
            <ImageIcon className="h-3 w-3" />
            {room.photos.length} photos
          </div>
        )}

        {/* Status badge (Indisponible / Privatisé / Programmé) */}
        <div className="absolute top-2 left-2 max-w-[calc(100%-5rem)]">
          <RoomStatusBadge room={room} compact className="shadow-sm" />
        </div>

        {/* Action buttons */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="icon" variant="secondary" className="h-8 w-8 shadow-sm" onClick={onEdit}>
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="secondary" className="h-8 w-8 shadow-sm" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-display font-semibold text-lg">{room.name}</h3>
          {room.surface_area && (
            <Badge variant="outline" className="text-xs font-medium shrink-0 ml-2">
              {room.surface_area}m²
            </Badge>
          )}
        </div>

        {room.floor && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
            <MapPin className="h-3 w-3" />
            {room.floor}
          </div>
        )}

        {room.description && (
          <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
            {room.description}
          </p>
        )}

        {/* Equipment pills */}
        {room.equipment && room.equipment.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Équipements disponibles</p>
            <div className="flex flex-wrap gap-1.5">
              {room.equipment.slice(0, 4).map((eq) => (
                <Badge key={eq} variant="secondary" className="text-[11px] font-normal">
                  {eq}
                </Badge>
              ))}
              {room.equipment.length > 4 && (
                <Badge variant="secondary" className="text-[11px] font-normal">
                  +{room.equipment.length - 4} autres
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Bottom stats */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <div className="flex items-center gap-1 text-sm">
            <Euro className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold">{room.hourly_rate}€</span>
            <span className="text-xs text-muted-foreground">/heure</span>
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>{room.capacity} pers. max</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminRooms;
