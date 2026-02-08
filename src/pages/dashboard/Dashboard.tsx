import { useEffect, useState } from "react";
import { CalendarDays, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const Dashboard = () => {
  const { profile, isAdmin } = useAuth();
  const [stats, setStats] = useState({ upcoming: 0, pending: 0, confirmed: 0 });
  const [recentBookings, setRecentBookings] = useState<any[]>([]);

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

      setRecentBookings((bookings || []).slice(0, 5));
    };

    fetchData();
  }, [profile, isAdmin]);

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
        {/* Welcome */}
        <div>
          <h2 className="font-display text-2xl font-bold">
            Bonjour, {profile?.first_name || "Praticien"} 👋
          </h2>
          <p className="text-muted-foreground mt-1">
            Voici un aperçu de votre activité.
          </p>
        </div>

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
