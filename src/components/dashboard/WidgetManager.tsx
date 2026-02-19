import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Save, Loader2, Copy, ExternalLink, Tv } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { WidgetConfig } from "@/pages/Widget";

const WIDGET_TYPES = [
  { value: "practitioners", label: "Praticiens" },
  { value: "activities", label: "Activités" },
  { value: "rooms", label: "Espaces / Salles" },
] as const;

const TEMPLATES = [
  { value: "grid", label: "Grille", desc: "Grille responsive multi-colonnes" },
  { value: "carousel", label: "Carrousel", desc: "Défilement horizontal auto" },
  { value: "list", label: "Liste", desc: "Liste verticale compacte" },
];

const WidgetManager = () => {
  const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "widgets")
        .single();
      if (data) {
        setWidgets((data.value as any)?.items || []);
      }
      setLoading(false);
    };
    fetch();
  }, []);

  const saveWidgets = async (updated: WidgetConfig[]) => {
    setSaving(true);
    try {
      await supabase
        .from("settings")
        .upsert(
          { key: "widgets", value: { items: updated } as any, updated_at: new Date().toISOString() },
          { onConflict: "key" }
        );
      setWidgets(updated);
      toast.success("Widgets sauvegardés !");
    } catch {
      toast.error("Erreur lors de la sauvegarde.");
    }
    setSaving(false);
  };

  const addWidget = () => {
    const newWidget: WidgetConfig = {
      id: crypto.randomUUID().slice(0, 8),
      name: "Nouveau widget",
      type: "practitioners",
      template: "grid",
      settings: {
        autoScroll: false,
        scrollInterval: 5,
        showTitle: true,
        title: "Nos praticiens",
        maxItems: 20,
        theme: "light",
      },
    };
    const updated = [...widgets, newWidget];
    setWidgets(updated);
  };

  const updateWidget = (idx: number, partial: Partial<WidgetConfig>) => {
    setWidgets((prev) =>
      prev.map((w, i) => (i === idx ? { ...w, ...partial } : w))
    );
  };

  const updateWidgetSettings = (idx: number, key: string, value: any) => {
    setWidgets((prev) =>
      prev.map((w, i) =>
        i === idx ? { ...w, settings: { ...w.settings, [key]: value } } : w
      )
    );
  };

  const removeWidget = (idx: number) => {
    const updated = widgets.filter((_, i) => i !== idx);
    setWidgets(updated);
  };

  const getWidgetUrl = (widget: WidgetConfig) => {
    return `${window.location.origin}/widget/${widget.id}`;
  };

  const copyUrl = (widget: WidgetConfig) => {
    navigator.clipboard.writeText(getWidgetUrl(widget));
    toast.success("URL copiée !");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tv className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Widgets d'affichage</CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={addWidget}>
            <Plus className="h-4 w-4 mr-1" /> Nouveau widget
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Créez des widgets autonomes avec des URLs dédiées pour affichage sur TV, écran de salle d'attente, etc.
          Chaque widget est responsive et s'adapte au format de l'écran (paysage/portrait).
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {widgets.length === 0 && (
          <p className="text-center text-muted-foreground py-6">
            Aucun widget créé. Cliquez sur "Nouveau widget" pour commencer.
          </p>
        )}

        {widgets.map((widget, idx) => (
          <div key={widget.id} className="border border-border rounded-xl p-4 space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Nom du widget</Label>
                    <Input
                      value={widget.name}
                      onChange={(e) => updateWidget(idx, { name: e.target.value })}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Type de contenu</Label>
                    <Select
                      value={widget.type}
                      onValueChange={(v) => updateWidget(idx, { type: v as WidgetConfig["type"] })}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WIDGET_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Template</Label>
                    <Select
                      value={widget.template}
                      onValueChange={(v) => updateWidget(idx, { template: v })}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TEMPLATES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label} — {t.desc}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeWidget(idx)}
                className="text-destructive hover:text-destructive shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Afficher un titre</Label>
                  <Switch
                    checked={widget.settings.showTitle}
                    onCheckedChange={(v) => updateWidgetSettings(idx, "showTitle", v)}
                  />
                </div>
                {widget.settings.showTitle && (
                  <Input
                    value={widget.settings.title || ""}
                    onChange={(e) => updateWidgetSettings(idx, "title", e.target.value)}
                    placeholder="Titre du widget"
                    className="h-9 text-sm"
                  />
                )}
                <div className="space-y-1">
                  <Label className="text-xs">Nombre max d'éléments</Label>
                  <Input
                    type="number"
                    value={widget.settings.maxItems || 20}
                    onChange={(e) => updateWidgetSettings(idx, "maxItems", parseInt(e.target.value) || 20)}
                    className="h-9 text-sm w-24"
                    min={1}
                    max={50}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Thème</Label>
                  <Select
                    value={widget.settings.theme || "light"}
                    onValueChange={(v) => updateWidgetSettings(idx, "theme", v)}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Clair</SelectItem>
                      <SelectItem value="dark">Sombre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {widget.template === "carousel" && (
                  <>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Défilement automatique</Label>
                      <Switch
                        checked={widget.settings.autoScroll}
                        onCheckedChange={(v) => updateWidgetSettings(idx, "autoScroll", v)}
                      />
                    </div>
                    {widget.settings.autoScroll && (
                      <div className="space-y-1">
                        <Label className="text-xs">Intervalle (secondes)</Label>
                        <Input
                          type="number"
                          value={widget.settings.scrollInterval || 5}
                          onChange={(e) => updateWidgetSettings(idx, "scrollInterval", parseInt(e.target.value) || 5)}
                          className="h-9 text-sm w-24"
                          min={2}
                          max={30}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* URL */}
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
              <code className="text-xs flex-1 truncate text-muted-foreground">
                {getWidgetUrl(widget)}
              </code>
              <Button variant="ghost" size="sm" onClick={() => copyUrl(widget)} className="shrink-0">
                <Copy className="h-3.5 w-3.5 mr-1" /> Copier
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(getWidgetUrl(widget), "_blank")}
                className="shrink-0"
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1" /> Ouvrir
              </Button>
            </div>
          </div>
        ))}

        <Button onClick={() => saveWidgets(widgets)} disabled={saving} className="w-full sm:w-auto">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Sauvegarder tous les widgets
        </Button>
      </CardContent>
    </Card>
  );
};

export default WidgetManager;
