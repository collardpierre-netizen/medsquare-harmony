import { useState } from "react";
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarDays, Download, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { bookingBilledAmount, packageMonthlyFee, dedupeOverlappingBookings } from "@/lib/roomBilling";

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

      // Fetch flat-fee privatized rooms covering this month
      const monthStartISO = format(from, "yyyy-MM-dd");
      const monthEndISO = format(to, "yyyy-MM-dd");
      const { data: roomsData, error: roomsErr } = await supabase
        .from("rooms")
        .select("id, name, is_available, privatized_from, privatized_until, privatization_monthly_fee, assigned_practitioner_id, profiles!rooms_assigned_practitioner_id_fkey(first_name, last_name)");
      if (roomsErr) throw roomsErr;

      const flatFeeRooms = (roomsData ?? []).filter((r: any) => {
        const fee = Number(r.privatization_monthly_fee || 0);
        if (fee <= 0) return false;
        if (!r.is_available) return true; // permanent
        if (!r.privatized_from) return false;
        if (r.privatized_from > monthEndISO) return false;
        if (r.privatized_until && r.privatized_until < monthStartISO) return false;
        return true;
      });
      const flatFeeRoomIds = new Set(flatFeeRooms.map((r: any) => r.id));

      // Fetch practitioner packages (praticien + salle, forfaits actifs)
      const { data: pkgData } = await supabase
        .from("practitioner_room_packages")
        .select("practitioner_id, room_id, monthly_fee, package_label, start_date, end_date, profiles!practitioner_room_packages_practitioner_id_fkey(first_name, last_name), rooms(name)")
        .eq("is_active", true);
      const packages = (pkgData ?? []).filter(
        (p: any) =>
          !flatFeeRoomIds.has(p.room_id) &&
          (!p.start_date || p.start_date <= monthEndISO) &&
          (!p.end_date || p.end_date >= monthStartISO),
      );
      const packagedKey = (pid: string, rid: string) => `${pid}|${rid}`;
      const packagedSet = new Set(packages.map((p: any) => packagedKey(p.practitioner_id, p.room_id)));

      // Remises contractuelles par praticien (actives)
      const { data: discountData } = await supabase
        .from("practitioner_discounts")
        .select("practitioner_id, room_id, discount_type, discount_value, label, start_date, end_date, is_active, applies_to")
        .eq("is_active", true);
      const discounts = (discountData ?? []) as any[];

      // Fetch bookings for the month (with room_id so we can exclude flat-fee rooms)
      const { data, error } = await supabase
        .from("bookings")
        .select("id, start_time, end_time, status, notes, practitioner_id, room_id, discount_type, discount_value, discount_reason, profiles(first_name, last_name), rooms(name, hourly_rate)")
        .gte("start_time", from.toISOString())
        .lte("start_time", to.toISOString())
        .in("status", ["confirmed", "pending"])
        .order("start_time", { ascending: true });
      if (error) throw error;


      const filteredRows = dedupeOverlappingBookings((data ?? []) as any[]).filter(
        (b: any) => !flatFeeRoomIds.has(b.room_id) && !packagedSet.has(packagedKey(b.practitioner_id, b.room_id)),
      ) as any[];

      if (filteredRows.length === 0 && flatFeeRooms.length === 0 && packages.length === 0) {
        toast({
          title: "Aucune réservation",
          description: `Pas de réservation confirmée ou en attente sur ${fmtBxl(month, "MMMM yyyy")}.`,
        });
        setGenerating(false);
        return;
      }

      // Group by practitioner
      const groups = new Map<string, { name: string; items: any[]; flatFees: { roomName: string; fee: number; label?: string }[] }>();
      filteredRows.forEach((r) => {
        const pid = r.practitioner_id;
        const name = `${r.profiles?.first_name ?? ""} ${r.profiles?.last_name ?? ""}`.trim() || "Praticien inconnu";
        if (!groups.has(pid)) groups.set(pid, { name, items: [], flatFees: [] });
        groups.get(pid)!.items.push(r);
      });
      // Attribute flat fees (privatisation) to assigned practitioner (or "Non attribué")
      flatFeeRooms.forEach((r: any) => {
        const pid = r.assigned_practitioner_id ?? `__unassigned_${r.id}`;
        const name = r.assigned_practitioner_id
          ? `${r.profiles?.first_name ?? ""} ${r.profiles?.last_name ?? ""}`.trim() || "Praticien assigné"
          : "Cabinet non attribué";
        if (!groups.has(pid)) groups.set(pid, { name, items: [], flatFees: [] });
        groups.get(pid)!.flatFees.push({ roomName: r.name, fee: Number(r.privatization_monthly_fee), label: "Privatisation" });
      });
      // Attribute practitioner packages (praticien+salle) au praticien concerné
      packages.forEach((p: any) => {
        const pid = p.practitioner_id;
        const name = `${p.profiles?.first_name ?? ""} ${p.profiles?.last_name ?? ""}`.trim() || "Praticien";
        if (!groups.has(pid)) groups.set(pid, { name, items: [], flatFees: [] });
        groups.get(pid)!.flatFees.push({ roomName: p.rooms?.name ?? "—", fee: packageMonthlyFee(p, monthStartISO.slice(0, 7), discounts as any).net, label: p.package_label });
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
        let practDiscount = 0;
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
            // Remise ponctuelle (sur la réservation) > remise contractuelle du praticien
            const billed = bookingBilledAmount(it as any, rate, discounts as any, (pkgData ?? []) as any);
            const amount = billed.net;
            practHours += hours;
            practTotal += amount;
            practDiscount += billed.discount;

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

            // Ligne de remise appliquée
            if (billed.discount > 0) {
              doc.setFontSize(7);
              doc.setTextColor(150, 90, 0);
              doc.text(
                `Remise ${billed.label ?? ""} — brut ${formatEUR(billed.gross)}, remise −${formatEUR(billed.discount)}`,
                cols.salle,
                y - 2,
              );
              doc.setFontSize(9);
              doc.setTextColor(40, 40, 40);
              y += 3;
            }
          });


        // Flat-fee (forfait mensuel de privatisation) rows
        (group.flatFees ?? []).forEach((f) => {
          if (y > pageH - 40) { doc.addPage(); y = 20; }
          doc.setFont("helvetica", "italic");
          doc.setTextColor(40, 40, 40);
          doc.text(f.label || "Forfait", cols.date, y);
          doc.text("—", cols.horaire, y);
          const salleTrunc = f.roomName.length > 28 ? f.roomName.slice(0, 27) + "…" : f.roomName;
          doc.text(salleTrunc, cols.salle, y);
          doc.text("mois", cols.duree, y);
          doc.text("—", cols.tarif, y);
          doc.text(formatEUR(f.fee), cols.montant, y, { align: "right" });
          practTotal += f.fee;
          y += 6;
        });
        doc.setFont("helvetica", "normal");

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
        if (practDiscount > 0) {
          y += 5;
          doc.setFont("helvetica", "italic");
          doc.setFontSize(8);
          doc.setTextColor(150, 90, 0);
          doc.text(`Remises déduites : −${formatEUR(practDiscount)}`, pageW - margin, y, { align: "right" });
          doc.setTextColor(20, 20, 20);
        }

        // Footer note
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(140, 140, 140);
        doc.text(
          "Calcul : durée × tarif horaire de chaque salle (remises déduites), ou forfait mensuel pour les salles privatisées avec forfait. Montants HTVA.",
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
          return s + bookingBilledAmount(it as any, Number(it.rooms?.hourly_rate ?? 0), discounts as any, (pkgData ?? []) as any).net;
        }, 0) + (g.flatFees ?? []).reduce((s, f) => s + f.fee, 0);
        const flatCount = (g.flatFees ?? []).length;
        const countLabel = flatCount > 0 ? `${items.length} + ${flatCount} forfait${flatCount > 1 ? "s" : ""}` : String(items.length);
        doc.text(g.name, margin + 2, sy);
        doc.text(countLabel, margin + 90, sy);
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
        description: `${sorted.length} praticien(s), ${filteredRows.length} réservation(s) — ${formatEUR(grandTotal)}`,
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
