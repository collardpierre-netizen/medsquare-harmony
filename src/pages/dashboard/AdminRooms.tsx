import { useEffect, useState } from "react";
import { DoorOpen, Plus, Edit, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const AdminRooms = () => {
  const { toast } = useToast();
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingRoom, setEditingRoom] = useState<any>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    capacity: "1",
    hourly_rate: "0",
    equipment: "",
  });

  const fetchRooms = async () => {
    const { data } = await supabase.from("rooms").select("*").order("name");
    setRooms(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const openNew = () => {
    setEditingRoom(null);
    setForm({ name: "", description: "", capacity: "1", hourly_rate: "0", equipment: "" });
    setShowDialog(true);
  };

  const openEdit = (room: any) => {
    setEditingRoom(room);
    setForm({
      name: room.name,
      description: room.description || "",
      capacity: String(room.capacity || 1),
      hourly_rate: String(room.hourly_rate || 0),
      equipment: (room.equipment || []).join(", "),
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    const payload = {
      name: form.name,
      description: form.description,
      capacity: parseInt(form.capacity) || 1,
      hourly_rate: parseFloat(form.hourly_rate) || 0,
      equipment: form.equipment.split(",").map((s) => s.trim()).filter(Boolean),
    };

    if (editingRoom) {
      const { error } = await supabase
        .from("rooms")
        .update(payload)
        .eq("id", editingRoom.id);
      if (error) {
        toast({ variant: "destructive", title: "Erreur", description: error.message });
        return;
      }
      toast({ title: "Salle modifiée" });
    } else {
      const { error } = await supabase.from("rooms").insert(payload);
      if (error) {
        toast({ variant: "destructive", title: "Erreur", description: error.message });
        return;
      }
      toast({ title: "Salle créée" });
    }

    setShowDialog(false);
    fetchRooms();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("rooms").delete().eq("id", id);
    if (!error) {
      toast({ title: "Salle supprimée" });
      fetchRooms();
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-bold">Gestion des salles</h2>
            <p className="text-muted-foreground text-sm mt-0.5">
              Ajoutez, modifiez ou désactivez des salles.
            </p>
          </div>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle salle
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            ) : rooms.length === 0 ? (
              <div className="text-center py-12">
                <DoorOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">Aucune salle créée.</p>
                <Button variant="outline" className="mt-3" onClick={openNew}>
                  Créer une salle
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rooms.map((room: any) => (
                  <div
                    key={room.id}
                    className="p-5 rounded-xl border border-border hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-display font-semibold">{room.name}</h3>
                        <p className="text-muted-foreground text-xs mt-0.5">
                          {room.description || "Pas de description"}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(room)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(room.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>Capacité: {room.capacity}</span>
                      <span>•</span>
                      <span>{room.hourly_rate}€/h</span>
                    </div>
                    {room.equipment?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {room.equipment.map((eq: string) => (
                          <Badge key={eq} variant="secondary" className="text-[10px]">
                            {eq}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">
              {editingRoom ? "Modifier la salle" : "Nouvelle salle"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label>Nom de la salle</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1.5"
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
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Capacité</Label>
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
                  step="0.01"
                />
              </div>
            </div>
            <div>
              <Label>Équipements (séparés par des virgules)</Label>
              <Input
                value={form.equipment}
                onChange={(e) => setForm({ ...form, equipment: e.target.value })}
                placeholder="Wi-Fi, Bureau, Lit d'examen..."
                className="mt-1.5"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleSave}>{editingRoom ? "Modifier" : "Créer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AdminRooms;
