/**
 * Plan de facturation mensuel (admin).
 *
 * Objectif : voir, pour un mois donné, QUOI facturer, À QUI et POURQUOI —
 * forfaits locataires valides ce mois, privatisations, réservations horaires
 * (remises déduites), alertes d'échéance (forfait/remise arrivé à terme →
 * passage au tarif plein) et notes libres de préparation de facturation.
 *
 * Tous les montants sont HTVA.
 */

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { addMonths, endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  Lock,
  LockOpen,
} from "lucide-react";
import { toast } from "sonner";

import { bookingBilledAmount, isPackageActiveInMonth } from "@/lib/roomBilling";

const eur = (n: number) => `${n.toFixed(2)} €`;
const iso = (d: Date) => format(d, "yyyy-MM-dd");

interface NoteRow {
  id: string;
  month: string;
  practitioner_id: string | null;
  room_id: string | null;
  label: string;
  note: string | null;
  expected_amount: number | null;
  status: string;
  profiles?: { first_name: string; last_name: string } | null;
  rooms?: { name: string } | null;
}

interface NoteForm {
  id?: string;
  practitioner_id: string;
  room_id: string;
  label: string;
  note: string;
  expected_amount: string;
  status: string;
}

const emptyNote: NoteForm = {
  practitioner_id: "",
  room_id: "",
  label: "",
  note: "",
  expected_amount: "",
  status: "to_invoice",
};

const STATUS_LABELS: Record<string, string> = {
  to_invoice: "À facturer",
  invoiced: "Facturé",
  on_hold: "En attente",
};

