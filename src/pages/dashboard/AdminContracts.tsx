import { useState, useMemo } from "react";
import PractitionerDiscounts from "@/components/dashboard/contracts/PractitionerDiscounts";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
import { Plus, Pencil, Trash2, FileSignature } from "lucide-react";
import { toast } from "sonner";

interface Room {
  id: string;
  name: string;
  pricing: { label: string; price: number }[] | null;
  hourly_rate: number | null;
}
interface Profile {
  id: string;
  first_name: string;
  last_name: string;
}
interface Package {
  id: string;
  practitioner_id: string;
  room_id: string;
  package_label: string;
  monthly_fee: number;
  is_active: boolean;
  start_date: string;
  end_date: string | null;
  notes: string | null;
  profiles?: { first_name: string; last_name: string } | null;
  rooms?: { name: string } | null;
}

interface EditState {
  id?: string;
  practitioner_id: string;
  room_id: string;
  package_label: string;
  monthly_fee: string;
  is_active: boolean;
  start_date: string;
  end_date: string;
  notes: string;
  source: "grid" | "custom";
}

const todayIso = () => new Date().toISOString().slice(0, 10);

const emptyForm: EditState = {
  practitioner_id: "",
  room_id: "",
  package_label: "",
  monthly_fee: "",
  is_active: true,
  start_date: todayIso(),
  end_date: "",
  notes: "",
  source: "grid",
};

const fmtDate = (iso?: string | null) =>
  iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("fr-BE") : null;


