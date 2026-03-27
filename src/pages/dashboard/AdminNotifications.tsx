import { useEffect, useState } from "react";
import {
  Bell, Send, Filter, Loader2, Eye, Users, AlertTriangle,
  CheckCircle, Clock, BarChart3, RefreshCw, ChevronDown,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";

const NOTIFICATION_VIOLET = "#534AB7";

const TEMPLATES = [
  {
    id: "feature_announcement",
    label: "Nouvelle fonctionnalité",
    icon: "🚀",
    defaultTitle: "Nouvelle fonctionnalité disponible !",
    defaultBody: "Découvrez les dernières améliorations de votre espace praticien.",
    defaultCta: "Découvrir",
    defaultCtaUrl: "/dashboard",
  },
  {
    id: "profile_incomplete",
    label: "Profil incomplet",
    icon: "📋",
    defaultTitle: "Complétez votre fiche praticien",
    defaultBody: "Votre fiche n'est complète qu'à {score}%. Renseignez les informations manquantes pour améliorer votre visibilité.",
    defaultCta: "Compléter mon profil",
    defaultCtaUrl: "/dashboard/profile",
  },
  {
    id: "new_qna_pending",
    label: "Question en attente",
    icon: "❓",
    defaultTitle: "Une question attend votre réponse",
    defaultBody: "Un patient vous a posé une question. Répondez-y pour améliorer votre fiche.",
    defaultCta: "Voir mes questions",
    defaultCtaUrl: "/dashboard/qna",
  },
  {
    id: "rates_reminder",
    label: "Rappel tarifs",
    icon: "💰",
    defaultTitle: "Ajoutez vos tarifs INAMI",
    defaultBody: "Vos tarifs ne sont pas encore renseignés. Ajoutez-les pour informer vos patients.",
    defaultCta: "Gérer mes tarifs",
    defaultCtaUrl: "/dashboard/rates",
  },
];

interface Practitioner {
  id: string;
  first_name: string;
  last_name: string;
  specialty: string | null;
  profile_score: number | null;
  missing_fields: string[] | null;
  avatar_url: string | null;
  is_active: boolean;
}

interface LogEntry {
  id: string;
  practitioner_id: string;
  template_id: string;
  channel: string;
  status: string;
  sent_at: string;
  metadata: any;
}

const AdminNotifications = () => {
  const { toast } = useToast();
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Form state
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0].id);
  const [targeting, setTargeting] = useState<"all" | "score" | "specialty" | "manual">("all");
  const [scoreThreshold, setScoreThreshold] = useState(70);
  const [specialtyFilter, setSpecialtyFilter] = useState("");
  const [manualSelection, setManualSelection] = useState<Set<string>>(new Set());
  const [channelInApp, setChannelInApp] = useState(true);
  const [channelEmail, setChannelEmail] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customBody, setCustomBody] = useState("");
  const [customCta, setCustomCta] = useState("");
  const [customCtaUrl, setCustomCtaUrl] = useState("");

  // Preview + confirm
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const fetchData = async () => {
    const [{ data: profiles }, { data: logData }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, first_name, last_name, specialty, profile_score, missing_fields, avatar_url, is_active")
        .order("last_name"),
      supabase
        .from("notification_logs")
        .select("*")
        .order("sent_at", { ascending: false })
        .limit(100),
    ]);
    setPractitioners((profiles as any[]) || []);
    setLogs((logData as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const template = TEMPLATES.find((t) => t.id === selectedTemplate)!;
  const title = customTitle || template.defaultTitle;
  const body = customBody || template.defaultBody;
  const ctaLabel = customCta || template.defaultCta;
  const ctaUrl = customCtaUrl || template.defaultCtaUrl;

  const specialties = [...new Set(practitioners.map((p) => p.specialty).filter(Boolean))] as string[];

  const targetedPractitioners = practitioners.filter((p) => {
    if (!p.is_active) return false;
    if (targeting === "all") return true;
    if (targeting === "score") return (p.profile_score ?? 0) < scoreThreshold;
    if (targeting === "specialty") return p.specialty === specialtyFilter;
    if (targeting === "manual") return manualSelection.has(p.id);
    return true;
  });

  const handleSelectTemplate = (id: string) => {
    setSelectedTemplate(id);
    setCustomTitle("");
    setCustomBody("");
    setCustomCta("");
    setCustomCtaUrl("");
  };

  const toggleManualSelect = (id: string) => {
    setManualSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSend = async () => {
    if (targetedPractitioners.length === 0) {
      toast({ title: "Aucun destinataire", variant: "destructive" });
      return;
    }
    setSending(true);
    setConfirmOpen(false);

    try {
      // Send in-app notifications
      if (channelInApp) {
        const rows = targetedPractitioners.map((p) => ({
          practitioner_id: p.id,
          type: selectedTemplate,
          title: title.replace("{score}", String(p.profile_score ?? 0)),
          body: body.replace("{score}", String(p.profile_score ?? 0)),
          cta_label: ctaLabel,
          cta_url: ctaUrl,
        }));

        const { error } = await supabase.from("practitioner_notifications").insert(rows);
        if (error) throw error;
      }

      // Log the sends
      const logRows = targetedPractitioners.map((p) => ({
        practitioner_id: p.id,
        template_id: selectedTemplate,
        channel: channelInApp && channelEmail ? "both" : channelInApp ? "in_app" : "email",
        status: "sent",
        metadata: { title, targetCount: targetedPractitioners.length },
      }));
      await supabase.from("notification_logs").insert(logRows);

      // Send emails if enabled
      if (channelEmail) {
        await supabase.functions.invoke("send-feature-email", {
          body: {
            practitioner_ids: targetedPractitioners.map((p) => p.id),
            template_id: selectedTemplate,
            custom_title: title,
            custom_body: body,
            cta_label: ctaLabel,
            cta_url: ctaUrl,
          },
        });
      }

      toast({
        title: "Notifications envoyées ✅",
        description: `${targetedPractitioners.length} praticien(s) notifié(s) via ${channelInApp && channelEmail ? "in-app + email" : channelInApp ? "in-app" : "email"}.`,
      });
      fetchData();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
    setSending(false);
  };

  const sendToOne = async (practitioner: Practitioner) => {
    const { error } = await supabase.from("practitioner_notifications").insert({
      practitioner_id: practitioner.id,
      type: "profile_incomplete",
      title: `Complétez votre fiche praticien (${practitioner.profile_score ?? 0}%)`,
      body: `Votre fiche n'est complète qu'à ${practitioner.profile_score ?? 0}%. ${(practitioner.missing_fields || []).slice(0, 3).join(", ")} sont manquants.`,
      cta_label: "Compléter mon profil",
      cta_url: "/dashboard/profile",
    });
    if (!error) {
      await supabase.from("notification_logs").insert({
        practitioner_id: practitioner.id,
        template_id: "profile_incomplete",
        channel: "in_app",
        status: "sent",
      });
      toast({
        title: "Notification envoyée",
        description: `${practitioner.first_name} ${practitioner.last_name} a été notifié.`,
      });
    }
  };

  // Aggregate logs by template+date for history
  const campaignHistory = logs.reduce<Record<string, { template_id: string; date: string; count: number; channel: string }>>((acc, log) => {
    const day = format(new Date(log.sent_at), "yyyy-MM-dd");
    const key = `${log.template_id}-${day}-${log.channel}`;
    if (!acc[key]) acc[key] = { template_id: log.template_id, date: day, count: 0, channel: log.channel };
    acc[key].count++;
    return acc;
  }, {});

  const campaigns = Object.values(campaignHistory).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="font-display text-xl font-bold flex items-center gap-2">
            <Bell className="h-5 w-5" style={{ color: NOTIFICATION_VIOLET }} />
            Notifications praticiens
          </h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            Informez les praticiens des nouvelles fonctionnalités et invitez-les à compléter leur fiche.
          </p>
        </div>

        <Tabs defaultValue="send">
          <TabsList>
            <TabsTrigger value="send">Nouvelle notification</TabsTrigger>
            <TabsTrigger value="history">Historique</TabsTrigger>
          </TabsList>

          <TabsContent value="send" className="space-y-6 mt-4">
            {/* Template selector */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">1. Choisir un template</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleSelectTemplate(t.id)}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        selectedTemplate === t.id
                          ? "border-[#534AB7] bg-[#534AB7]/5"
                          : "border-border hover:border-muted-foreground/30"
                      }`}
                    >
                      <span className="text-2xl">{t.icon}</span>
                      <p className="font-medium text-sm mt-2">{t.label}</p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Targeting */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  2. Ciblage
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {([
                    { value: "all", label: "Tous les praticiens", icon: Users },
                    { value: "score", label: `Score < ${scoreThreshold}%`, icon: AlertTriangle },
                    { value: "specialty", label: "Par spécialité", icon: BarChart3 },
                    { value: "manual", label: "Sélection manuelle", icon: CheckCircle },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setTargeting(opt.value)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        targeting === opt.value
                          ? "border-[#534AB7] bg-[#534AB7]/5"
                          : "border-border hover:border-muted-foreground/30"
                      }`}
                    >
                      <opt.icon className="h-4 w-4 mb-1" style={targeting === opt.value ? { color: NOTIFICATION_VIOLET } : {}} />
                      <p className="font-medium text-xs">{opt.label}</p>
                    </button>
                  ))}
                </div>

                {targeting === "score" && (
                  <div className="flex items-center gap-3">
                    <Label className="text-sm whitespace-nowrap">Score inférieur à :</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={scoreThreshold}
                      onChange={(e) => setScoreThreshold(Number(e.target.value))}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                )}

                {targeting === "specialty" && (
                  <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Choisir une spécialité" />
                    </SelectTrigger>
                    <SelectContent>
                      {specialties.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {targeting === "manual" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                    {practitioners.filter((p) => p.is_active).map((p) => (
                      <label
                        key={p.id}
                        className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted cursor-pointer"
                      >
                        <Checkbox
                          checked={manualSelection.has(p.id)}
                          onCheckedChange={() => toggleManualSelect(p.id)}
                        />
                        <span className="text-sm">{p.first_name} {p.last_name}</span>
                        <Badge variant="outline" className="ml-auto text-[10px]">
                          {p.profile_score ?? 0}%
                        </Badge>
                      </label>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium" style={{ color: NOTIFICATION_VIOLET }}>
                    {targetedPractitioners.length}
                  </span>
                  <span className="text-muted-foreground">praticien(s) ciblé(s)</span>
                </div>
              </CardContent>
            </Card>

            {/* Channel + message */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">3. Canal & message</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-6">
                  <div className="flex items-center gap-2">
                    <Switch checked={channelInApp} onCheckedChange={setChannelInApp} />
                    <Label className="text-sm">In-app</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={channelEmail} onCheckedChange={setChannelEmail} />
                    <Label className="text-sm">Email</Label>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-sm">Titre (optionnel)</Label>
                    <Input
                      placeholder={template.defaultTitle}
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Message (optionnel) — utilisez {"{score}"} pour le score</Label>
                    <Textarea
                      placeholder={template.defaultBody}
                      rows={3}
                      value={customBody}
                      onChange={(e) => setCustomBody(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-sm">Libellé CTA</Label>
                      <Input
                        placeholder={template.defaultCta}
                        value={customCta}
                        onChange={(e) => setCustomCta(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">URL CTA</Label>
                      <Input
                        placeholder={template.defaultCtaUrl}
                        value={customCtaUrl}
                        onChange={(e) => setCustomCtaUrl(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setPreviewOpen(true)}>
                <Eye className="h-4 w-4 mr-2" />
                Aperçu
              </Button>
              <Button
                onClick={() => setConfirmOpen(true)}
                disabled={!channelInApp && !channelEmail}
                style={{ backgroundColor: NOTIFICATION_VIOLET }}
                className="text-white hover:opacity-90"
              >
                <Send className="h-4 w-4 mr-2" />
                Envoyer ({targetedPractitioners.length})
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Historique des envois
                </CardTitle>
              </CardHeader>
              <CardContent>
                {campaigns.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">Aucun envoi pour le moment.</p>
                ) : (
                  <div className="space-y-2">
                    {campaigns.map((c, i) => {
                      const tpl = TEMPLATES.find((t) => t.id === c.template_id);
                      return (
                        <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border">
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{tpl?.icon || "📬"}</span>
                            <div>
                              <p className="text-sm font-medium">{tpl?.label || c.template_id}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(c.date), "dd MMMM yyyy", { locale: fr })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="text-xs">
                              {c.count} destinataire{c.count > 1 ? "s" : ""}
                            </Badge>
                            <Badge
                              className="text-xs"
                              style={
                                c.channel === "in_app"
                                  ? { backgroundColor: `${NOTIFICATION_VIOLET}20`, color: NOTIFICATION_VIOLET, borderColor: `${NOTIFICATION_VIOLET}40` }
                                  : { backgroundColor: "#e0f2fe", color: "#0369a1", borderColor: "#bae6fd" }
                              }
                            >
                              {c.channel === "both" ? "In-app + Email" : c.channel === "email" ? "Email" : "In-app"}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Preview dialog */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Aperçu de la notification</DialogTitle>
            </DialogHeader>
            <div className="rounded-xl border-2 p-5 space-y-3" style={{ borderColor: NOTIFICATION_VIOLET }}>
              <div className="flex items-start gap-3">
                <span className="text-2xl">{template.icon}</span>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{title.replace("{score}", "65")}</p>
                  <p className="text-sm text-muted-foreground mt-1">{body.replace("{score}", "65")}</p>
                </div>
              </div>
              {ctaLabel && (
                <Button
                  size="sm"
                  className="w-full text-white"
                  style={{ backgroundColor: NOTIFICATION_VIOLET }}
                >
                  {ctaLabel}
                </Button>
              )}
              <p className="text-[10px] text-muted-foreground text-center">il y a quelques secondes</p>
            </div>
          </DialogContent>
        </Dialog>

        {/* Confirm dialog */}
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmer l'envoi</AlertDialogTitle>
              <AlertDialogDescription>
                Vous allez envoyer la notification « {title.replace("{score}", "XX")} » à{" "}
                <strong>{targetedPractitioners.length} praticien(s)</strong> via{" "}
                {channelInApp && channelEmail
                  ? "in-app et email"
                  : channelInApp
                  ? "notification in-app"
                  : "email"}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleSend}
                disabled={sending}
                style={{ backgroundColor: NOTIFICATION_VIOLET }}
                className="text-white"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Envoyer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default AdminNotifications;
