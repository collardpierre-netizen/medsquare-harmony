import { useEffect, useState } from "react";
import { CalendarDays, Clock, CheckCircle, AlertCircle, Scale, Eye, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import ProfileCompletionBanner from "@/components/dashboard/ProfileCompletionBanner";
import PractitionerNoticeBanner from "@/components/dashboard/PractitionerNoticeBanner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const Dashboard = () => {
  const { user, profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ upcoming: 0, pending: 0, confirmed: 0 });
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [pendingLegalDocs, setPendingLegalDocs] = useState(0);
  const [pendingBookings, setPendingBookings] = useState<any[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    if (!profile) return;

    const fetchData = async () => {
      const now = new Date().toISOString();

      // Upcoming bookings count
      let query = supabase
        .from("bookings")
        .select("*, rooms(*)")
        .gte("start_time", now)
        .order("start_time", { ascending: true });

      if (!isAdmin) {
        query = query.eq("practitioner_id", profile.id);
      }

      const { data: bookings } = await query;

      const upcoming = bookings?.filter((b: any) => b.status !== "cancelled") || [];
      const pending = upcoming.filter((b: any) => b.status === "pending");
      const confirmed = upcoming.filter((b: any) => b.status === "confirmed");

      setStats({
        upcoming: upcoming.length,
        pending: pending.length,
        confirmed: confirmed.length,
      });

      setPendingBookings(pending);
      setRecentBookings((bookings || []).slice(0, 5));
    };

    fetchData();
  }, [profile, isAdmin, refreshKey]);

  const updateBookingStatus = async (id: string, status: "confirmed" | "cancelled") => {
    setUpdatingId(id);
    const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
    setUpdatingId(null);
    if (error) {
      toast.error("Impossible de mettre à jour la réservation");
      return;
    }
    toast.success(status === "confirmed" ? "Réservation validée" : "Réservation annulée");
    setRefreshKey((k) => k + 1);
  };

  // Fetch pending legal documents
  useEffect(() => {
    if (!user) return;
    const fetchPending = async () => {
      const { data: docs } = await supabase
        .from("legal_documents")
        .select("id, version")
        .eq("is_active", true);
      if (!docs || docs.length === 0) { setPendingLegalDocs(0); return; }

      const { data: acks } = await supabase
        .from("legal_document_acknowledgments")
        .select("document_id, version_acknowledged")
        .eq("user_id", user.id);

      const ackMap = new Map((acks || []).map((a: any) => [a.document_id, a.version_acknowledged]));
      const pending = docs.filter((d: any) => {
        const ackVersion = ackMap.get(d.id);
        return !ackVersion || ackVersion < d.version;
      });
      setPendingLegalDocs(pending.length);
    };
    fetchPending();
  }, [user]);

  const statusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return <Badge className="bg-primary/10 text-primary border-primary/20">Confirmée</Badge>;
      case "pending":
        return <Badge variant="secondary" className="bg-yellow-50 text-yellow-700 border-yellow-200">En attente</Badge>;
      case "cancelled":
        return <Badge variant="secondary" className="bg-red-50 text-red-600 border-red-200">Annulée</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Profile completion banner */}
        {isAdmin && (
          <Button
            variant={demoMode ? "default" : "outline"}
            size="sm"
            onClick={() => setDemoMode(!demoMode)}
            className="gap-2"
          >
            <Eye className="h-4 w-4" />
            {demoMode ? "Masquer l'aperçu bannière" : "Prévisualiser la bannière praticien"}
          </Button>
        )}
        {(!isAdmin || demoMode) && <ProfileCompletionBanner demoMode={demoMode} />}
        <PractitionerNoticeBanner />
        <div>
          <h2 className="font-display text-2xl font-bold">
            Bonjour, {profile?.first_name || "Praticien"} 👋
          </h2>
          <p className="text-muted-foreground mt-1">
            Voici un aperçu de votre activité.
          </p>
        </div>

        {/* Pending bookings alert */}
        {pendingBookings.length > 0 && (
          <Card className="border-yellow-200 bg-yellow-50/50">
            <CardContent className="pt-6 pb-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-yellow-100 flex items-center justify-center shrink-0">
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-yellow-900">
                    {pendingBookings.length} réservation{pendingBookings.length > 1 ? "s" : ""} en attente de validation
                  </p>
                  <p className="text-xs text-yellow-700 mt-0.5">
                    Validez ou annulez ces pré-réservations pour libérer les créneaux.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {pendingBookings.slice(0, 5).map((b: any) => (
                  <div
                    key={b.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-yellow-200 bg-background px-3 py-2"
                  >
                    <div className="text-sm">
                      <p className="font-medium">{b.rooms?.name || "Salle"}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(b.start_time), "EEEE d MMMM · HH:mm", { locale: fr })} –{" "}
                        {format(new Date(b.end_time), "HH:mm", { locale: fr })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        disabled={updatingId === b.id}
                        onClick={() => updateBookingStatus(b.id, "confirmed")}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Valider
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={updatingId === b.id}
                        onClick={() => updateBookingStatus(b.id, "cancelled")}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Annuler
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {pendingBookings.length > 5 && (
                <Button variant="link" size="sm" className="px-0" onClick={() => navigate("/dashboard/bookings")}>
                  Voir toutes les réservations
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Legal docs alert */}
        {pendingLegalDocs > 0 && (
          <Card
            className="border-amber-200 bg-amber-50/50 cursor-pointer hover:bg-amber-50 transition-colors"
            onClick={() => navigate("/dashboard/legal-documents")}
          >
            <CardContent className="flex items-center gap-4 pt-6 pb-5">
              <div className="h-12 w-12 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <Scale className="h-6 w-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm text-amber-900">
                  {pendingLegalDocs} document{pendingLegalDocs > 1 ? "s" : ""} juridique{pendingLegalDocs > 1 ? "s" : ""} en attente de lecture
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Cliquez ici pour consulter et accuser réception.
                </p>
              </div>
              <Badge className="bg-amber-500 text-white hover:bg-amber-500 shrink-0">
                {pendingLegalDocs}
              </Badge>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <CalendarDays className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.upcoming}</p>
                <p className="text-sm text-muted-foreground">À venir</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="h-12 w-12 rounded-xl bg-yellow-50 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-sm text-muted-foreground">En attente</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="h-12 w-12 rounded-xl bg-accent flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.confirmed}</p>
                <p className="text-sm text-muted-foreground">Confirmées</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent bookings */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Prochaines réservations</CardTitle>
          </CardHeader>
          <CardContent>
            {recentBookings.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">
                Aucune réservation à venir.
              </p>
            ) : (
              <div className="space-y-3">
                {recentBookings.map((booking: any) => (
                  <div
                    key={booking.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Clock className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {booking.rooms?.name || "Salle"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(booking.start_time), "EEEE d MMMM • HH:mm", { locale: fr })}
                          {" — "}
                          {format(new Date(booking.end_time), "HH:mm")}
                        </p>
                      </div>
                    </div>
                    {statusBadge(booking.status)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
