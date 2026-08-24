import { useEffect, useState } from "react";
import { Info, Save, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  DEFAULT_LEGAL_NOTICE,
  LEGAL_NOTICE_KEY,
  fetchLegalNotice,
} from "./legalNotice";

const LegalNoticeEditor = () => {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(true);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchLegalNotice().then((n) => {
      setEnabled(n.enabled);
      setTitle(n.title);
      setMessage(n.message);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("settings")
      .upsert(
        {
          key: LEGAL_NOTICE_KEY,
          value: { enabled, title, message } as any,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "key" }
      );
    setSaving(false);

    if (error) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Encart mis à jour ✅" });
  };

  const handleReset = () => {
    setEnabled(DEFAULT_LEGAL_NOTICE.enabled);
    setTitle(DEFAULT_LEGAL_NOTICE.title);
    setMessage(DEFAULT_LEGAL_NOTICE.message);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Info className="h-4 w-4 text-amber-600" />
          Encart affiché aux praticiens
        </CardTitle>
        <p className="text-muted-foreground text-sm">
          Ce texte apparaît en haut de la page « Documents juridiques » du portail
          praticien et dans les PDF téléchargeables.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="text-sm">Afficher l'encart</Label>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Désactivez pour le masquer partout.
                </p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notice-title">Titre</Label>
              <Input
                id="notice-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Tarifs horaires et réductions"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notice-message">Message</Label>
              <Textarea
                id="notice-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
              />
            </div>

            {enabled && (title || message) && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Aperçu</Label>
                <Alert className="bg-amber-50/50 border-amber-200/60 text-amber-900 dark:bg-amber-950/20 dark:border-amber-800/40 dark:text-amber-100">
                  <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <AlertTitle className="text-amber-900 dark:text-amber-100">
                    {title}
                  </AlertTitle>
                  <AlertDescription className="text-amber-800/90 dark:text-amber-200/90 whitespace-pre-line">
                    {message}
                  </AlertDescription>
                </Alert>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Enregistrement..." : "Enregistrer"}
              </Button>
              <Button variant="outline" onClick={handleReset} disabled={saving}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Texte par défaut
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default LegalNoticeEditor;
