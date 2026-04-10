import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Search, Download, Users, UserCheck, Clock, XCircle, MoreHorizontal, CheckCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const AdminRegistrations = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [practitionerFilter, setPractitionerFilter] = useState("all");
  const [activityFilter, setActivityFilter] = useState("all");
  const [confirmAction, setConfirmAction] = useState<{ id: string; newStatus: string; name: string } | null>(null);

  // Fetch all registrations with session + activity + practitioner info
  const { data: registrations = [], isLoading } = useQuery({
    queryKey: ["admin-registrations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_registrations")
        .select(`
          *,
          activity_sessions!inner (
            id, start_time, end_time, max_participants,
            activities!inner (
              id, title, category,
              profiles:practitioner_id (id, first_name, last_name, specialty)
            )
          )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;

      // For registrations with user_id, fetch user profile info
      const userIds = (data || []).filter((r: any) => r.user_id).map((r: any) => r.user_id);
      let userProfiles: Record<string, { first_name: string; last_name: string; contact_email: string | null; phone: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name, contact_email, phone")
          .in("user_id", userIds);
        if (profiles) {
          profiles.forEach((p: any) => {
            userProfiles[p.user_id] = p;
          });
        }
      }

      return (data || []).map((r: any) => {
        if (r.user_id && userProfiles[r.user_id]) {
          const p = userProfiles[r.user_id];
          return {
            ...r,
            resolved_name: `${p.first_name} ${p.last_name}`.trim() || null,
            resolved_email: p.contact_email,
            resolved_phone: p.phone,
          };
        }
        return r;
      });
    },
  });

  // Unique practitioners and activities for filters
  const practitioners = useMemo(() => {
    const map = new Map<string, string>();
    registrations.forEach((r: any) => {
      const p = r.activity_sessions?.activities?.profiles;
      if (p) map.set(p.id, `${p.first_name} ${p.last_name}`);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [registrations]);

  const activities = useMemo(() => {
    const map = new Map<string, string>();
    registrations.forEach((r: any) => {
      const a = r.activity_sessions?.activities;
      if (a) map.set(a.id, a.title);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [registrations]);

  // Filter
  const filtered = useMemo(() => {
    return registrations.filter((r: any) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      const activity = r.activity_sessions?.activities;
      const practitioner = activity?.profiles;
      if (practitionerFilter !== "all" && practitioner?.id !== practitionerFilter) return false;
      if (activityFilter !== "all" && activity?.id !== activityFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const name = (r.guest_name || "").toLowerCase();
        const email = (r.guest_email || "").toLowerCase();
        const title = (activity?.title || "").toLowerCase();
        if (!name.includes(q) && !email.includes(q) && !title.includes(q)) return false;
      }
      return true;
    });
  }, [registrations, statusFilter, practitionerFilter, activityFilter, search]);

  // Stats
  const stats = useMemo(() => ({
    total: registrations.length,
    registered: registrations.filter((r: any) => r.status === "registered").length,
    waitlisted: registrations.filter((r: any) => r.status === "waitlisted").length,
    cancelled: registrations.filter((r: any) => r.status === "cancelled").length,
  }), [registrations]);

  const exportCSV = () => {
    const headers = ["Participant", "Email", "Téléphone", "Activité", "Praticien", "Date séance", "Statut", "Inscrit le"];
    const rows = filtered.map((r: any) => {
      const session = r.activity_sessions;
      const activity = session?.activities;
      const practitioner = activity?.profiles;
      return [
        r.guest_name || "Utilisateur inscrit",
        r.guest_email || "",
        r.guest_phone || "",
        activity?.title || "",
        practitioner ? `${practitioner.first_name} ${practitioner.last_name}` : "",
        session?.start_time ? format(new Date(session.start_time), "dd/MM/yyyy HH:mm") : "",
        r.status,
        format(new Date(r.created_at), "dd/MM/yyyy HH:mm"),
      ];
    });
    const csv = [headers, ...rows].map((row) => row.map((c: string) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inscriptions_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      const { error } = await supabase
        .from("activity_registrations")
        .update({ status: newStatus })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { newStatus }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-registrations"] });
      const label = newStatus === "registered" ? "inscrit" : newStatus === "waitlisted" ? "en liste d'attente" : "annulé";
      toast.success(`Statut mis à jour : ${label}`);
    },
    onError: () => {
      toast.error("Erreur lors de la mise à jour du statut");
    },
  });

  const handleStatusChange = (id: string, newStatus: string, name: string) => {
    setConfirmAction({ id, newStatus, name });
  };

  const confirmStatusChange = () => {
    if (confirmAction) {
      updateStatusMutation.mutate({ id: confirmAction.id, newStatus: confirmAction.newStatus });
      setConfirmAction(null);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "registered":
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Inscrit</Badge>;
      case "waitlisted":
        return <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">Liste d'attente</Badge>;
      case "cancelled":
        return <Badge variant="secondary">Annulé</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "registered": return "Inscrit";
      case "waitlisted": return "Liste d'attente";
      case "cancelled": return "Annulé";
      default: return status;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Inscriptions aux activités</h1>
          <p className="text-muted-foreground">Vue centralisée de toutes les inscriptions aux activités du centre.</p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <UserCheck className="h-8 w-8 text-emerald-600" />
              <div>
                <p className="text-2xl font-bold">{stats.registered}</p>
                <p className="text-xs text-muted-foreground">Inscrits</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Clock className="h-8 w-8 text-amber-600" />
              <div>
                <p className="text-2xl font-bold">{stats.waitlisted}</p>
                <p className="text-xs text-muted-foreground">Liste d'attente</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <XCircle className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{stats.cancelled}</p>
                <p className="text-xs text-muted-foreground">Annulés</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom, email ou activité…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="registered">Inscrits</SelectItem>
                  <SelectItem value="waitlisted">Liste d'attente</SelectItem>
                  <SelectItem value="cancelled">Annulés</SelectItem>
                </SelectContent>
              </Select>
              <Select value={practitionerFilter} onValueChange={setPractitionerFilter}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Praticien" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les praticiens</SelectItem>
                  {practitioners.map(([id, name]) => (
                    <SelectItem key={id} value={id}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={activityFilter} onValueChange={setActivityFilter}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Activité" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les activités</SelectItem>
                  {activities.map(([id, title]) => (
                    <SelectItem key={id} value={id}>{title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={exportCSV}>
                <Download className="h-4 w-4 mr-2" />
                CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Chargement…</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Aucune inscription trouvée.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Participant</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Activité</TableHead>
                      <TableHead>Praticien</TableHead>
                      <TableHead>Séance</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Inscrit le</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r: any) => {
                      const session = r.activity_sessions;
                      const activity = session?.activities;
                      const practitioner = activity?.profiles;
                      const participantName = r.resolved_name || r.guest_name || "Utilisateur inscrit";
                      const participantEmail = r.resolved_email || r.guest_email;
                      const participantPhone = r.resolved_phone || r.guest_phone;
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">
                            {participantName}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-0.5">
                              {r.guest_email && (
                                <a href={`mailto:${r.guest_email}`} className="text-sm text-primary hover:underline block">
                                  {r.guest_email}
                                </a>
                              )}
                              {r.guest_phone && (
                                <a href={`tel:${r.guest_phone}`} className="text-sm text-muted-foreground block">
                                  {r.guest_phone}
                                </a>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <span className="font-medium">{activity?.title}</span>
                              <span className="text-xs text-muted-foreground block">{activity?.category}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {practitioner
                              ? `${practitioner.first_name} ${practitioner.last_name}`
                              : "—"}
                          </TableCell>
                          <TableCell>
                            {session?.start_time
                              ? format(new Date(session.start_time), "EEE dd MMM yyyy 'à' HH:mm", { locale: fr })
                              : "—"}
                          </TableCell>
                          <TableCell>{statusBadge(r.status)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(r.created_at), "dd/MM/yyyy HH:mm")}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {otherStatuses.map((s) => (
                                  <DropdownMenuItem
                                    key={s}
                                    onClick={() => handleStatusChange(r.id, s, participantName)}
                                  >
                                    {s === "registered" && <CheckCircle className="h-4 w-4 mr-2 text-emerald-600" />}
                                    {s === "waitlisted" && <Clock className="h-4 w-4 mr-2 text-amber-600" />}
                                    {s === "cancelled" && <XCircle className="h-4 w-4 mr-2 text-destructive" />}
                                    Passer en « {statusLabel(s)} »
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="p-3 border-t text-sm text-muted-foreground">
              {filtered.length} inscription{filtered.length !== 1 ? "s" : ""} affichée{filtered.length !== 1 ? "s" : ""}
            </div>
          </CardContent>
        </Card>

        {/* Confirmation dialog */}
        <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmer le changement de statut</AlertDialogTitle>
              <AlertDialogDescription>
                Voulez-vous passer l'inscription de <strong>{confirmAction?.name}</strong> en « <strong>{confirmAction ? statusLabel(confirmAction.newStatus) : ""}</strong> » ?
                {confirmAction?.newStatus === "cancelled" && (
                  <span className="block mt-2 text-destructive">
                    ⚠️ Le participant sera considéré comme annulé et ne sera plus comptabilisé.
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={confirmStatusChange}>
                Confirmer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default AdminRegistrations;
