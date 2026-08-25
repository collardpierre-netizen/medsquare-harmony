import { useEffect, useState } from "react";
import { Plus, X, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DAY_LABELS,
  defaultOpeningHours,
  parseOpeningHours,
  summarizeOpeningHours,
  type OpeningPeriod,
  type RoomOpeningHours,
} from "@/lib/roomOpeningHours";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: { id: string; name: string; opening_hours?: unknown } | null;
  onSaved?: () => void;
}

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const HourInput = ({
  value,
  onChange,
  disabled,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  label: string;
}) => (
  <div className="flex items-center gap-1">
    <span className="text-[11px] text-muted-foreground w-8">{label}</span>
    <Input
      type="number"
      min={0}
      max={24}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Math.min(24, Math.max(0, parseInt(e.target.value) || 0)))}
      className="h-8 w-16"
    />
    <span className="text-xs text-muted-foreground">h</span>
  </div>
);

const RoomOpeningHoursDialog = ({ open, onOpenChange, room, onSaved }: Props) => {
  const { toast } = useToast();
  const [config, setConfig] = useState<RoomOpeningHours>(defaultOpeningHours());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && room) setConfig(parseOpeningHours(room.opening_hours));
  }, [open, room]);

  const updateDay = (weekday: number, patch: Partial<RoomOpeningHours["weekly"][string]>) => {
    setConfig((prev) => ({
      ...prev,
      weekly: {
        ...prev.weekly,
        [String(weekday)]: { ...prev.weekly[String(weekday)], ...patch },
      },
    }));
  };

  const addPeriod = () => {
    const today = new Date().toISOString().slice(0, 10);
    setConfig((prev) => ({
      ...prev,
      periods: [...prev.periods, { from: today, to: today, label: "", closed: true }],
    }));
  };

  const updatePeriod = (index: number, patch: Partial<OpeningPeriod>) => {
    setConfig((prev) => ({
      ...prev,
      periods: prev.periods.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    }));
  };

  const removePeriod = (index: number) => {
    setConfig((prev) => ({ ...prev, periods: prev.periods.filter((_, i) => i !== index) }));
  };

  const handleSave = async () => {
    if (!room) return;
    for (const d of Object.values(config.weekly)) {
      if (!d.closed && d.end <= d.start) {
        toast({
          variant: "destructive",
          title: "Horaires invalides",
          description: "L'heure de fermeture doit être postérieure à l'heure d'ouverture.",
        });
        return;
      }
    }
    for (const p of config.periods) {
      if (!p.from || !p.to || p.to < p.from) {
        toast({
          variant: "destructive",
          title: "Période invalide",
          description: "La date de fin d'une période doit être postérieure à la date de début.",
        });
        return;
      }
      if (!p.closed && p.start != null && p.end != null && p.end <= p.start) {
        toast({
          variant: "destructive",
          title: "Période invalide",
          description: "Les heures d'une période spécifique sont incohérentes.",
        });
        return;
      }
    }

    setSaving(true);
    const { error } = await supabase
      .from("rooms")
      .update({ opening_hours: config as unknown as never })
      .eq("id", room.id);
    setSaving(false);
    if (error) {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
      return;
    }
    toast({ title: "Plages d'ouverture enregistrées ✅" });
    onOpenChange(false);
    onSaved?.();
  };

  const resetToDefaults = () => setConfig(defaultOpeningHours());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Plages d'ouverture — {room?.name}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Ces plages définissent les créneaux réservables et servent de base au calcul des taux de
          remplissage de cette salle.
        </p>

        <div className="space-y-5 py-2">
          {/* Grille hebdomadaire */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium">Grille hebdomadaire</Label>
              <Button type="button" variant="ghost" size="sm" onClick={resetToDefaults}>
                Réinitialiser
              </Button>
            </div>
            <div className="space-y-2">
              {WEEK_ORDER.map((wd) => {
                const day = config.weekly[String(wd)];
                return (
                  <div
                    key={wd}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2"
                  >
                    <span className="text-sm font-medium w-24">{DAY_LABELS[wd]}</span>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={!day.closed}
                        onCheckedChange={(checked) => updateDay(wd, { closed: !checked })}
                      />
                      <span className="text-xs text-muted-foreground w-14">
                        {day.closed ? "Fermé" : "Ouvert"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 ml-auto">
                      <HourInput
                        label="De"
                        value={day.start}
                        disabled={day.closed}
                        onChange={(v) => updateDay(wd, { start: v })}
                      />
                      <HourInput
                        label="À"
                        value={day.end}
                        disabled={day.closed}
                        onChange={(v) => updateDay(wd, { end: v })}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-2">{summarizeOpeningHours(config)}</p>
          </div>

          {/* Périodes exceptionnelles */}
          <div>
            <Label className="text-sm font-medium mb-2 block">
              Périodes spécifiques (congés, travaux, horaires d'été…)
            </Label>
            {config.periods.length === 0 && (
              <p className="text-xs text-muted-foreground mb-2">
                Aucune période encodée : la grille hebdomadaire s'applique toute l'année.
              </p>
            )}
            <div className="space-y-3">
              {config.periods.map((p, i) => (
                <div key={i} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={p.label || ""}
                      onChange={(e) => updatePeriod(i, { label: e.target.value })}
                      placeholder="Libellé (ex. Congés d'été)"
                      className="h-8 flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => removePeriod(i)}
                      className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-destructive/10 text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      type="date"
                      value={p.from}
                      onChange={(e) => updatePeriod(i, { from: e.target.value })}
                      className="h-8 w-40"
                    />
                    <span className="text-xs text-muted-foreground">→</span>
                    <Input
                      type="date"
                      value={p.to}
                      onChange={(e) => updatePeriod(i, { to: e.target.value })}
                      className="h-8 w-40"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={p.closed}
                        onCheckedChange={(checked) =>
                          updatePeriod(i, {
                            closed: checked,
                            start: checked ? undefined : (p.start ?? 8),
                            end: checked ? undefined : (p.end ?? 22),
                          })
                        }
                      />
                      <span className="text-xs text-muted-foreground">
                        {p.closed ? "Salle fermée" : "Horaires spécifiques"}
                      </span>
                    </div>
                    {!p.closed && (
                      <div className="flex items-center gap-3 ml-auto">
                        <HourInput
                          label="De"
                          value={p.start ?? 8}
                          onChange={(v) => updatePeriod(i, { start: v })}
                        />
                        <HourInput
                          label="À"
                          value={p.end ?? 22}
                          onChange={(v) => updatePeriod(i, { end: v })}
                        />
                      </div>
                    )}
                    {p.closed && (
                      <Badge variant="secondary" className="text-[11px] ml-auto">
                        Aucun créneau réservable
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={addPeriod}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Ajouter une période
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RoomOpeningHoursDialog;
