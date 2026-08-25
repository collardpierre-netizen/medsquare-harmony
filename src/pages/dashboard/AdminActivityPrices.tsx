import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  ArrowLeft,
  Edit,
  Trash2,
  Receipt,
  Tag,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const FREQUENCY_LABELS: Record<string, string> = {
  unit: "À l'unité",
  pack_5: "Carnet 5",
  pack_10: "Carnet 10",
  monthly: "Mensuel",
  quarterly: "Trimestriel",
  biannual: "Semestriel",
  annual: "Annuel",
  biennial: "Bi-annuel",
};

const FREQUENCY_OPTIONS = Object.entries(FREQUENCY_LABELS).map(([value, label]) => ({
  value,
  label,
}));

interface Activity {
  id: string;
  title: string;
  category: string;
  is_free: boolean;
  price: number | null;
  profiles: { first_name: string; last_name: string } | null;
}

interface PriceTier {
  id: string;
  activity_id: string;
  label: string;
  price: number;
  billing_frequency: BillingFrequency;
  vat_mode: VatMode;
  sort_order: number;
  is_active: boolean;
}

type BillingFrequency = "unit" | "pack_5" | "pack_10" | "monthly" | "quarterly" | "biannual" | "annual" | "biennial";

type VatMode = "htva" | "ttc";

const VAT_LABELS: Record<VatMode, string> = {
  htva: "HTVA",
  ttc: "TTC",
};

const emptyTier = {
  label: "",
  price: "",
  billing_frequency: "unit" as BillingFrequency,
  vat_mode: "htva" as VatMode,
  is_active: true,
};


