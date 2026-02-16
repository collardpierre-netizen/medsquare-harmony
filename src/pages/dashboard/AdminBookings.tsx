import { useEffect, useState } from "react";
import { CalendarCheck, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const AdminBookings = () => {
  const { toast } = useToast();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "confirmed" | "cancelled">("all");

  const fetchBookings = async () => {
    let query = supabase
      .from("bookings")
      .select("*, profiles(first_name, last_name), rooms(name)")
      .order("start_time", { ascending: false });

    if (filter !== "all") {
      query = query.eq("status", filter);
    }

    const { data } = await query;
    setBookings(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchBookings();
  }, [filter]);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("bookings")
      .update({ status })
      .eq("id", id);

    if (!error) {
      toast({
        title: status === "confirmed" ? "Réservation confirmée" : "Réservation annulée",
      });
      fetchBookings();

      // Send email notification
      try {
        const { data: result } = await supabase.functions.invoke("notify-booking-status", {
          body: { booking_id: id, new_status: status },
        });
        if (result.sent) {
          console.log("Email notification sent");
        } else if (result.skipped) {
          console.log("Email notification skipped:", result.reason);
        }
      } catch (err) {
        console.error("Error sending email notification:", err);
      }
    }
  };

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
      <div className="space-y-6">
        <div>
          <h2 className="font-display text-xl font-bold">Toutes les réservations</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            Validez ou refusez les demandes de réservation.
          </p>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {(["all", "pending", "confirmed", "cancelled"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {f === "all"
                ? "Toutes"
                : f === "pending"
                ? "En attente"
                : f === "confirmed"
                ? "Confirmées"
                : "Annulées"}
            </Button>
          ))}
        </div>

        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            ) : bookings.length === 0 ? (
              <div className="text-center py-12">
                <CalendarCheck className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">Aucune réservation trouvée.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {bookings.map((booking: any) => (
                  <div
                    key={booking.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <p className="font-medium text-sm">
                          {booking.profiles?.first_name} {booking.profiles?.last_name}
                        </p>
                        {statusBadge(booking.status)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {booking.rooms?.name} •{" "}
                        {format(new Date(booking.start_time), "EEEE d MMMM • HH:mm", { locale: fr })}
                        {" — "}
                        {format(new Date(booking.end_time), "HH:mm")}
                      </p>
                      {booking.notes && (
                        <p className="text-xs text-muted-foreground mt-1 italic">
                          "{booking.notes}"
                        </p>
                      )}
                    </div>

                    {booking.status === "pending" && (
                      <div className="flex gap-2 ml-4">
                        <Button
                          size="sm"
                          onClick={() => updateStatus(booking.id, "confirmed")}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Confirmer
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateStatus(booking.id, "cancelled")}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Refuser
                        </Button>
                      </div>
                    )}
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

export default AdminBookings;
