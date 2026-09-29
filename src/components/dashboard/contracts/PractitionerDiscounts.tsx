import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Percent, Plus, Pencil, Trash2 } from "lucide-react";

interface DiscountRow {
  id: string;
  practitioner_id: string;
  room_id: string | null;
  discount_type: string;
  discount_value: number;
  label: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  notes: string | null;
  applies_to: string;
  profiles?: { first_name: string; last_name: string } | null;
  rooms?: { name: string } | null;
}

interface FormState {
  id?: string;
  practitioner_id: string;
  room_id: string;
  discount_type: string;
  discount_value: string;
  label: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  notes: string;
  applies_to: string;
}

const emptyForm: FormState = {
  practitioner_id: "",
  room_id: "all",
  discount_type: "percent",
  discount_value: "",
  label: "",
  start_date: new Date().toISOString().slice(0, 10),
  end_date: "",
  is_active: true,
  notes: "",
  applies_to: "hourly",
};

const SCOPE_LABELS: Record<string, string> = {
  hourly: "Tarif horaire",
  package: "Forfait",
  both: "Les deux",
};

const TYPE_LABELS: Record<string, string> = {
  percent: "Pourcentage",
  amount: "Montant fixe",
  hourly_rate: "Tarif horaire négocié",
};

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("fr-BE", { timeZone: "Europe/Brussels", dateStyle: "medium" }).format(
    new Date(`${iso}T12:00:00Z`)
  );

const formatValue = (row: Pick<DiscountRow, "discount_type" | "discount_value">) => {
  const v = Number(row.discount_value);
  if (row.discount_type === "percent") return `−${v} %`;
  if (row.discount_type === "amount") return `−${v} € HTVA`;
  return `${v} €/h HTVA`;
};