const AdminBillingPlan = () => {
  const qc = useQueryClient();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [editing, setEditing] = useState<NoteForm | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [lockConfirm, setLockConfirm] = useState<"lock" | "unlock" | null>(null);


  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const mKey = format(monthStart, "yyyy-MM");
  const monthIso = iso(monthStart);

  const { data: rooms = [] } = useQuery({
    queryKey: ["billing-plan-rooms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rooms")
        .select(
          "id, name, hourly_rate, is_available, privatized_from, privatized_until, privatization_monthly_fee, assigned_practitioner_id",
        )
        .order("name");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: practitioners = [] } = useQuery({
    queryKey: ["billing-plan-practitioners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .order("last_name");
      if (error) throw error;
      return (data ?? []) as { id: string; first_name: string; last_name: string }[];
    },
  });

  const { data: packages = [] } = useQuery({
    queryKey: ["billing-plan-packages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practitioner_room_packages")
        .select("*, rooms(name)")
        .eq("is_active", true);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: discounts = [] } = useQuery({
    queryKey: ["billing-plan-discounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practitioner_discounts")
        .select("*")
        .eq("is_active", true);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ["billing-plan-bookings", mKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          "id, practitioner_id, room_id, start_time, end_time, status, discount_type, discount_value, discount_reason",
        )
        .gte("start_time", monthStart.toISOString())
        .lte("start_time", monthEnd.toISOString())
        .in("status", ["confirmed", "pending"]);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: notes = [] } = useQuery({
    queryKey: ["billing-plan-notes", mKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_plan_notes")
        .select("*, profiles(first_name, last_name), rooms(name)")
        .eq("month", monthIso)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as NoteRow[];
    },
  });

  /** Verrou de validation du mois : présent = plan validé et figé. */
  const { data: lock = null } = useQuery({
    queryKey: ["billing-plan-lock", mKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_plan_locks")
        .select("id, month, locked_at")
        .eq("month", monthIso)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; month: string; locked_at: string } | null;
    },
  });
  const isLocked = !!lock;

  const toggleLock = useMutation({
    mutationFn: async (next: boolean) => {
      if (next) {
        const { data: auth } = await supabase.auth.getUser();
        const { error } = await supabase
          .from("billing_plan_locks")
          .insert({ month: monthIso, locked_by: auth?.user?.id ?? null });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("billing_plan_locks")
          .delete()
          .eq("month", monthIso);
        if (error) throw error;
      }
    },
    onSuccess: (_d, next) => {
      qc.invalidateQueries({ queryKey: ["billing-plan-lock", mKey] });
      setLockConfirm(null);
      toast.success(next ? "Mois validé et verrouillé" : "Mois déverrouillé");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });


  const practitionerName = (id?: string | null) => {
    const p = practitioners.find((x) => x.id === id);
    return p ? `${p.first_name} ${p.last_name}` : "—";
  };

  /** Lignes à facturer pour le mois, groupées par praticien. */
  const plan = useMemo(() => {
    const flatFeeRoomIds = new Set<string>();
    type Line = { label: string; detail: string; amount: number; kind: "flat" | "hourly" };
    const groups = new Map<string, { name: string; lines: Line[] }>();
    const add = (pid: string, name: string, line: Line) => {
      if (!groups.has(pid)) groups.set(pid, { name, lines: [] });
      groups.get(pid)!.lines.push(line);
    };

    // 1. Privatisations (forfait mensuel de salle)
    rooms.forEach((r) => {
      const fee = Number(r.privatization_monthly_fee || 0);
      if (fee <= 0) return;
      const active = !r.is_available
        ? true
        : r.privatized_from
          ? r.privatized_from <= iso(monthEnd) &&
            (!r.privatized_until || r.privatized_until >= monthIso)
          : false;
      if (!active) return;
      flatFeeRoomIds.add(r.id);
      const pid = r.assigned_practitioner_id ?? `__unassigned_${r.id}`;
      add(pid, r.assigned_practitioner_id ? practitionerName(r.assigned_practitioner_id) : "Cabinet non attribué", {
        label: "Privatisation",
        detail: r.name,
        amount: fee,
        kind: "flat",
      });
    });

    // 2. Forfaits locataires valides ce mois
    const packagedKeys = new Set<string>();
    packages.forEach((p) => {
      if (flatFeeRoomIds.has(p.room_id)) return;
      if (!isPackageActiveInMonth(p, mKey)) return;
      packagedKeys.add(`${p.practitioner_id}|${p.room_id}`);
      add(p.practitioner_id, practitionerName(p.practitioner_id), {
        label: `Forfait — ${p.package_label}`,
        detail: `${p.rooms?.name ?? "—"}${p.end_date ? ` · échéance ${p.end_date}` : " · permanent"}`,
        amount: Number(p.monthly_fee || 0),
        kind: "flat",
      });
    });

    // 3. Réservations horaires non couvertes par un forfait
    const hourly = new Map<string, { hours: number; amount: number; count: number; roomNames: Set<string> }>();
    bookings.forEach((b) => {
      if (b.status !== "confirmed") return;
      if (flatFeeRoomIds.has(b.room_id)) return;
      if (packagedKeys.has(`${b.practitioner_id}|${b.room_id}`)) return;
      const room = rooms.find((r) => r.id === b.room_id);
      const amount = bookingBilledAmount(b, Number(room?.hourly_rate || 0), discounts as any).net;
      const hours =
        (new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 3600000;
      const key = b.practitioner_id;
      if (!hourly.has(key))
        hourly.set(key, { hours: 0, amount: 0, count: 0, roomNames: new Set<string>() });
      const h = hourly.get(key)!;
      h.hours += hours;
      h.amount += amount;
      h.count += 1;
      if (room?.name) h.roomNames.add(room.name);
    });
    hourly.forEach((h, pid) => {
      add(pid, practitionerName(pid), {
        label: "Réservations horaires",
        detail: `${h.count} réservation(s) · ${h.hours.toFixed(1)} h · ${Array.from(h.roomNames).join(", ")}`,
        amount: h.amount,
        kind: "hourly",
      });
    });

    return Array.from(groups.entries())
      .map(([pid, g]) => ({
        pid,
        name: g.name,
        lines: g.lines,
        total: g.lines.reduce((s, l) => s + l.amount, 0),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [rooms, packages, bookings, discounts, practitioners, mKey, monthIso, monthEnd]);

  const planTotal = plan.reduce((s, g) => s + g.total, 0);

  /** Alertes : forfaits/remises échus le mois précédent ou expirant ce mois. */
  const alerts = useMemo(() => {
    const prevKey = format(subMonths(monthStart, 1), "yyyy-MM");
    const out: { level: "expired" | "expiring"; text: string }[] = [];

    packages.forEach((p) => {
      if (!p.end_date) return;
      const endKey = p.end_date.slice(0, 7);
      if (endKey === mKey) {
        out.push({
          level: "expiring",
          text: `Forfait « ${p.package_label} » de ${practitionerName(p.practitioner_id)} (${p.rooms?.name ?? "—"}) arrive à échéance le ${p.end_date} : dernier mois au forfait.`,
        });
      } else if (endKey === prevKey) {
        out.push({
          level: "expired",
          text: `Forfait « ${p.package_label} » de ${practitionerName(p.practitioner_id)} (${p.rooms?.name ?? "—"}) est arrivé à échéance le ${p.end_date} : facturation au tarif horaire plein dès ce mois.`,
        });
      }
    });

    discounts.forEach((d) => {
      if (!d.end_date) return;
      const endKey = d.end_date.slice(0, 7);
      if (endKey === mKey) {
        out.push({
          level: "expiring",
          text: `Remise « ${d.label ?? "contractuelle"} » de ${practitionerName(d.practitioner_id)} se termine le ${d.end_date}.`,
        });
      } else if (endKey === prevKey) {
        out.push({
          level: "expired",
          text: `Remise « ${d.label ?? "contractuelle"} » de ${practitionerName(d.practitioner_id)} est échue depuis le ${d.end_date} : tarif plein appliqué.`,
        });
      }
    });

    return out;
  }, [packages, discounts, mKey, monthStart, practitioners]);

  const upsertNote = useMutation({
    mutationFn: async (form: NoteForm) => {
      const row = {
        month: monthIso,
        practitioner_id: form.practitioner_id || null,
        room_id: form.room_id || null,
        label: form.label.trim(),
        note: form.note.trim() || null,
        expected_amount: form.expected_amount ? Number(form.expected_amount) : null,
        status: form.status,
      };
      if (form.id) {
        const { error } = await supabase.from("billing_plan_notes").update(row).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("billing_plan_notes").insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["billing-plan-notes", mKey] });
      setEditing(null);
      toast.success("Note enregistrée");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("billing_plan_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["billing-plan-notes", mKey] });
      setDeleteId(null);
      toast.success("Note supprimée");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const toggleStatus = (n: NoteRow) => {
    const next = n.status === "invoiced" ? "to_invoice" : "invoiced";
    upsertNote.mutate({
      id: n.id,
      practitioner_id: n.practitioner_id ?? "",
      room_id: n.room_id ?? "",
      label: n.label,
      note: n.note ?? "",
      expected_amount: n.expected_amount != null ? String(n.expected_amount) : "",
      status: next,
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <ClipboardCheck className="h-6 w-6 text-primary" /> Plan de facturation
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Quoi facturer, à qui et pourquoi pour le mois sélectionné. Montants HTVA.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setMonth(subMonths(monthStart, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[150px] text-center font-medium capitalize">
              {format(monthStart, "MMMM yyyy", { locale: fr })}
            </span>
            <Button variant="outline" size="icon" onClick={() => setMonth(addMonths(monthStart, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            {isLocked ? (
              <Button
                variant="outline"
                onClick={() => setLockConfirm("unlock")}
                disabled={toggleLock.isPending}
              >
                <LockOpen className="h-4 w-4 mr-2" /> Déverrouiller
              </Button>
            ) : (
              <Button onClick={() => setLockConfirm("lock")} disabled={toggleLock.isPending}>
                <Lock className="h-4 w-4 mr-2" /> Valider le mois
              </Button>
            )}
          </div>
        </div>

        {isLocked && (
          <Card className="border-emerald-300 bg-emerald-50/60">
            <CardContent className="flex items-start gap-3 py-4 text-sm text-emerald-900">
              <Lock className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Plan validé et verrouillé le{" "}
                {format(new Date(lock!.locked_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}. Les
                notes de facturation de ce mois ne sont plus modifiables. Déverrouillez le mois pour
                apporter des corrections.
              </span>
            </CardContent>
          </Card>
        )}


        {alerts.length > 0 && (
          <Card className="border-amber-300 bg-amber-50/60">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-amber-900">
                <AlertTriangle className="h-4 w-4" /> Changements tarifaires à signaler
              </CardTitle>
              <CardDescription className="text-amber-900/80">
                À mentionner dans vos factures ou communications de ce mois.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {alerts.map((a, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-amber-900">
                  <Badge
                    variant="secondary"
                    className={
                      a.level === "expired"
                        ? "bg-destructive/10 text-destructive shrink-0"
                        : "bg-amber-200 text-amber-900 shrink-0"
                    }
                  >
                    {a.level === "expired" ? "Échu" : "Dernier mois"}
                  </Badge>
                  <span>{a.text}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>À facturer ce mois</CardTitle>
            <CardDescription>
              {plan.length} praticien(s) · total {eur(planTotal)} HTVA
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {plan.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Rien à facturer sur ce mois.
              </p>
            ) : (
              plan.map((g) => (
                <div key={g.pid} className="rounded-lg border">
                  <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
                    <span className="font-medium">{g.name}</span>
                    <span className="font-semibold tabular-nums">{eur(g.total)}</span>
                  </div>
                  <div className="divide-y">
                    {g.lines.map((l, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{l.label}</span>
                            <Badge variant="secondary" className="text-[10px]">
                              {l.kind === "flat" ? "Forfait" : "Horaire"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{l.detail}</p>
                        </div>
                        <span className="tabular-nums">{eur(l.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>Notes de facturation</CardTitle>
              <CardDescription>
                Ajoutez des éléments à facturer hors système ou des précisions à faire figurer
                sur la facture du mois.
              </CardDescription>
            </div>
            <Button size="sm" disabled={isLocked} onClick={() => setEditing({ ...emptyNote })}>
              <Plus className="h-4 w-4 mr-2" /> Nouvelle note
            </Button>
          </CardHeader>
          <CardContent>
            {notes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Aucune note pour ce mois.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Objet</TableHead>
                    <TableHead>Praticien</TableHead>
                    <TableHead>Salle</TableHead>
                    <TableHead className="text-right">Montant HTVA</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notes.map((n) => (
                    <TableRow key={n.id}>
                      <TableCell>
                        <div className="font-medium">{n.label}</div>
                        {n.note && <p className="text-xs text-muted-foreground">{n.note}</p>}
                      </TableCell>
                      <TableCell>
                        {n.profiles ? `${n.profiles.first_name} ${n.profiles.last_name}` : "—"}
                      </TableCell>
                      <TableCell>{n.rooms?.name ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {n.expected_amount != null ? eur(Number(n.expected_amount)) : "—"}
                      </TableCell>
                      <TableCell>
                        <button type="button" disabled={isLocked} onClick={() => toggleStatus(n)}>
                          <Badge
                            className={
                              n.status === "invoiced"
                                ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                                : n.status === "on_hold"
                                  ? "bg-muted text-muted-foreground"
                                  : "bg-amber-100 text-amber-800 hover:bg-amber-100"
                            }
                          >
                            {STATUS_LABELS[n.status] ?? n.status}
                          </Badge>
                        </button>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={isLocked}

                          onClick={() =>
                            setEditing({
                              id: n.id,
                              practitioner_id: n.practitioner_id ?? "",
                              room_id: n.room_id ?? "",
                              label: n.label,
                              note: n.note ?? "",
                              expected_amount:
                                n.expected_amount != null ? String(n.expected_amount) : "",
                              status: n.status,
                            })
                          }
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={isLocked}
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(n.id)}
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
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing?.id ? "Modifier la note" : "Nouvelle note de facturation"}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Objet</Label>
                <Input
                  placeholder="ex. Passage au tarif plein"
                  value={editing.label}
                  onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Praticien (optionnel)</Label>
                  <Select
                    value={editing.practitioner_id || "none"}
                    onValueChange={(v) =>
                      setEditing({ ...editing, practitioner_id: v === "none" ? "" : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Aucun" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun</SelectItem>
                      {practitioners.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.first_name} {p.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Salle (optionnel)</Label>
                  <Select
                    value={editing.room_id || "none"}
                    onValueChange={(v) => setEditing({ ...editing, room_id: v === "none" ? "" : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Aucune" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucune</SelectItem>
                      {rooms.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Montant HTVA (optionnel)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editing.expected_amount}
                    onChange={(e) => setEditing({ ...editing, expected_amount: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Statut</Label>
                  <Select
                    value={editing.status}
                    onValueChange={(v) => setEditing({ ...editing, status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="to_invoice">À facturer</SelectItem>
                      <SelectItem value="invoiced">Facturé</SelectItem>
                      <SelectItem value="on_hold">En attente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Note (optionnel)</Label>
                <Textarea
                  rows={3}
                  value={editing.note}
                  onChange={(e) => setEditing({ ...editing, note: e.target.value })}
                  placeholder="ex. Le tarif réduit est arrivé à échéance : facturation au tarif plein dès ce mois."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Annuler
            </Button>
            <Button
              disabled={!editing?.label.trim() || upsertNote.isPending}
              onClick={() => editing && upsertNote.mutate(editing)}
            >
              {upsertNote.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette note ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteId && deleteNote.mutate(deleteId)}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!lockConfirm} onOpenChange={(o) => !o && setLockConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {lockConfirm === "unlock"
                ? "Déverrouiller ce mois ?"
                : "Valider et verrouiller ce mois ?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {lockConfirm === "unlock"
                ? `Le plan de ${format(monthStart, "MMMM yyyy", { locale: fr })} redeviendra modifiable. À utiliser uniquement pour corriger une erreur avant facturation.`
                : `Le plan de ${format(monthStart, "MMMM yyyy", { locale: fr })} sera figé : les notes de facturation ne pourront plus être ajoutées, modifiées ni supprimées tant que le mois reste verrouillé.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => toggleLock.mutate(lockConfirm === "lock")}>
              {lockConfirm === "unlock" ? "Déverrouiller" : "Valider le mois"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </DashboardLayout>
  );
};

export default AdminBillingPlan;
