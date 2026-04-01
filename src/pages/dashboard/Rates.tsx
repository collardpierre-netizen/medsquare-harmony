import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil, Save, X, Stethoscope, Video, Home, Users, Baby } from "lucide-react";
import SmartDashboardLayout from "@/components/dashboard/SmartDashboardLayout";

interface Rate {
  id: string;
  act_label: string;
  duration_minutes: number | null;
  inami_total: number | null;
  patient_normal: number | null;
  patient_bim: number | null;
  consult_mode: string;
  effective_date: string;
}

const EMPTY_RATE = {
  act_label: "",
  duration_minutes: "",
  inami_total: "",
  patient_normal: "",
  patient_bim: "",
  consult_mode: "cabinet",
  effective_date: new Date().toISOString().slice(0, 10),
};

const MODE_OPTIONS = [
  { value: "cabinet", label: "Cabinet", icon: Stethoscope },
  { value: "video", label: "Vidéo", icon: Video },
  { value: "domicile", label: "Domicile", icon: Home },
  { value: "couple", label: "Couple", icon: Users },
  { value: "child", label: "Enfant", icon: Baby },
];

const fmt = (v: number | null) => (v != null ? `${Number(v).toFixed(2)} €` : "—");

const RatesManagement = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [rates, setRates] = useState<Rate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_RATE);
  const [saving, setSaving] = useState(false);

  const fetchRates = async () => {
    if (!profile) { setLoading(false); return; }
    const { data } = await supabase
      .from("practitioner_rates")
      .select("*")
      .eq("practitioner_id", profile.id)
      .order("act_label");
    setRates((data as Rate[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchRates(); }, [profile]);

  const handleAdd = async () => {
    if (!profile || !form.act_label.trim()) {
      toast({ variant: "destructive", title: "Le libellé est requis." });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("practitioner_rates").insert({
      practitioner_id: profile.id,
      act_label: form.act_label.trim(),
      duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null,
      inami_total: form.inami_total ? parseFloat(form.inami_total) : null,
      patient_normal: form.patient_normal ? parseFloat(form.patient_normal) : null,
      patient_bim: form.patient_bim ? parseFloat(form.patient_bim) : null,
      consult_mode: form.consult_mode,
      effective_date: form.effective_date,
    });
    if (error) {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    } else {
      toast({ title: "Tarif ajouté" });
      setForm(EMPTY_RATE);
      setShowAdd(false);
      fetchRates();
    }
    setSaving(false);
  };

  const handleUpdate = async () => {
    if (!editingId || !form.act_label.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("practitioner_rates").update({
      act_label: form.act_label.trim(),
      duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null,
      inami_total: form.inami_total ? parseFloat(form.inami_total) : null,
      patient_normal: form.patient_normal ? parseFloat(form.patient_normal) : null,
      patient_bim: form.patient_bim ? parseFloat(form.patient_bim) : null,
      consult_mode: form.consult_mode,
      effective_date: form.effective_date,
    }).eq("id", editingId);
    if (error) {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    } else {
      toast({ title: "Tarif mis à jour" });
      setEditingId(null);
      setForm(EMPTY_RATE);
      fetchRates();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("practitioner_rates").delete().eq("id", id);
    if (error) {
      toast({ variant: "destructive", title: "Erreur" });
    } else {
      toast({ title: "Tarif supprimé" });
      fetchRates();
    }
  };

  const startEdit = (rate: Rate) => {
    setEditingId(rate.id);
    setShowAdd(false);
    setForm({
      act_label: rate.act_label,
      duration_minutes: rate.duration_minutes?.toString() || "",
      inami_total: rate.inami_total?.toString() || "",
      patient_normal: rate.patient_normal?.toString() || "",
      patient_bim: rate.patient_bim?.toString() || "",
      consult_mode: rate.consult_mode,
      effective_date: rate.effective_date,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setShowAdd(false);
    setForm(EMPTY_RATE);
  };

  const RateForm = ({ onSave, isNew }: { onSave: () => void; isNew: boolean }) => (
    <Card className="border-primary/20">
      <CardContent className="p-4 space-y-4">
        <h4 className="font-medium text-sm">{isNew ? "Nouveau tarif" : "Modifier le tarif"}</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Label>Libellé de l'acte *</Label>
            <Input value={form.act_label} onChange={(e) => setForm({ ...form, act_label: e.target.value })} placeholder="Ex: Consultation standard" className="mt-1" />
          </div>
          <div>
            <Label>Mode de consultation</Label>
            <select
              value={form.consult_mode}
              onChange={(e) => setForm({ ...form, consult_mode: e.target.value })}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {MODE_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Durée (minutes)</Label>
            <Input type="number" min={0} max={480} value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} placeholder="30" className="mt-1" />
          </div>
          <div>
            <Label>Tarif INAMI total (€)</Label>
            <Input type="number" step="0.01" min={0} value={form.inami_total} onChange={(e) => setForm({ ...form, inami_total: e.target.value })} placeholder="26.08" className="mt-1" />
          </div>
          <div>
            <Label>Part patient standard (€)</Label>
            <Input type="number" step="0.01" min={0} value={form.patient_normal} onChange={(e) => setForm({ ...form, patient_normal: e.target.value })} placeholder="6.00" className="mt-1" />
          </div>
          <div>
            <Label>Part patient BIM (€)</Label>
            <Input type="number" step="0.01" min={0} value={form.patient_bim} onChange={(e) => setForm({ ...form, patient_bim: e.target.value })} placeholder="1.00" className="mt-1" />
          </div>
          <div>
            <Label>Date d'effet</Label>
            <Input type="date" value={form.effective_date} onChange={(e) => setForm({ ...form, effective_date: e.target.value })} className="mt-1" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={onSave} disabled={saving || !form.act_label.trim()}>
            <Save className="h-3.5 w-3.5 mr-1" />
            {saving ? "Enregistrement..." : isNew ? "Ajouter" : "Enregistrer"}
          </Button>
          <Button size="sm" variant="outline" onClick={cancelEdit}>
            <X className="h-3.5 w-3.5 mr-1" /> Annuler
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <SmartDashboardLayout>
      <div className="max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold flex items-center gap-2">
              <Stethoscope className="h-6 w-6 text-primary" />
              Mes tarifs
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Gérez vos tarifs INAMI. Ils sont affichés sur votre fiche publique.
            </p>
          </div>
          {!showAdd && !editingId && (
            <Button onClick={() => { setShowAdd(true); setForm(EMPTY_RATE); }}>
              <Plus className="h-4 w-4 mr-1.5" /> Ajouter un tarif
            </Button>
          )}
        </div>

        {showAdd && <RateForm onSave={handleAdd} isNew />}

        {rates.length === 0 && !showAdd ? (
          <Card className="shadow-none">
            <CardContent className="p-8 text-center">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Stethoscope className="h-6 w-6 text-primary" />
              </div>
              <p className="font-display font-semibold">Aucun tarif configuré</p>
              <p className="text-sm text-muted-foreground mt-1">Ajoutez vos tarifs pour les rendre visibles sur votre fiche.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {rates.map((rate) => {
              if (editingId === rate.id) {
                return <RateForm key={rate.id} onSave={handleUpdate} isNew={false} />;
              }

              const modeOpt = MODE_OPTIONS.find((m) => m.value === rate.consult_mode);
              const ModeIcon = modeOpt?.icon || Stethoscope;

              return (
                <Card key={rate.id} className="shadow-none">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm">{rate.act_label}</p>
                          <Badge variant="outline" className="text-[10px] gap-1 font-normal px-1.5 py-0">
                            <ModeIcon className="h-2.5 w-2.5" />
                            {modeOpt?.label || rate.consult_mode}
                          </Badge>
                          {rate.duration_minutes && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              {rate.duration_minutes} min
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                          <span>INAMI : {fmt(rate.inami_total)}</span>
                          <span>Standard : {fmt(rate.patient_normal)}</span>
                          <span>BIM : {fmt(rate.patient_bim)}</span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(rate)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer ce tarif ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Le tarif « {rate.act_label} » sera supprimé définitivement.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(rate.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </SmartDashboardLayout>
  );
};

export default RatesManagement;
