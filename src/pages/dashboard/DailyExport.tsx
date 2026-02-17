import { useState } from "react";
import { format, startOfDay, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import { Download, FileText, Table2, Coffee } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";

interface DayAppointment {
  start_time: string;
  end_time: string;
  title: string;
  patient: string;
  type: "booking" | "activity";
  room?: string;
}

const DailyExport = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [breakMinutes, setBreakMinutes] = useState(15);
  const [appointments, setAppointments] = useState<DayAppointment[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAppointments = async () => {
    if (!profile) return;
    setLoading(true);

    const date = new Date(selectedDate);
    const dayStart = startOfDay(date).toISOString();
    const dayEnd = addDays(startOfDay(date), 1).toISOString();

    // Fetch bookings
    const { data: bookings } = await supabase
      .from("bookings")
      .select("start_time, end_time, notes, rooms(name)")
      .eq("practitioner_id", profile.id)
      .neq("status", "cancelled")
      .gte("start_time", dayStart)
      .lt("start_time", dayEnd)
      .order("start_time");

    // Fetch activity sessions with registrations
    const { data: sessions } = await supabase
      .from("activity_sessions")
      .select("start_time, end_time, activities(title), rooms(name), activity_registrations(guest_name, user_id)")
      .in("activity_id", (await supabase.from("activities").select("id").eq("practitioner_id", profile.id)).data?.map((a: any) => a.id) || [])
      .gte("start_time", dayStart)
      .lt("start_time", dayEnd)
      .eq("status", "scheduled")
      .order("start_time");

    const allAppts: DayAppointment[] = [
      ...(bookings || []).map((b: any) => ({
        start_time: b.start_time,
        end_time: b.end_time,
        title: b.notes || "Réservation salle",
        patient: "-",
        type: "booking" as const,
        room: b.rooms?.name,
      })),
      ...(sessions || []).flatMap((s: any) => {
        const regs = s.activity_registrations || [];
        if (regs.length === 0) return [];
        return regs.map((r: any) => ({
          start_time: s.start_time,
          end_time: s.end_time,
          title: s.activities?.title || "Activité",
          patient: r.guest_name || "Patient inscrit",
          type: "activity" as const,
          room: s.rooms?.name,
        }));
      }),
    ].sort((a, b) => a.start_time.localeCompare(b.start_time));

    setAppointments(allAppts);
    setLoading(false);
  };

  const exportCSV = () => {
    if (appointments.length === 0) {
      toast({ variant: "destructive", title: "Aucun RDV à exporter" });
      return;
    }

    const header = "Heure début,Heure fin,Prestation,Patient,Salle,Pause après (min)";
    const rows = appointments.map((a) =>
      `${format(new Date(a.start_time), "HH:mm")},${format(new Date(a.end_time), "HH:mm")},${a.title},${a.patient},${a.room || "-"},${breakMinutes}`
    );

    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rdv-${selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Export CSV téléchargé" });
  };

  const exportPDF = () => {
    if (appointments.length === 0) {
      toast({ variant: "destructive", title: "Aucun RDV à exporter" });
      return;
    }

    const doc = new jsPDF();
    const dateStr = format(new Date(selectedDate), "EEEE d MMMM yyyy", { locale: fr });

    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Medsquare", 14, 20);
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Planning du ${dateStr}`, 14, 30);
    doc.text(`${profile?.first_name} ${profile?.last_name}`, 14, 38);
    doc.text(`Pause entre RDV : ${breakMinutes} min`, 14, 46);

    // Table header
    let y = 58;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(240, 240, 240);
    doc.rect(14, y - 4, 182, 8, "F");
    doc.text("Heure", 16, y);
    doc.text("Prestation", 50, y);
    doc.text("Patient", 110, y);
    doc.text("Salle", 155, y);
    y += 10;

    doc.setFont("helvetica", "normal");
    appointments.forEach((a, i) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }

      const timeStr = `${format(new Date(a.start_time), "HH:mm")} - ${format(new Date(a.end_time), "HH:mm")}`;
      doc.text(timeStr, 16, y);
      doc.text(a.title.substring(0, 30), 50, y);
      doc.text(a.patient.substring(0, 20), 110, y);
      doc.text((a.room || "-").substring(0, 15), 155, y);

      y += 7;

      // Add break indicator
      if (i < appointments.length - 1 && breakMinutes > 0) {
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text(`☕ Pause ${breakMinutes} min`, 50, y);
        doc.setTextColor(0);
        doc.setFontSize(9);
        y += 6;
      }
    });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text("Généré par Medsquare", 14, 290);

    doc.save(`planning-${selectedDate}.pdf`);
    toast({ title: "Export PDF téléchargé" });
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <Download className="h-5 w-5" />
              Export journalier
            </CardTitle>
            <CardDescription>
              Exportez le planning de votre journée avec pauses entre les RDV.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="flex items-center gap-1.5">
                  <Coffee className="h-3.5 w-3.5" />
                  Pause entre RDV (min)
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={60}
                  value={breakMinutes}
                  onChange={(e) => setBreakMinutes(parseInt(e.target.value) || 0)}
                  className="mt-1.5"
                />
              </div>
            </div>
            <Button onClick={fetchAppointments} disabled={loading}>
              {loading ? "Chargement..." : "Charger la journée"}
            </Button>

            {appointments.length > 0 && (
              <>
                <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
                  {appointments.map((a, i) => (
                    <div key={i} className="p-3 flex items-center gap-4 text-sm">
                      <span className="font-mono text-xs text-muted-foreground w-24 shrink-0">
                        {format(new Date(a.start_time), "HH:mm")} – {format(new Date(a.end_time), "HH:mm")}
                      </span>
                      <div className="flex-1">
                        <p className="font-medium">{a.title}</p>
                        <p className="text-xs text-muted-foreground">{a.patient}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {a.room || "—"}
                      </Badge>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={exportPDF}>
                    <FileText className="h-4 w-4 mr-2" />
                    Export PDF
                  </Button>
                  <Button variant="outline" onClick={exportCSV}>
                    <Table2 className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </>
            )}

            {!loading && appointments.length === 0 && selectedDate && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucun rendez-vous pour cette date.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default DailyExport;
