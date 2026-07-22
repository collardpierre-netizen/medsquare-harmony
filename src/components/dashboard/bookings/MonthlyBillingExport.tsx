import { useState } from "react";
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarDays, Download, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const fmtBxl = (d: Date, pattern: string) =>
  format(new Date(d.toLocaleString("en-US", { timeZone: "Europe/Brussels" })), pattern, { locale: fr });

const formatEUR = (n: number) =>
  `${new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(n)} HTVA`;

interface Props {
  /** Optional default month; defaults to previous month (typical billing cycle). */
  defaultMonth?: Date;
}

export default function MonthlyBillingExport({ defaultMonth }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<Date>(() => startOfMonth(defaultMonth ?? subMonths(new Date(), 1)));
  const [generating, setGenerating] = useState(false);

  const handleExport = async () => {
    setGenerating(true);
    try {
      const from = startOfMonth(month);
      const to = endOfMonth(month);

      // Fetch bookings for the month with practitioner + room info
      const { data, error } = await supabase
        .from("bookings")
        .select("id, start_time, end_time, status, notes, practitioner_id, profiles(first_name, last_name), rooms(name, hourly_rate)")
        .gte("start_time", from.toISOString())
        .lte("start_time", to.toISOString())
        .in("status", ["confirmed", "pending"])
        .order("start_time", { ascending: true });

      if (error) throw error;

      const rows = (data ?? []) as any[];

      if (rows.length === 0) {
        toast({
          title: "Aucune réservation",
          description: `Pas de réservation confirmée ou en attente sur ${fmtBxl(month, "MMMM yyyy")}.`,
        });
        setGenerating(false);
        return;
      }

      // Group by practitioner
      const groups = new Map<string, { name: string; items: any[] }>();
      rows.forEach((r) => {
        const pid = r.practitioner_id;
        const name = `${r.profiles?.first_name ?? ""} ${r.profiles?.last_name ?? ""}`.trim() || "Praticien inconnu";
        if (!groups.has(pid)) groups.set(pid, { name, items: [] });
        groups.get(pid)!.items.push(r);
      });

      const sorted = Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name, "fr"));

      // Build PDF
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 14;
      const monthLabel = fmtBxl(month, "MMMM yyyy");
      const generatedAt = fmtBxl(new Date(), "dd/MM/yyyy 'à' HH:mm");

      let grandTotal = 0;
      let grandHours = 0;

      sorted.forEach((group, idx) => {
        if (idx > 0) doc.addPage();

        // Header
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(20, 20, 20);
        doc.text("Medsquare — Note de réservations", margin, 18);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(110, 110, 110);
        doc.text(`Période : ${monthLabel}`, margin, 25);
        doc.text(`Édité le ${generatedAt}`, pageW - margin, 25, { align: "right" });

        // Practitioner block
        doc.setDrawColor(220, 220, 220);
        doc.line(margin, 28, pageW - margin, 28);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(20, 20, 20);
        doc.text(group.name, margin, 36);

        // Table header
        const headerY = 44;
        doc.setFillColor(245, 245, 245);
        doc.rect(margin, headerY - 5, pageW - margin * 2, 7, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(70, 70, 70);
        const cols = {
          date: margin + 2,
          horaire: margin + 30,
          salle: margin + 60,
          duree: margin + 110,
          tarif: margin + 135,
          montant: pageW - margin - 2,
        };
        doc.text("Date", cols.date, headerY);
        doc.text("Horaire", cols.horaire, headerY);
        doc.text("Salle", cols.salle, headerY);
        doc.text("Durée", cols.duree, headerY);
        doc.text("Tarif/h", cols.tarif, headerY);
        doc.text("Montant", cols.montant, headerY, { align: "right" });

        // Rows
        let y = headerY + 7;
        let practTotal = 0;
        let practHours = 0;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(40, 40, 40);

        // Sort items chronologically
        group.items
          .slice()
          .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
          .forEach((it) => {
            // Page break
            if (y > pageH - 40) {
              doc.addPage();
              y = 20;
            }
            const start = new Date(it.start_time);
            const end = new Date(it.end_time);
            const hours = (end.getTime() - start.getTime()) / 3_600_000;
            const rate = Number(it.rooms?.hourly_rate ?? 0);
            const amount = hours * rate;
            practHours += hours;
            practTotal += amount;

            const dateStr = fmtBxl(start, "EEE dd/MM");
            const horaire = `${fmtBxl(start, "HH:mm")} – ${fmtBxl(end, "HH:mm")}`;
            const salle = it.rooms?.name ?? "—";
            const durStr = `${hours.toFixed(2).replace(".", ",")} h`;
            const rateStr = formatEUR(rate);
            const amtStr = formatEUR(amount);

            doc.text(dateStr, cols.date, y);
            doc.text(horaire, cols.horaire, y);
            // Truncate salle
            const salleTrunc = salle.length > 28 ? salle.slice(0, 27) + "…" : salle;
            doc.text(salleTrunc, cols.salle, y);
            doc.text(durStr, cols.duree, y);
            doc.text(rateStr, cols.tarif, y);
            doc.text(amtStr, cols.montant, y, { align: "right" });

            // Status badge (only show if pending)
            if (it.status === "pending") {
              doc.setTextColor(180, 120, 0);
              doc.setFontSize(7);
              doc.text(" (en attente)", cols.horaire + 28, y);
              doc.setFontSize(9);
              doc.setTextColor(40, 40, 40);
            }
            y += 6;
          });

        // Practitioner total
        if (y > pageH - 25) {
          doc.addPage();
          y = 20;
        }
        y += 4;
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, y, pageW - margin, y);
        y += 6;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(20, 20, 20);
        doc.text(
          `Total : ${practHours.toFixed(2).replace(".", ",")} h`,
          margin,
          y
        );
        doc.text(`Montant à facturer : ${formatEUR(practTotal)}`, pageW - margin, y, { align: "right" });

        // Footer note
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(140, 140, 140);
        doc.text(
          "Calcul indicatif basé sur le tarif horaire de chaque salle. Les forfaits éventuels ne sont pas inclus.",
          margin,
          pageH - 10
        );

        grandTotal += practTotal;
        grandHours += practHours;
      });

      // Summary page (first)
      doc.insertPage(1);
      doc.setPage(1);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(20, 20, 20);
      doc.text("Synthèse mensuelle", margin, 22);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(90, 90, 90);
      doc.text(`Période : ${monthLabel}`, margin, 30);
      doc.text(`Édité le ${generatedAt}`, margin, 36);

      // Synthesis table header
      const sY = 50;
      doc.setFillColor(245, 245, 245);
      doc.rect(margin, sY - 5, pageW - margin * 2, 7, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(70, 70, 70);
      doc.text("Praticien", margin + 2, sY);
      doc.text("Réservations", margin + 90, sY);
      doc.text("Heures", margin + 125, sY);
      doc.text("Montant", pageW - margin - 2, sY, { align: "right" });

      let sy = sY + 8;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      sorted.forEach((g) => {
        if (sy > pageH - 30) {
          doc.addPage();
          sy = 20;
        }
        const items = g.items;
        const hrs = items.reduce(
          (s, it) =>
            s + (new Date(it.end_time).getTime() - new Date(it.start_time).getTime()) / 3_600_000,
          0
        );
        const amt = items.reduce((s, it) => {
          const h = (new Date(it.end_time).getTime() - new Date(it.start_time).getTime()) / 3_600_000;
          return s + h * Number(it.rooms?.hourly_rate ?? 0);
        }, 0);
        doc.text(g.name, margin + 2, sy);
        doc.text(String(items.length), margin + 90, sy);
        doc.text(`${hrs.toFixed(2).replace(".", ",")} h`, margin + 125, sy);
        doc.text(formatEUR(amt), pageW - margin - 2, sy, { align: "right" });
        sy += 7;
      });

      // Grand total
      sy += 4;
      doc.setDrawColor(180, 180, 180);
      doc.line(margin, sy, pageW - margin, sy);
      sy += 7;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(20, 20, 20);
      doc.text(`Total général : ${grandHours.toFixed(2).replace(".", ",")} h`, margin, sy);
      doc.text(`${formatEUR(grandTotal)}`, pageW - margin, sy, { align: "right" });

      const filename = `medsquare-reservations-${format(month, "yyyy-MM")}.pdf`;
      doc.save(filename);

      toast({
        title: "Export généré",
        description: `${sorted.length} praticien(s), ${rows.length} réservation(s) — ${formatEUR(grandTotal)}`,
      });
      setOpen(false);
    } catch (err: any) {
      toast({
        title: "Erreur lors de l'export",
        description: err?.message ?? String(err),
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export mensuel
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Export PDF — facturation
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Génère un PDF récapitulatif (heures réservées + montants à facturer) pour le mois choisi.
            </p>
          </div>

          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setMonth((m) => startOfMonth(subMonths(m, 1)))}
              aria-label="Mois précédent"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 text-center font-medium capitalize">
              {fmtBxl(month, "MMMM yyyy")}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setMonth((m) => startOfMonth(addMonths(m, 1)))}
              aria-label="Mois suivant"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Button onClick={handleExport} disabled={generating} className="w-full">
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Génération...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Télécharger le PDF
              </>
            )}
          </Button>

          <p className="text-[10px] text-muted-foreground leading-tight">
            Inclut les réservations <strong>confirmées</strong> et <strong>en attente</strong>. Calcul = durée × tarif horaire de la salle. Tous les montants sont <strong>HTVA</strong>.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
