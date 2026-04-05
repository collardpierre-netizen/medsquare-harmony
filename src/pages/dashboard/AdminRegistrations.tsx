import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Search, Download, Users, UserCheck, Clock, XCircle } from "lucide-react";

const AdminRegistrations = () => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [practitionerFilter, setPractitionerFilter] = useState("all");
  const [activityFilter, setActivityFilter] = useState("all");

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
      return data || [];
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r: any) => {
                      const session = r.activity_sessions;
                      const activity = session?.activities;
                      const practitioner = activity?.profiles;
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">
                            {r.guest_name || "Utilisateur inscrit"}
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
      </div>
    </DashboardLayout>
  );
};

export default AdminRegistrations;