const AdminActivityPrices = () => {
  const { profile, isAdmin } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [activities, setActivities] = useState<Activity[]>([]);
  const [pricesMap, setPricesMap] = useState<Record<string, PriceTier[]>>({});
  const [loading, setLoading] = useState(true);

  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [tierDialogOpen, setTierDialogOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<PriceTier | null>(null);
  const [tierForm, setTierForm] = useState<typeof emptyTier>(emptyTier);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTierId, setDeleteTierId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);

    let activityQuery = supabase
      .from("activities")
      .select("id, title, category, is_free, price, profiles(first_name, last_name)")
      .eq("is_active", true)
      .order("title");

    if (!isAdmin && profile) {
      activityQuery = activityQuery.eq("practitioner_id", profile.id);
    }

    const { data: acts, error: actsError } = await activityQuery;

    if (actsError) {
      toast({ variant: "destructive", title: "Erreur de chargement", description: actsError.message });
      setLoading(false);
      return;
    }

    const activitiesData = (acts || []) as unknown as Activity[];
    setActivities(activitiesData);

    if (activitiesData.length > 0) {
      const ids = activitiesData.map((a) => a.id);
      const { data: pricesData, error: pricesError } = await supabase
        .from("activity_prices")
        .select("*")
        .in("activity_id", ids)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (pricesError) {
        toast({ variant: "destructive", title: "Erreur de chargement des tarifs", description: pricesError.message });
      } else {
        const grouped: Record<string, PriceTier[]> = {};
        (pricesData || []).forEach((p) => {
          if (!grouped[p.activity_id]) grouped[p.activity_id] = [];
          grouped[p.activity_id].push(p as PriceTier);
        });
        setPricesMap(grouped);
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [profile, isAdmin]);

  const openAddDialog = (activity: Activity) => {
    setSelectedActivity(activity);
    setEditingTier(null);
    setTierForm(emptyTier);
    setTierDialogOpen(true);
  };

  const openEditDialog = (activity: Activity, tier: PriceTier) => {
    setSelectedActivity(activity);
    setEditingTier(tier);
    setTierForm({
      label: tier.label,
      price: String(tier.price),
      billing_frequency: tier.billing_frequency,
      vat_mode: tier.vat_mode,
      is_active: tier.is_active,
    });
    setTierDialogOpen(true);
  };

  const handleSaveTier = async () => {
    if (!selectedActivity) return;
    if (!tierForm.label.trim()) {
      toast({ variant: "destructive", title: "Libellé requis" });
      return;
    }
    const priceNum = parseFloat(tierForm.price);
    if (Number.isNaN(priceNum) || priceNum < 0) {
      toast({ variant: "destructive", title: "Prix invalide" });
      return;
    }

    const siblings = (pricesMap[selectedActivity.id] || []).filter(
      (t) => !editingTier || t.id !== editingTier.id
    );
    const duplicate = siblings.find(
      (t) =>
        t.label.trim().toLowerCase() === tierForm.label.trim().toLowerCase() &&
        t.billing_frequency === tierForm.billing_frequency
    );
    if (duplicate) {
      toast({
        variant: "destructive",
        title: "Pilier en doublon",
        description: `Un tarif "${tierForm.label}" avec la fréquence "${FREQUENCY_LABELS[tierForm.billing_frequency]}" existe déjà pour cette activité.`,
      });
      return;
    }

    setIsSaving(true);

    if (editingTier) {
      const { error } = await supabase
        .from("activity_prices")
        .update({
          label: tierForm.label.trim(),
          price: priceNum,
          billing_frequency: tierForm.billing_frequency,
          vat_mode: tierForm.vat_mode,
          is_active: tierForm.is_active,
        })
        .eq("id", editingTier.id);

      if (error) {
        toast({ variant: "destructive", title: "Erreur", description: error.message });
      } else {
        toast({ title: "Tarif mis à jour" });
        setTierDialogOpen(false);
        fetchData();
      }
    } else {
      const existing = pricesMap[selectedActivity.id] || [];
      const { error } = await supabase.from("activity_prices").insert({
        activity_id: selectedActivity.id,
        label: tierForm.label.trim(),
        price: priceNum,
        billing_frequency: tierForm.billing_frequency,
        vat_mode: tierForm.vat_mode,
        sort_order: existing.length,
        is_active: tierForm.is_active,
      });

      if (error) {
        toast({ variant: "destructive", title: "Erreur", description: error.message });
      } else {
        toast({ title: "Tarif ajouté" });
        setTierDialogOpen(false);
        fetchData();
      }
    }

    setIsSaving(false);
  };

  const handleDeleteTier = async () => {
    if (!deleteTierId) return;
    const { error } = await supabase.from("activity_prices").delete().eq("id", deleteTierId);
    if (error) {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    } else {
      toast({ title: "Tarif supprimé" });
      fetchData();
    }
    setDeleteTierId(null);
  };

  const moveTier = async (activityId: string, index: number, direction: "up" | "down") => {
    const tiers = [...(pricesMap[activityId] || [])];
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === tiers.length - 1) return;

    const swapIndex = direction === "up" ? index - 1 : index + 1;
    const temp = tiers[index].sort_order;
    tiers[index].sort_order = tiers[swapIndex].sort_order;
    tiers[swapIndex].sort_order = temp;

    await Promise.all([
      supabase.from("activity_prices").update({ sort_order: tiers[index].sort_order }).eq("id", tiers[index].id),
      supabase.from("activity_prices").update({ sort_order: tiers[swapIndex].sort_order }).eq("id", tiers[swapIndex].id),
    ]);

    fetchData();
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("fr-BE", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="font-display text-2xl font-bold">Tarifs des activités</h1>
            <p className="text-sm text-muted-foreground">
              Gérez les paliers tarifaires de vos activités et cours.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : activities.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Aucune activité trouvée.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {activities.map((activity) => {
              const tiers = pricesMap[activity.id] || [];
              const hasTiers = tiers.length > 0;

              return (
                <Card key={activity.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <CardTitle className="font-display text-base">{activity.title}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                          {activity.profiles && `${activity.profiles.first_name} ${activity.profiles.last_name}`}
                          {!hasTiers && activity.is_free && (
                            <Badge variant="secondary" className="ml-2 text-[10px]">Gratuit</Badge>
                          )}
                          {!hasTiers && !activity.is_free && activity.price && (
                            <Badge variant="outline" className="ml-2 text-[10px]">
                              {formatPrice(activity.price)} (prix unique)
                            </Badge>
                          )}
                          {hasTiers && (
                            <Badge className="ml-2 text-[10px] bg-primary/10 text-primary border-primary/20">
                              {tiers.length} palier{tiers.length > 1 ? "s" : ""}
                            </Badge>
                          )}
                        </p>
                      </div>
                      <Button size="sm" onClick={() => openAddDialog(activity)} className="gap-1.5">
                        <Plus className="h-4 w-4" /> Ajouter un tarif
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {hasTiers ? (
                      <div className="space-y-2">
                        {tiers.map((tier, idx) => (
                          <div
                            key={tier.id}
                            className="flex items-center justify-between p-3 rounded-xl border border-border bg-card hover:bg-accent/30 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex flex-col gap-0.5">
                                <span className="font-medium text-sm">{tier.label}</span>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-[10px]">
                                    {FREQUENCY_LABELS[tier.billing_frequency] || tier.billing_frequency}
                                  </Badge>
                                  <span className="text-sm font-semibold text-primary">{formatPrice(tier.price)}</span>
                                  <Badge variant="secondary" className="text-[10px]">
                                    {VAT_LABELS[tier.vat_mode] || tier.vat_mode}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => moveTier(activity.id, idx, "up")}
                                disabled={idx === 0}
                              >
                                <ArrowUp className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => moveTier(activity.id, idx, "down")}
                                disabled={idx === tiers.length - 1}
                              >
                                <ArrowDown className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEditDialog(activity, tier)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => setDeleteTierId(tier.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        {tiers.length > 0 && (() => {
                          const htvaTotal = tiers
                            .filter((t) => t.vat_mode === "htva")
                            .reduce((s, t) => s + Number(t.price), 0);
                          const ttcTotal = tiers
                            .filter((t) => t.vat_mode === "ttc")
                            .reduce((s, t) => s + Number(t.price), 0);
                          const mixed = new Set(tiers.map((t) => t.vat_mode)).size > 1;
                          return (
                            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
                              <span className="text-muted-foreground font-medium">Totaux paliers :</span>
                              {htvaTotal > 0 && (
                                <span className="font-semibold">{formatPrice(htvaTotal)} HTVA</span>
                              )}
                              {ttcTotal > 0 && (
                                <span className="font-semibold">{formatPrice(ttcTotal)} TTC</span>
                              )}
                              {mixed && (
                                <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200 bg-amber-50">
                                  Mix HTVA/TTC
                                </Badge>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground py-2">
                        Aucun palier tarifaire configuré.
                        {!activity.is_free && activity.price && (
                          <span className="ml-1">
                            Le prix unique de {formatPrice(activity.price)} est actuellement affiché.
                          </span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit dialog */}
      <Dialog open={tierDialogOpen} onOpenChange={setTierDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editingTier ? "Modifier le tarif" : "Nouveau tarif"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="tier-label">Libellé</Label>
              <Input
                id="tier-label"
                placeholder="Ex: Séance unique, Carnet 10 séances..."
                value={tierForm.label}
                onChange={(e) => setTierForm({ ...tierForm, label: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tier-price">Prix (€)</Label>
              <Input
                id="tier-price"
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={tierForm.price}
                onChange={(e) => setTierForm({ ...tierForm, price: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tier-vat">Régime de TVA</Label>
              <Select
                value={tierForm.vat_mode}
                onValueChange={(v) => setTierForm({ ...tierForm, vat_mode: v as VatMode })}
              >
                <SelectTrigger id="tier-vat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="htva">HTVA (hors TVA)</SelectItem>
                  <SelectItem value="ttc">TTC (TVA comprise)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tier-frequency">Fréquence de facturation</Label>
              <Select
                value={tierForm.billing_frequency}
                onValueChange={(v) => setTierForm({ ...tierForm, billing_frequency: v as BillingFrequency })}
              >
                <SelectTrigger id="tier-frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Actif</span>
              </div>
              <Switch
                checked={tierForm.is_active}
                onCheckedChange={(checked) => setTierForm({ ...tierForm, is_active: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTierDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSaveTier} disabled={isSaving} className="gap-1.5">
              {isSaving ? "Enregistrement..." : <><Receipt className="h-4 w-4" /> Enregistrer</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTierId} onOpenChange={(open) => !open && setDeleteTierId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce tarif ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le palier tarifaire sera définitivement supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTierId(null)}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTier} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default AdminActivityPrices;
