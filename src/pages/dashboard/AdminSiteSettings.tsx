import { useState, useEffect } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  DEFAULT_SETTINGS,
  SiteSettings,
  FeatureItem,
  TestimonialItem,
  saveSiteSettings,
} from "@/hooks/useSiteSettings";
import { supabase } from "@/integrations/supabase/client";

const ICON_OPTIONS = ["Heart", "Users", "Shield", "Clock", "Star", "Zap", "Award", "Smile", "ThumbsUp", "CheckCircle"];

const AdminSiteSettings = () => {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", ["hero", "why", "testimonials", "contact"]);
      if (data && data.length > 0) {
        const merged = { ...DEFAULT_SETTINGS };
        for (const row of data) {
          const k = row.key as keyof SiteSettings;
          if (k in merged) merged[k] = { ...merged[k], ...(row.value as any) };
        }
        setSettings(merged);
      }
      setLoading(false);
    };
    fetch();
  }, []);

  const save = async (section: keyof SiteSettings) => {
    setSaving(section);
    try {
      await saveSiteSettings(section, settings[section]);
      toast.success("Section sauvegardée !");
    } catch {
      toast.error("Erreur lors de la sauvegarde.");
    }
    setSaving(null);
  };

  const updateHero = (field: string, value: string) =>
    setSettings((s) => ({ ...s, hero: { ...s.hero, [field]: value } }));

  const updateWhy = (field: string, value: string) =>
    setSettings((s) => ({ ...s, why: { ...s.why, [field]: value } }));

  const updateFeature = (idx: number, field: keyof FeatureItem, value: string) =>
    setSettings((s) => ({
      ...s,
      why: {
        ...s.why,
        features: s.why.features.map((f, i) => (i === idx ? { ...f, [field]: value } : f)),
      },
    }));

  const addFeature = () =>
    setSettings((s) => ({
      ...s,
      why: { ...s.why, features: [...s.why.features, { icon: "Heart", title: "", description: "" }] },
    }));

  const removeFeature = (idx: number) =>
    setSettings((s) => ({
      ...s,
      why: { ...s.why, features: s.why.features.filter((_, i) => i !== idx) },
    }));

  const updateTestimonials = (field: string, value: string) =>
    setSettings((s) => ({ ...s, testimonials: { ...s.testimonials, [field]: value } }));

  const updateTestimonial = (idx: number, field: keyof TestimonialItem, value: string) =>
    setSettings((s) => ({
      ...s,
      testimonials: {
        ...s.testimonials,
        items: s.testimonials.items.map((t, i) => (i === idx ? { ...t, [field]: value } : t)),
      },
    }));

  const addTestimonial = () =>
    setSettings((s) => ({
      ...s,
      testimonials: { ...s.testimonials, items: [...s.testimonials.items, { text: "", author: "", role: "" }] },
    }));

  const removeTestimonial = (idx: number) =>
    setSettings((s) => ({
      ...s,
      testimonials: { ...s.testimonials, items: s.testimonials.items.filter((_, i) => i !== idx) },
    }));

  const updateContact = (field: string, value: string) =>
    setSettings((s) => ({ ...s, contact: { ...s.contact, [field]: value } }));

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Paramètres du site</h1>
          <p className="text-muted-foreground text-sm">Gérez les textes et contenus de la page d'accueil.</p>
        </div>

        <Tabs defaultValue="hero" className="space-y-4">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="hero">Hero</TabsTrigger>
            <TabsTrigger value="why">Valeurs</TabsTrigger>
            <TabsTrigger value="testimonials">Témoignages</TabsTrigger>
            <TabsTrigger value="contact">Contact</TabsTrigger>
          </TabsList>

          {/* HERO */}
          <TabsContent value="hero">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Section Hero</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Badge (sous-titre supérieur)</Label>
                  <Input value={settings.hero.badge} onChange={(e) => updateHero("badge", e.target.value)} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Titre principal</Label>
                    <Input value={settings.hero.title} onChange={(e) => updateHero("title", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Mot en accent (italique)</Label>
                    <Input value={settings.hero.titleAccent} onChange={(e) => updateHero("titleAccent", e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Sous-titre</Label>
                  <Textarea value={settings.hero.subtitle} onChange={(e) => updateHero("subtitle", e.target.value)} rows={3} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Bouton principal</Label>
                    <Input value={settings.hero.ctaPrimary} onChange={(e) => updateHero("ctaPrimary", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Bouton secondaire</Label>
                    <Input value={settings.hero.ctaSecondary} onChange={(e) => updateHero("ctaSecondary", e.target.value)} />
                  </div>
                </div>
                <Button onClick={() => save("hero")} disabled={saving === "hero"}>
                  {saving === "hero" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Sauvegarder
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* WHY */}
          <TabsContent value="why">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Section "Pourquoi Medsquare"</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Badge</Label>
                  <Input value={settings.why.badge} onChange={(e) => updateWhy("badge", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Titre</Label>
                  <Input value={settings.why.title} onChange={(e) => updateWhy("title", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Sous-titre</Label>
                  <Input value={settings.why.subtitle} onChange={(e) => updateWhy("subtitle", e.target.value)} />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Avantages</Label>
                    <Button variant="outline" size="sm" onClick={addFeature}>
                      <Plus className="h-4 w-4 mr-1" /> Ajouter
                    </Button>
                  </div>
                  {settings.why.features.map((f, idx) => (
                    <div key={idx} className="border border-border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Avantage {idx + 1}</span>
                        <Button variant="ghost" size="sm" onClick={() => removeFeature(idx)} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Icône</Label>
                          <select
                            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                            value={f.icon}
                            onChange={(e) => updateFeature(idx, "icon", e.target.value)}
                          >
                            {ICON_OPTIONS.map((ic) => (
                              <option key={ic} value={ic}>{ic}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1 md:col-span-2">
                          <Label className="text-xs">Titre</Label>
                          <Input value={f.title} onChange={(e) => updateFeature(idx, "title", e.target.value)} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Description</Label>
                        <Textarea value={f.description} onChange={(e) => updateFeature(idx, "description", e.target.value)} rows={2} />
                      </div>
                    </div>
                  ))}
                </div>

                <Button onClick={() => save("why")} disabled={saving === "why"}>
                  {saving === "why" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Sauvegarder
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TESTIMONIALS */}
          <TabsContent value="testimonials">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Témoignages</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Badge</Label>
                  <Input value={settings.testimonials.badge} onChange={(e) => updateTestimonials("badge", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Titre</Label>
                  <Input value={settings.testimonials.title} onChange={(e) => updateTestimonials("title", e.target.value)} />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Avis</Label>
                    <Button variant="outline" size="sm" onClick={addTestimonial}>
                      <Plus className="h-4 w-4 mr-1" /> Ajouter
                    </Button>
                  </div>
                  {settings.testimonials.items.map((t, idx) => (
                    <div key={idx} className="border border-border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Témoignage {idx + 1}</span>
                        <Button variant="ghost" size="sm" onClick={() => removeTestimonial(idx)} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Texte</Label>
                        <Textarea value={t.text} onChange={(e) => updateTestimonial(idx, "text", e.target.value)} rows={3} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Auteur</Label>
                          <Input value={t.author} onChange={(e) => updateTestimonial(idx, "author", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Rôle / détail</Label>
                          <Input value={t.role} onChange={(e) => updateTestimonial(idx, "role", e.target.value)} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <Button onClick={() => save("testimonials")} disabled={saving === "testimonials"}>
                  {saving === "testimonials" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Sauvegarder
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CONTACT */}
          <TabsContent value="contact">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Bandeau de contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Titre</Label>
                  <Input value={settings.contact.title} onChange={(e) => updateContact("title", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Sous-titre</Label>
                  <Input value={settings.contact.subtitle} onChange={(e) => updateContact("subtitle", e.target.value)} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Téléphone</Label>
                    <Input value={settings.contact.phone} onChange={(e) => updateContact("phone", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input value={settings.contact.email} onChange={(e) => updateContact("email", e.target.value)} />
                  </div>
                </div>
                <Button onClick={() => save("contact")} disabled={saving === "contact"}>
                  {saving === "contact" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Sauvegarder
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default AdminSiteSettings;