const AdminContracts = () => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<EditState | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ["admin-packages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practitioner_room_packages")
        .select("*, profiles!practitioner_room_packages_practitioner_id_fkey(first_name, last_name), rooms(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Package[];
    },
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ["admin-packages-rooms"],
    queryFn: async () => {
      const { data } = await supabase.from("rooms").select("id, name, pricing, hourly_rate").order("name");
      return (data ?? []) as unknown as Room[];
    },
  });

  const { data: practitioners = [] } = useQuery({
    queryKey: ["admin-packages-practitioners"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .order("last_name");
      return (data ?? []) as Profile[];
    },
  });

  const selectedRoom = useMemo(
    () => rooms.find((r) => r.id === editing?.room_id) ?? null,
    [rooms, editing?.room_id],
  );

  const upsertMutation = useMutation({
    mutationFn: async (payload: EditState) => {
      const row = {
        practitioner_id: payload.practitioner_id,
        room_id: payload.room_id,
        package_label: payload.package_label.trim(),
        monthly_fee: Number(payload.monthly_fee),
        is_active: payload.is_active,
        start_date: payload.start_date || todayIso(),
        end_date: payload.end_date || null,
        notes: payload.notes.trim() || null,
      };
      if (payload.id) {
        const { error } = await supabase
          .from("practitioner_room_packages")
          .update(row)
          .eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("practitioner_room_packages").insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-packages"] });
      qc.invalidateQueries({ queryKey: ["admin-analytics-packages"] });
      setEditing(null);
      toast.success("Forfait enregistré");
    },
    onError: (err: any) => toast.error(err?.message ?? "Erreur"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("practitioner_room_packages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-packages"] });
      qc.invalidateQueries({ queryKey: ["admin-analytics-packages"] });
      setDeleteId(null);
      toast.success("Forfait supprimé");
    },
    onError: (err: any) => toast.error(err?.message ?? "Erreur"),
  });

  const startCreate = () => setEditing({ ...emptyForm });
  const startEdit = (p: Package) =>
    setEditing({
      id: p.id,
      practitioner_id: p.practitioner_id,
      room_id: p.room_id,
      package_label: p.package_label,
      monthly_fee: String(p.monthly_fee),
      is_active: p.is_active,
      start_date: p.start_date ?? todayIso(),
      end_date: p.end_date ?? "",
      notes: p.notes ?? "",
      source: "custom",
    });

  const handleGridSelect = (label: string) => {
    if (!editing || !selectedRoom?.pricing) return;
    const item = selectedRoom.pricing.find((x) => x.label === label);
    if (!item) return;
    setEditing({
      ...editing,
      package_label: item.label,
      monthly_fee: String(item.price),
    });
  };

  const canSave =
    !!editing?.practitioner_id &&
    !!editing?.room_id &&
    !!editing?.package_label.trim() &&
    Number(editing?.monthly_fee) > 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <FileSignature className="h-6 w-6 text-primary" /> Forfaits locataires
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Contrats mensuels praticien × salle. Quand un forfait est actif, le CA du mois utilise
              le forfait au lieu du calcul horaire pour ce praticien sur cette salle.
            </p>
          </div>
          <Button onClick={startCreate}>
            <Plus className="h-4 w-4 mr-2" /> Nouveau forfait
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Forfaits actifs & historique</CardTitle>
            <CardDescription>
              {packages.filter((p) => p.is_active).length} actif(s) · {packages.length} au total
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Chargement…</p>
            ) : packages.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Aucun forfait encodé. Cliquez sur « Nouveau forfait » pour commencer.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Praticien</TableHead>
                    <TableHead>Salle</TableHead>
                    <TableHead>Forfait</TableHead>
                    <TableHead className="text-right">Mensuel HTVA</TableHead>
                    <TableHead>Validité</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {packages.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        {p.profiles ? `${p.profiles.first_name} ${p.profiles.last_name}` : "—"}
                      </TableCell>
                      <TableCell>{p.rooms?.name ?? "—"}</TableCell>
                      <TableCell>{p.package_label}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">
                        {Number(p.monthly_fee).toFixed(2)} €
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {fmtDate(p.start_date) ?? "—"} →{" "}
                        {p.end_date ? fmtDate(p.end_date) : "permanent"}
                      </TableCell>
                      <TableCell>
                        {!p.is_active ? (
                          <Badge variant="secondary">Inactif</Badge>
                        ) : p.end_date && p.end_date < todayIso() ? (
                          <Badge variant="secondary" className="bg-muted text-muted-foreground">
                            Échu — tarif plein
                          </Badge>
                        ) : p.start_date > todayIso() ? (
                          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">À venir</Badge>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Actif</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => startEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setDeleteId(p.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <PractitionerDiscounts />

      </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Modifier le forfait" : "Nouveau forfait locataire"}</DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Praticien</Label>
                  <Select
                    value={editing.practitioner_id}
                    onValueChange={(v) => setEditing({ ...editing, practitioner_id: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                    <SelectContent>
                      {practitioners.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.first_name} {p.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Salle</Label>
                  <Select
                    value={editing.room_id}
                    onValueChange={(v) => setEditing({ ...editing, room_id: v, package_label: "", monthly_fee: "" })}
                  >
                    <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                    <SelectContent>
                      {rooms.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Source du montant</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={editing.source === "grid" ? "default" : "outline"}
                    onClick={() => setEditing({ ...editing, source: "grid" })}
                  >
                    Grille tarifaire
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={editing.source === "custom" ? "default" : "outline"}
                    onClick={() => setEditing({ ...editing, source: "custom" })}
                  >
                    Montant libre
                  </Button>
                </div>
              </div>

              {editing.source === "grid" ? (
                <div className="space-y-1.5">
                  <Label>Forfait de la grille</Label>
                  {selectedRoom?.pricing && selectedRoom.pricing.length > 0 ? (
                    <Select value={editing.package_label} onValueChange={handleGridSelect}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner un forfait…" /></SelectTrigger>
                      <SelectContent>
                        {selectedRoom.pricing.map((it) => (
                          <SelectItem key={it.label} value={it.label}>
                            {it.label} — {it.price} € HTVA
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {editing.room_id
                        ? "Aucune grille tarifaire encodée pour cette salle. Utilisez « Montant libre »."
                        : "Sélectionnez d'abord une salle."}
                    </p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Libellé</Label>
                    <Input
                      placeholder="ex. 2j/sem."
                      value={editing.package_label}
                      onChange={(e) => setEditing({ ...editing, package_label: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Montant mensuel HTVA (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editing.monthly_fee}
                      onChange={(e) => setEditing({ ...editing, monthly_fee: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {editing.source === "grid" && editing.package_label && (
                <div className="rounded-md border bg-muted/30 p-3 text-sm">
                  <span className="text-muted-foreground">Sélection :</span>{" "}
                  <strong>{editing.package_label}</strong> — {editing.monthly_fee} € HTVA / mois
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Notes (optionnel)</Label>
                <Textarea
                  rows={2}
                  value={editing.notes}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                  placeholder="Ex. début 01/09/2026, tacite reconduction…"
                />
              </div>

              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Forfait actif</p>
                  <p className="text-xs text-muted-foreground">
                    Désactiver pour arrêter la facturation forfaitaire sans supprimer l'historique.
                  </p>
                </div>
                <Switch
                  checked={editing.is_active}
                  onCheckedChange={(v) => setEditing({ ...editing, is_active: v })}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Annuler</Button>
            <Button
              disabled={!canSave || upsertMutation.isPending}
              onClick={() => editing && upsertMutation.mutate(editing)}
            >
              {upsertMutation.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce forfait ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le CA des mois passés recalculera automatiquement à partir
              des tarifs horaires. Préférez désactiver le forfait pour conserver l'historique.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default AdminContracts;
