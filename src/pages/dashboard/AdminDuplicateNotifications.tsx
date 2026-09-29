import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { BellOff, Trash2 } from "lucide-react";

const MARK = "Doublon annulé automatiquement";

const fmt = (iso: string) =>
  new Intl.DateTimeFormat("fr-BE", { timeZone: "Europe/Brussels", dateStyle: "short", timeStyle: "short" }).format(new Date(iso));

interface Row {
  id: string;
  user_id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  practitioner: string;
  bookingLabel: string;
}

const AdminDuplicateNotifications = () => {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["duplicate-notifications"],
    queryFn: async (): Promise<Row[]> => {
      const { data: bookings, error: bErr } = await supabase
        .from("bookings")
        .select("id, start_time, rooms(name)")
        .eq("status", "cancelled")
        .ilike("notes", `%${MARK}%`);
      if (bErr) throw bErr;
      const bookingMap = new Map((bookings ?? []).map((b: any) => [b.id, b]));
      if (bookingMap.size === 0) return [];

      const { data: notifs, error: nErr } = await supabase
        .from("notifications")
        .select("id, user_id, title, message, is_read, created_at, metadata")
        .in("metadata->>booking_id", Array.from(bookingMap.keys()))
        .order("created_at", { ascending: false });
      if (nErr) throw nErr;

      const userIds = Array.from(new Set((notifs ?? []).map((n) => n.user_id)));
      const { data: profiles } = userIds.length
        ? await supabase.from("profiles").select("user_id, first_name, last_name").in("user_id", userIds)
        : { data: [] as any[] };
      const nameOf = new Map((profiles ?? []).map((p: any) => [p.user_id, `${p.first_name} ${p.last_name}`]));

      return (notifs ?? []).map((n: any) => {
        const b: any = bookingMap.get(n.metadata?.booking_id);
        return {
          id: n.id,
          user_id: n.user_id,
          title: n.title,
          message: n.message,
          is_read: n.is_read,
          created_at: n.created_at,
          practitioner: nameOf.get(n.user_id) ?? "—",
          bookingLabel: b ? `${b.rooms?.name ?? "—"} · ${fmt(b.start_time)}` : "—",
        };
      });
    },
  });

  const del = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("notifications").delete().in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} notification(s) supprimée(s)`);
      setSelected(new Set());
      setConfirmOpen(false);
      qc.invalidateQueries({ queryKey: ["duplicate-notifications"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const toggle = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <BellOff className="h-6 w-6 text-primary" /> Notifications des doublons
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Notifications « réservation refusée » envoyées aux praticiens lors de l'annulation automatique des réservations en double.
            Vérifiez-les puis supprimez-les.
          </p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>{rows.length} notification(s)</CardTitle>
              <CardDescription>{selected.size} sélectionnée(s)</CardDescription>
            </div>
            <Button variant="destructive" size="sm" disabled={selected.size === 0} onClick={() => setConfirmOpen(true)}>
              <Trash2 className="h-4 w-4 mr-1" /> Supprimer la sélection
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Chargement…</p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune notification liée aux doublons.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={(v) => setSelected(v ? new Set(rows.map((r) => r.id)) : new Set())}
                        aria-label="Tout sélectionner"
                      />
                    </TableHead>
                    <TableHead>Praticien</TableHead>
                    <TableHead>Réservation</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Lue</TableHead>
                    <TableHead>Envoyée le</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} aria-label="Sélectionner" />
                      </TableCell>
                      <TableCell className="font-medium whitespace-nowrap">{r.practitioner}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{r.bookingLabel}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.message}</TableCell>
                      <TableCell className="text-sm">{r.is_read ? "Oui" : "Non"}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{fmt(r.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {selected.size} notification(s) ?</AlertDialogTitle>
            <AlertDialogDescription>
              Elles disparaîtront définitivement de l'espace des praticiens concernés. Les réservations ne sont pas modifiées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => del.mutate(Array.from(selected))}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default AdminDuplicateNotifications;
