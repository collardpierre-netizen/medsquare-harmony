import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import PractitionerNoticeBanner, {
  DEFAULT_PRACTITIONER_NOTICE,
  NOTICE_TYPES,
  PractitionerNotice,
} from "@/components/dashboard/PractitionerNoticeBanner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

const AdminPractitionerNotice = () => {
  const [notice, setNotice] = useState<PractitionerNotice>(DEFAULT_PRACTITIONER_NOTICE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "practitioner_notice")
        .maybeSingle();
      if (data?.value) {
        setNotice({ ...DEFAULT_PRACTITIONER_NOTICE, ...(data.value as any) });
      }
      setLoading(false);
    };
    load();
  }, []);

  const update = <K extends keyof PractitionerNotice>(key: K, value: PractitionerNotice[K]) =>
    setNotice((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("settings").upsert(
      { key: "practitioner_notice", value: notice as any, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
    setSaving(false);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Annonce enregistrée", description: "Le message est à jour pour les praticiens." });
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl space-y-6">
        <div>
          <h2 className="font-display text-2xl font-bold">Annonce praticiens</h2>
          <p className="text-muted-foreground mt-1">
            Informez les praticiens de travaux, d'une fermeture ou de toute actualité du centre. Le message s'affiche
            en haut de leur tableau de bord.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
          </div>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Message</CardTitle>
                <CardDescription>Activez l'annonce pour la rendre visible aux praticiens.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div>
                    <p className="font-medium text-sm">Annonce active</p>
                    <p className="text-xs text-muted-foreground">
                      {notice.enabled ? "Visible par tous les praticiens" : "Masquée"}
                    </p>
                  </div>
                  <Switch checked={notice.enabled} onCheckedChange={(v) => update("enabled", v)} />
                </div>

                <div className="space-y-2">
                  <Label>Type d'annonce</Label>
                  <Select value={notice.type} onValueChange={(v) => update("type", v as PractitionerNotice["type"])}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NOTICE_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Titre</Label>
                  <Input
                    value={notice.title}
                    onChange={(e) => update("title", e.target.value)}
                    placeholder="Travaux dans le hall d'entrée"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea
                    rows={5}
                    value={notice.message}
                    onChange={(e) => update("message", e.target.value)}
                    placeholder="Du 1er au 15 septembre, l'accès se fera par l'entrée arrière…"
                  />
                </div>

                <Button onClick={handleSave} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Enregistrer
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <p className="text-sm font-medium">Aperçu</p>
              <PractitionerNoticeBanner notice={{ ...notice, enabled: true }} />
              {!notice.title && !notice.message && (
                <p className="text-sm text-muted-foreground">Saisissez un titre ou un message pour voir l'aperçu.</p>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminPractitionerNotice;
