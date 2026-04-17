import { useEffect, useState, useCallback } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import { CalendarClock, Edit, Lock, AlertTriangle, Loader2, Trash2, DoorOpen, Ban, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface Room {
  id: string;
  name: string;
  floor: string | null;
  is_available: boolean;
  privatized_from: string | null;
  privatized_until: string | null;
}

interface PrivatizationRow {
  room: Room;
  status: "active" | "future";
  conflictCount: number;
}

const fmtDate = (s: string | null) => {
  if (!s) return "—";
  return new Intl.DateTimeFormat("fr-BE", {
    timeZone: "Europe/Brussels",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(s));
};

const today = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const monthLabel = (d: Date) =>
  new Intl.DateTimeFormat("fr-BE", {
    timeZone: "Europe/Brussels",
    month: "long",
    year: "numeric",
  }).format(d);

const AdminPrivatizations = () => {
  const [rows, setRows] = useState<PrivatizationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Room | null>(null);
  const [editFrom, setEditFrom] = useState("");
  const [editUntil, setEditUntil] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [loadingConflicts, setLoadingConflicts] = useState(false);
  const [confirmClear, setConfirmClear] = useState<Room | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: rooms, error } = await supabase
      .from("rooms")
      .select("id, name, floor, is_available, privatized_from, privatized_until")
      .or("privatized_from.not.is.null,privatized_until.not.is.null")
      .order("privatized_from", { ascending: true });

    if (error) {
      toast.error("Erreur lors du chargement des privatisations");
      setLoading(false);
      return;
    }

    const t = today();
    const enriched: PrivatizationRow[] = [];

    for (const r of (rooms || []) as Room[]) {
      // Skip past privatizations (ended before today)
      if (r.privatized_until && new Date(r.privatized_until) < t) continue;
      // Skip rooms with neither dates (shouldn't happen with our filter)
      if (!r.privatized_from && !r.privatized_until) continue;

      const fromDate = r.privatized_from ? new Date(r.privatized_from) : null;
      const status: "active" | "future" =
        fromDate && fromDate > t ? "future" : "active";

      // Count conflicting bookings on the privatization period
      const startISO = `${r.privatized_from || new Date().toISOString().slice(0, 10)}T00:00:00`;
      const endDate =
        r.privatized_until ||
        (() => {
          const d = new Date(r.privatized_from || new Date());
          d.setFullYear(d.getFullYear() + 1);
          return d.toISOString().slice(0, 10);
        })();
      const endISO = `${endDate}T23:59:59`;

      const { count } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("room_id", r.id)
        .neq("status", "cancelled")
        .gte("start_time", startISO)
        .lte("start_time", endISO);

      enriched.push({ room: r, status, conflictCount: count || 0 });
    }

    setRows(enriched);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Load conflicts when editing
  useEffect(() => {
    const run = async () => {
      if (!editing || !editFrom) {
        setConflicts([]);
        return;
      }
      setLoadingConflicts(true);
      const startISO = `${editFrom}T00:00:00`;
      const endDate = editUntil || (() => {
        const d = new Date(editFrom);
        d.setFullYear(d.getFullYear() + 1);
        return d.toISOString().slice(0, 10);
      })();
      const endISO = `${endDate}T23:59:59`;
      const { data } = await supabase
        .from("bookings")
        .select("id, start_time, end_time, status, profiles(first_name, last_name)")
        .eq("room_id", editing.id)
        .neq("status", "cancelled")
        .gte("start_time", startISO)
        .lte("start_time", endISO)
        .order("start_time", { ascending: true });
      setConflicts(data || []);
      setLoadingConflicts(false);
    };
    run();
  }, [editing, editFrom, editUntil]);

  const openEdit = (room: Room) => {
    setEditing(room);
    setEditFrom(room.privatized_from || "");
    setEditUntil(room.privatized_until || "");
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (editFrom && editUntil && editFrom > editUntil) {
      toast.error("La date de fin doit être postérieure à la date de début");
      return;
    }
    setSavingEdit(true);
    const { error } = await supabase
      .from("rooms")
      .update({
        privatized_from: editFrom || null,
        privatized_until: editUntil || null,
      })
      .eq("id", editing.id);
    setSavingEdit(false);
    if (error) {
      toast.error("Erreur : " + error.message);
      return;
    }
    toast.success("Privatisation mise à jour");
    setEditing(null);
    fetchData();
  };

  const clearPrivatization = async (room: Room) => {
    const { error } = await supabase
      .from("rooms")
      .update({ privatized_from: null, privatized_until: null })
      .eq("id", room.id);
    if (error) {
      toast.error("Erreur : " + error.message);
      return;
    }
    toast.success("Privatisation supprimée");
    setConfirmClear(null);
    fetchData();
  };

  // Group rows by month of privatized_from
  const grouped = rows.reduce<Record<string, PrivatizationRow[]>>((acc, r) => {
    const key = r.room.privatized_from
      ? monthLabel(new Date(r.room.privatized_from))
      : "Sans date de début";
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <CalendarClock className="h-6 w-6" />
              Privatisations programmées
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Vue d'ensemble des cabinets privatisés (en cours et à venir).
            </p>
          </div>
          <Badge variant="outline" className="text-sm">
            {rows.length} privatisation{rows.length > 1 ? "s" : ""}
          </Badge>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <Card className="p-12 text-center">
            <DoorOpen className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              Aucune privatisation programmée pour le moment.
            </p>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([month, items]) => (
              <div key={month}>
                <h2 className="text-sm font-semibold uppercase text-muted-foreground mb-2 capitalize">
                  {month}
                </h2>
                <div className="space-y-2">
                  {items.map(({ room, status, conflictCount }) => (
                    <Card key={room.id} className="p-4">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Lock className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold">{room.name}</span>
                            {room.floor && (
                              <span className="text-xs text-muted-foreground">
                                · {room.floor}
                              </span>
                            )}
                            <Badge
                              variant={status === "active" ? "destructive" : "secondary"}
                              className="text-[10px]"
                            >
                              {status === "active" ? "En cours" : "À venir"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Du <strong>{fmtDate(room.privatized_from)}</strong>{" "}
                            {room.privatized_until ? (
                              <>
                                au <strong>{fmtDate(room.privatized_until)}</strong>
                              </>
                            ) : (
                              <span className="italic">sans date de fin</span>
                            )}
                          </p>
                          {conflictCount > 0 && (
                            <div className="flex items-center gap-1 text-xs text-destructive">
                              <AlertTriangle className="h-3 w-3" />
                              {conflictCount} réservation{conflictCount > 1 ? "s" : ""} en conflit
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(room)}
                          >
                            <Edit className="h-3.5 w-3.5 mr-1" />
                            Modifier
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmClear(room)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la privatisation</DialogTitle>
            <DialogDescription>
              {editing?.name} — ajustez les dates ci-dessous.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit-from">Début</Label>
                <Input
                  id="edit-from"
                  type="date"
                  value={editFrom}
                  onChange={(e) => setEditFrom(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="edit-until">Fin</Label>
                <Input
                  id="edit-until"
                  type="date"
                  value={editUntil}
                  onChange={(e) => setEditUntil(e.target.value)}
                />
              </div>
            </div>

            {editing && editFrom && (
              <>
                {loadingConflicts ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Vérification des réservations…
                  </div>
                ) : conflicts.length > 0 ? (
                  <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                      <div className="text-xs">
                        <p className="font-medium text-destructive">
                          {conflicts.length} réservation{conflicts.length > 1 ? "s" : ""} en conflit
                        </p>
                        <p className="text-muted-foreground mt-0.5">
                          Ces créneaux sont déjà réservés. Pensez à prévenir les praticiens.
                        </p>
                      </div>
                    </div>
                    <ul className="max-h-32 overflow-y-auto space-y-1 text-xs pl-6">
                      {conflicts.slice(0, 10).map((b: any) => {
                        const start = new Date(b.start_time);
                        const dateStr = new Intl.DateTimeFormat("fr-BE", {
                          timeZone: "Europe/Brussels",
                          day: "2-digit", month: "2-digit", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        }).format(start);
                        const name = b.profiles
                          ? `${b.profiles.first_name || ""} ${b.profiles.last_name || ""}`.trim()
                          : "Praticien";
                        return (
                          <li key={b.id} className="text-foreground">
                            <span className="font-medium">{dateStr}</span> · {name}
                          </li>
                        );
                      })}
                      {conflicts.length > 10 && (
                        <li className="text-muted-foreground italic">
                          …et {conflicts.length - 10} autre{conflicts.length - 10 > 1 ? "s" : ""}
                        </li>
                      )}
                    </ul>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    ✓ Aucune réservation existante sur cette période.
                  </p>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Annuler
            </Button>
            <Button onClick={saveEdit} disabled={savingEdit}>
              {savingEdit && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm clear privatization */}
      <AlertDialog open={!!confirmClear} onOpenChange={(o) => !o && setConfirmClear(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la privatisation ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les dates de privatisation programmée pour <strong>{confirmClear?.name}</strong> seront effacées. Le cabinet redeviendra librement réservable sur la période. Cette action est immédiate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmClear && clearPrivatization(confirmClear)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default AdminPrivatizations;