const PractitionerDiscounts = () => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<FormState | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: discounts = [], isLoading } = useQuery({
    queryKey: ["practitioner-discounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practitioner_discounts")
        .select("*, profiles(first_name, last_name), rooms(name)")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as DiscountRow[];
    },
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ["discount-rooms"],
    queryFn: async () => {
      const { data } = await supabase.from("rooms").select("id, name").order("name");
      return data || [];
    },
  });

  const { data: practitioners = [] } = useQuery({
    queryKey: ["discount-practitioners"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .order("last_name");
      return data || [];
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (form: FormState) => {
      const row = {
        practitioner_id: form.practitioner_id,
        room_id: form.room_id === "all" ? null : form.room_id,
        discount_value: Number(form.discount_value),
        label: form.label || null,
        start_date: form.start_date || null,
        applies_to: form.applies_to,
        discount_type: form.applies_to !== "hourly" && form.discount_type === "hourly_rate" ? "percent" : form.discount_type,
        end_date: form.end_date || null,
        is_active: form.is_active,
        notes: form.notes || null,
      };
      if (form.id) {
        const { error } = await supabase
          .from("practitioner_discounts")
          .update(row)
          .eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("practitioner_discounts").insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["practitioner-discounts"] });
      setEditing(null);
      toast.success("Remise enregistrée");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("practitioner_discounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["practitioner-discounts"] });
      setDeleteId(null);
      toast.success("Remise supprimée");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const canSave =
    !!editing?.practitioner_id &&
    Number(editing?.discount_value) > 0;

  const isExpired = (row: DiscountRow) =>
    !!row.end_date && row.end_date < new Date().toISOString().slice(0, 10);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5 text-primary" /> Remises contractuelles
            </CardTitle>
            <CardDescription>
              Remises appliquées automatiquement au tarif horaire et/ou au forfait du praticien
              (dates de début et d'échéance facultatives). Une remise encodée directement sur une réservation prend le
              lead sur celle-ci.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setEditing({ ...emptyForm })}>
            <Plus className="h-4 w-4 mr-1" /> Nouvelle remise
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : discounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune remise contractuelle encodée.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Praticien</TableHead>
                  <TableHead>Salle</TableHead>
                  <TableHead>S'applique à</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Remise</TableHead>
                  <TableHead>Période</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {discounts.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">
                      {d.profiles ? `${d.profiles.first_name} ${d.profiles.last_name}` : "—"}
                    </TableCell>
                    <TableCell>{d.rooms?.name || "Toutes les salles"}</TableCell>
                    <TableCell>{SCOPE_LABELS[d.applies_to] || "Tarif horaire"}</TableCell>
                    <TableCell>{TYPE_LABELS[d.discount_type] || d.discount_type}</TableCell>
                    <TableCell className="font-semibold">{formatValue(d)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {d.start_date ? `dès le ${formatDate(d.start_date)}` : "immédiate"}
                      {d.end_date ? ` — jusqu'au ${formatDate(d.end_date)}` : " (sans échéance)"}
                    </TableCell>
                    <TableCell>
                      {!d.is_active ? (
                        <Badge variant="secondary">Inactive</Badge>
                      ) : isExpired(d) ? (
                        <Badge variant="outline" className="border-warning/50 bg-warning/10 text-warning">
                          Échue
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-success/40 text-success">
                          Active
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setEditing({
                            id: d.id,
                            practitioner_id: d.practitioner_id,
                            room_id: d.room_id || "all",
                            discount_type: d.discount_type,
                            discount_value: String(d.discount_value),
                            label: d.label || "",
                            start_date: d.start_date || "",
                            applies_to: d.applies_to || "hourly",
                            end_date: d.end_date || "",
                            is_active: d.is_active,
                            notes: d.notes || "",
                          })
                        }
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(d.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Modifier la remise" : "Nouvelle remise"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Praticien</Label>
                <Select
                  value={editing.practitioner_id}
                  onValueChange={(v) => setEditing({ ...editing, practitioner_id: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Choisir un praticien" /></SelectTrigger>
                  <SelectContent>
                    {practitioners.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.first_name} {p.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Salle concernée</Label>
                <Select
                  value={editing.room_id}
                  onValueChange={(v) => setEditing({ ...editing, room_id: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les salles</SelectItem>
                    {rooms.map((r: any) => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>S'applique à</Label>
                <Select
                  value={editing.applies_to}
                  onValueChange={(v) =>
                    setEditing({
                      ...editing,
                      applies_to: v,
                      discount_type: v !== "hourly" && editing.discount_type === "hourly_rate" ? "percent" : editing.discount_type,
                    })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Tarif horaire</SelectItem>
                    <SelectItem value="package">Forfait</SelectItem>
                    <SelectItem value="both">Les deux</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Type de remise</Label>
                  <Select
                    value={editing.discount_type}
                    onValueChange={(v) => setEditing({ ...editing, discount_type: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Pourcentage (%)</SelectItem>
                      <SelectItem value="amount">Montant fixe (€ HTVA)</SelectItem>
                      {editing.applies_to === "hourly" && (
                        <SelectItem value="hourly_rate">Tarif horaire négocié (€/h)</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Valeur</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editing.discount_value}
                    onChange={(e) => setEditing({ ...editing, discount_value: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Début (facultatif)</Label>
                  <Input
                    type="date"
                    value={editing.start_date}
                    onChange={(e) => setEditing({ ...editing, start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Échéance (facultative)</Label>
                  <Input
                    type="date"
                    value={editing.end_date}
                    onChange={(e) => setEditing({ ...editing, end_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Libellé</Label>
                <Input
                  value={editing.label}
                  onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                  placeholder="Ex. remise fidélité 2026"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <Label className="text-sm">Remise active</Label>
                  <p className="text-xs text-muted-foreground">
                    Désactivez pour la conserver dans l'historique sans l'appliquer.
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
            <Button variant="outline" onClick={() => setEditing(null)}>Annuler</Button>
            <Button
              disabled={!canSave || upsertMutation.isPending}
              onClick={() => editing && upsertMutation.mutate(editing)}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette remise ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les réservations concernées seront de nouveau facturées au tarif horaire plein.
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default PractitionerDiscounts;
