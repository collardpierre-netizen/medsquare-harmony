import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Stethoscope, Video, Home, Users, Baby, Receipt } from "lucide-react";

interface Rate {
  id: string;
  act_label: string;
  duration_minutes: number | null;
  inami_total: number | null;
  patient_normal: number | null;
  patient_bim: number | null;
  consult_mode: string;
}

interface Props {
  practitionerId: string;
  practitionerName: string;
}

const MODE_ICONS: Record<string, React.ElementType> = {
  cabinet: Stethoscope,
  video: Video,
  home: Home,
  couple: Users,
  child: Baby,
};

const MODE_LABELS: Record<string, string> = {
  cabinet: "Cabinet",
  video: "Vidéo",
  home: "Domicile",
  couple: "Couple",
  child: "Enfant",
};

const PractitionerTabTarifs = ({ practitionerId, practitionerName }: Props) => {
  const [rates, setRates] = useState<Rate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBim, setIsBim] = useState(false);

  useEffect(() => {
    const fetchRates = async () => {
      const { data } = await supabase
        .from("practitioner_rates")
        .select("id, act_label, duration_minutes, inami_total, patient_normal, patient_bim, consult_mode")
        .eq("practitioner_id", practitionerId)
        .order("act_label");
      setRates((data as Rate[]) || []);
      setLoading(false);
    };
    fetchRates();
  }, [practitionerId]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (rates.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <Receipt className="h-6 w-6 text-primary" />
        </div>
        <h3 className="font-display text-lg font-semibold mb-1">Tarifs & Remboursements</h3>
        <p className="text-muted-foreground text-sm">
          {practitionerName} n'a pas encore renseigné ses tarifs.
        </p>
      </div>
    );
  }

  const fmt = (v: number | null) => (v != null ? `${v.toFixed(2)} €` : "—");

  return (
    <div className="space-y-6">
      {/* BIM Toggle */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/30">
        <div>
          <p className="font-display font-semibold text-sm">Simulateur de remboursement</p>
          <p className="text-xs text-muted-foreground">
            {isBim
              ? "Tarifs pour bénéficiaires BIM · OMNIO · VIPO"
              : "Tarifs standard (non BIM)"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="bim-toggle" className="text-xs font-medium cursor-pointer">
            {isBim ? "BIM · OMNIO" : "Standard"}
          </Label>
          <Switch id="bim-toggle" checked={isBim} onCheckedChange={setIsBim} />
        </div>
      </div>

      {/* Rates table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left p-3 font-medium">Prestation</th>
              <th className="text-center p-3 font-medium hidden sm:table-cell">Mode</th>
              <th className="text-center p-3 font-medium hidden sm:table-cell">Durée</th>
              <th className="text-right p-3 font-medium">Tarif INAMI</th>
              <th className="text-right p-3 font-medium text-primary font-semibold">
                Votre part
              </th>
              <th className="text-right p-3 font-medium hidden sm:table-cell">Part mutuelle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rates.map((rate) => {
              const patientPart = isBim ? rate.patient_bim : rate.patient_normal;
              const mutuellePart =
                rate.inami_total != null && patientPart != null
                  ? rate.inami_total - patientPart
                  : null;
              const ModeIcon = MODE_ICONS[rate.consult_mode] || Stethoscope;

              return (
                <tr key={rate.id} className="hover:bg-muted/20 transition-colors">
                  <td className="p-3">
                    <p className="font-medium">{rate.act_label}</p>
                    <span className="sm:hidden text-xs text-muted-foreground">
                      {MODE_LABELS[rate.consult_mode] || rate.consult_mode}
                      {rate.duration_minutes ? ` · ${rate.duration_minutes} min` : ""}
                    </span>
                  </td>
                  <td className="text-center p-3 hidden sm:table-cell">
                    <Badge variant="outline" className="gap-1 text-xs font-normal">
                      <ModeIcon className="h-3 w-3" />
                      {MODE_LABELS[rate.consult_mode] || rate.consult_mode}
                    </Badge>
                  </td>
                  <td className="text-center p-3 text-muted-foreground hidden sm:table-cell">
                    {rate.duration_minutes ? `${rate.duration_minutes} min` : "—"}
                  </td>
                  <td className="text-right p-3">{fmt(rate.inami_total)}</td>
                  <td className="text-right p-3 font-semibold text-primary">
                    {fmt(patientPart)}
                  </td>
                  <td className="text-right p-3 text-muted-foreground hidden sm:table-cell">
                    {fmt(mutuellePart)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legal note */}
      <Card className="shadow-none bg-muted/30">
        <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
          <p>
            Les tarifs affichés sont basés sur la nomenclature INAMI en vigueur. Le montant « Votre
            part » correspond au ticket modérateur après intervention de votre mutuelle.
          </p>
          <p>
            {isBim
              ? "Les montants BIM/OMNIO/VIPO incluent l'intervention majorée pour les bénéficiaires."
              : "Sélectionnez « BIM · OMNIO » si vous bénéficiez de l'intervention majorée."}
          </p>
          <p className="font-medium">
            En cas d'absence non justifiée, des frais d'annulation peuvent être appliqués.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default PractitionerTabTarifs;
