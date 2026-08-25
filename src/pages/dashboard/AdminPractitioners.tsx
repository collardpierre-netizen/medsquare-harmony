import { useEffect, useState, useMemo } from "react";
import {
  Users, Ban, CheckCircle, Plus, Loader2, Mail, RefreshCw,
  ChevronDown, ChevronUp, Pencil, Globe, Facebook, Instagram, ExternalLink,
  Linkedin, Twitter, Youtube, ArrowUp, ArrowDown, ShieldCheck,
  AlertCircle, Trash2, Phone, Bell, Filter,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import ScheduleEditor, { DaySchedule } from "@/components/dashboard/profile/ScheduleEditor";
import ImageUpload from "@/components/dashboard/ImageUpload";

const DEFAULT_SCHEDULE: DaySchedule[] = [];

const SOCIAL_FIELDS = [
  { key: "website", label: "Site web", icon: Globe, placeholder: "https://mon-site.be" },
  { key: "facebook", label: "Facebook", icon: Facebook, placeholder: "https://facebook.com/..." },
  { key: "instagram", label: "Instagram", icon: Instagram, placeholder: "https://instagram.com/..." },
  { key: "linkedin", label: "LinkedIn", icon: Linkedin, placeholder: "https://linkedin.com/in/..." },
  { key: "twitter", label: "Twitter / X", icon: Twitter, placeholder: "https://twitter.com/..." },
  { key: "youtube", label: "YouTube", icon: Youtube, placeholder: "https://youtube.com/@..." },
];

const AdminPractitioners = () => {
  const { toast } = useToast();
  const [practitioners, setPractitioners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scoreFilter, setScoreFilter] = useState<"all" | "incomplete" | "low">("all");
  const [notifyingId, setNotifyingId] = useState<string | null>(null);
  // Invite dialog
  const [open, setOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [deletingPractitioner, setDeletingPractitioner] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [inviteSchedule, setInviteSchedule] = useState<DaySchedule[]>(DEFAULT_SCHEDULE);
  const [inviteAccountType, setInviteAccountType] = useState<"practitioner" | "patient">("practitioner");
  const [roleChange, setRoleChange] = useState<{ profile: any; newRole: "practitioner" | "patient" } | null>(null);
  const [changingRole, setChangingRole] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: "", first_name: "", last_name: "", specialty: "", bio: "", phone: "", contact_email: "",
  });

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showEditSocials, setShowEditSocials] = useState(false);
  const [editSchedule, setEditSchedule] = useState<DaySchedule[]>([]);
  const [editForm, setEditForm] = useState({
    first_name: "", last_name: "", specialty: "", bio: "",
    phone: "", contact_email: "", avatar_url: "",
    inami_number: "", avg_appointment_delay_days: "" as string,
    external_booking_url: "",
    social_links: { website: "", facebook: "", instagram: "", linkedin: "", twitter: "", youtube: "" },
  });
  const [editToggles, setEditToggles] = useState({
    accepts_new_patients: true, conventioned: false, tiers_payant: false,
    video_available: false, home_visit: false, pmr_accessible: false, parking: false,
  });
  const [editLanguages, setEditLanguages] = useState<string[]>(["français"]);
  const [editSpecialties, setEditSpecialties] = useState<string[]>([]);
  const [editPaymentMethods, setEditPaymentMethods] = useState<string[]>([]);
  const [editAssociations, setEditAssociations] = useState<string[]>([]);
  const [editExperiences, setEditExperiences] = useState<any[]>([]);
  const [editFormations, setEditFormations] = useState<any[]>([]);
  const [newEditTag, setNewEditTag] = useState({ language: "", specialty: "", payment: "", association: "" });

  const fetchPractitioners = async () => {
    const [{ data: profiles }, { data: roles }, { data: loginStatus }] = await Promise.all([
      supabase.from("profiles").select("*").order("display_order" as any).order("last_name"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.rpc("get_practitioner_login_status"),
    ]);

    const rolesMap = new Map<string, string[]>();
    (roles || []).forEach((r: any) => {
      const existing = rolesMap.get(r.user_id) || [];
      existing.push(r.role);
      rolesMap.set(r.user_id, existing);
    });

    const loginMap = new Map<string, string | null>();
    (loginStatus || []).forEach((ls: any) => {
      loginMap.set(ls.user_id, ls.last_sign_in_at);
    });

    const merged = (profiles || []).map((p: any) => ({
      ...p,
      roles: rolesMap.get(p.user_id) || [],
      last_sign_in_at: loginMap.get(p.user_id) ?? null,
    }));

    setPractitioners(merged);
    setLoading(false);
  };

  useEffect(() => {
    fetchPractitioners();
  }, []);

  // A practitioner is "pending validation" if they self-registered (role=practitioner, is_active=false)
  // and are NOT an admin
  const isPendingValidation = (p: any) =>
    !p.is_active && p.roles.includes("practitioner") && !p.roles.includes("admin");

  const toggleActive = async (practitioner: any) => {
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: !practitioner.is_active })
      .eq("id", practitioner.id);

    if (!error) {
      toast({
        title: practitioner.is_active ? "Praticien masqué du site" : "Praticien visible sur le site",
        description: practitioner.is_active
          ? "Le praticien n'apparaît plus sur les pages publiques."
          : "Le praticien est à nouveau visible sur les pages publiques.",
      });
      fetchPractitioners();
    }
  };

  const activateAccount = async (practitioner: any) => {
    setActivatingId(practitioner.id);
    try {
      // Activate the profile
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: true })
        .eq("id", practitioner.id);

      if (error) throw error;

      // Send activation email (best-effort)
      supabase.functions.invoke("notify-account-activated", {
        body: { practitioner_user_id: practitioner.user_id },
      }).catch(() => {});

      toast({
        title: "Compte activé ✅",
        description: `${practitioner.first_name} ${practitioner.last_name} a été activé et notifié par email.`,
      });
      fetchPractitioners();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message || "Impossible d'activer le compte.", variant: "destructive" });
    }
    setActivatingId(null);
  };

  const movePractitioner = async (index: number, direction: "up" | "down") => {
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= practitioners.length) return;
    const a = practitioners[index];
    const b = practitioners[swapIndex];
    // Swap display_order values
    await Promise.all([
      supabase.from("profiles").update({ display_order: b.display_order ?? swapIndex } as any).eq("id", a.id),
      supabase.from("profiles").update({ display_order: a.display_order ?? index } as any).eq("id", b.id),
    ]);
    fetchPractitioners();
  };

  // ---- Invite ----
  const resetInviteForm = () => {
    setInviteForm({ email: "", first_name: "", last_name: "", specialty: "", bio: "", phone: "", contact_email: "" });
    setInviteSchedule(DEFAULT_SCHEDULE);
    setShowAdvanced(false);
  };

  const handleInvite = async () => {
    if (!inviteForm.email) {
      toast({ title: "L'email est requis", variant: "destructive" });
      return;
    }
    setInviting(true);
    try {
      const res = await supabase.functions.invoke("invite-practitioner", {
        body: {
          email: inviteForm.email,
          first_name: inviteForm.first_name,
          last_name: inviteForm.last_name,
          specialty: inviteForm.specialty,
          bio: inviteForm.bio,
          phone: inviteForm.phone,
          contact_email: inviteForm.contact_email || inviteForm.email,
          schedule: inviteSchedule.length > 0 ? inviteSchedule : null,
        },
      });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);
      toast({ title: "Invitation envoyée !", description: `Un email a été envoyé à ${inviteForm.email}` });
      resetInviteForm();
      setOpen(false);
      setTimeout(() => fetchPractitioners(), 2000);
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message || "Impossible d'envoyer l'invitation", variant: "destructive" });
    }
    setInviting(false);
  };

  const handleResendInvite = async (practitioner: any) => {
    setResendingId(practitioner.id);
    try {
      const res = await supabase.functions.invoke("invite-practitioner", {
        body: { resend_user_id: practitioner.user_id },
      });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);
      toast({
        title: "Invitation renvoyée !",
        description: `Un nouvel email a été envoyé à ${practitioner.first_name} ${practitioner.last_name}.`,
      });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message || "Impossible de renvoyer l'invitation", variant: "destructive" });
    }
    setResendingId(null);
  };

  // ---- Edit ----
  const openEdit = (p: any) => {
    setEditingId(p.id);
    const sl = p.social_links || {};
    setEditForm({
      first_name: p.first_name || "",
      last_name: p.last_name || "",
      specialty: p.specialty || "",
      bio: p.bio || "",
      phone: p.phone || "",
      contact_email: p.contact_email || "",
      avatar_url: p.avatar_url || "",
      inami_number: p.inami_number || "",
      avg_appointment_delay_days: p.avg_appointment_delay_days != null ? String(p.avg_appointment_delay_days) : "",
      external_booking_url: (p as any).external_booking_url || "",
      social_links: {
        website: sl.website || "",
        facebook: sl.facebook || "",
        instagram: sl.instagram || "",
        linkedin: sl.linkedin || "",
        twitter: sl.twitter || "",
        youtube: sl.youtube || "",
      },
    });
    setEditToggles({
      accepts_new_patients: p.accepts_new_patients ?? true,
      conventioned: p.conventioned ?? false,
      tiers_payant: p.tiers_payant ?? false,
      video_available: p.video_available ?? false,
      home_visit: p.home_visit ?? false,
      pmr_accessible: p.pmr_accessible ?? false,
      parking: p.parking ?? false,
    });
    setEditLanguages(p.languages?.length ? p.languages : ["français"]);
    setEditSpecialties(p.specialties || []);
    setEditPaymentMethods(p.payment_methods || []);
    setEditAssociations(p.associations || []);
    setEditExperiences(p.experiences || []);
    setEditFormations(p.formations || []);
    setNewEditTag({ language: "", specialty: "", payment: "", association: "" });
    try {
      const raw = typeof p.schedule === "string" ? JSON.parse(p.schedule) : p.schedule;
      setEditSchedule(Array.isArray(raw) ? raw : []);
    } catch {
      setEditSchedule([]);
    }
    setShowEditSocials(false);
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        specialty: editForm.specialty,
        bio: editForm.bio,
        phone: editForm.phone,
        contact_email: editForm.contact_email || null,
        avatar_url: editForm.avatar_url || null,
        inami_number: editForm.inami_number || null,
        avg_appointment_delay_days: editForm.avg_appointment_delay_days ? parseInt(editForm.avg_appointment_delay_days) : null,
        external_booking_url: editForm.external_booking_url || null,
        schedule: editSchedule as any,
        social_links: editForm.social_links as any,
        accepts_new_patients: editToggles.accepts_new_patients,
        conventioned: editToggles.conventioned,
        tiers_payant: editToggles.tiers_payant,
        video_available: editToggles.video_available,
        home_visit: editToggles.home_visit,
        pmr_accessible: editToggles.pmr_accessible,
        parking: editToggles.parking,
        languages: editLanguages,
        specialties: editSpecialties,
        payment_methods: editPaymentMethods,
        associations: editAssociations,
        experiences: editExperiences as any,
        formations: editFormations as any,
      } as any)
      .eq("id", editingId);

    if (error) {
      toast({ title: "Erreur", description: "Impossible de sauvegarder.", variant: "destructive" });
    } else {
      toast({ title: "Profil mis à jour", description: "Les modifications sont visibles sur le site." });
      setEditOpen(false);
      fetchPractitioners();
    }
    setSaving(false);
  };

  const handleEditAvatarUpload = async (url: string) => {
    setEditForm((f) => ({ ...f, avatar_url: url }));
    if (editingId) {
      await supabase.from("profiles").update({ avatar_url: url } as any).eq("id", editingId);
    }
  };

  const handleEditAvatarRemove = async () => {
    setEditForm((f) => ({ ...f, avatar_url: "" }));
    if (editingId) {
      await supabase.from("profiles").update({ avatar_url: "" } as any).eq("id", editingId);
    }
  };

  const handleDeletePractitioner = async () => {
    if (!deletingPractitioner) return;
    setDeleting(true);
    try {
      const res = await supabase.functions.invoke("delete-practitioner", {
        body: { practitioner_user_id: deletingPractitioner.user_id },
      });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);
      toast({
        title: "Praticien supprimé",
        description: `${deletingPractitioner.first_name} ${deletingPractitioner.last_name} a été définitivement supprimé.`,
      });
      setDeletingPractitioner(null);
      fetchPractitioners();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message || "Impossible de supprimer ce praticien.", variant: "destructive" });
    }
    setDeleting(false);
  };

  const isAccountPending = (p: any) =>
    p.roles.includes("practitioner") && !p.roles.includes("admin") && !p.last_sign_in_at;

  const filteredPractitioners = useMemo(() => {
    if (scoreFilter === "all") return practitioners;
    if (scoreFilter === "incomplete") return practitioners.filter((p: any) => (p.profile_score ?? 0) < 50);
    if (scoreFilter === "low") return practitioners.filter((p: any) => (p.profile_score ?? 0) < 70);
    return practitioners;
  }, [practitioners, scoreFilter]);

  const notifyOnePractitioner = async (p: any) => {
    setNotifyingId(p.id);
    const score = p.profile_score ?? 0;
    const missing = (p.missing_fields || []).slice(0, 3).join(", ");
    await supabase.from("practitioner_notifications").insert({
      practitioner_id: p.id,
      type: "profile_incomplete",
      title: `Complétez votre fiche (${score}%)`,
      body: `Votre fiche n'est complète qu'à ${score}%.${missing ? ` Manquant : ${missing}.` : ""}`,
      cta_label: "Compléter mon profil",
      cta_url: "/dashboard/profile",
    });
    toast({ title: "Notification envoyée", description: `${p.first_name} ${p.last_name} a été notifié.` });
    setNotifyingId(null);
  };

  const notifyAllLowScore = async () => {
    const targets = practitioners.filter((p: any) => (p.profile_score ?? 0) < 70 && p.is_active);
    if (targets.length === 0) { toast({ title: "Aucun praticien à notifier" }); return; }
    const rows = targets.map((p: any) => ({
      practitioner_id: p.id,
      type: "profile_incomplete" as const,
      title: `Complétez votre fiche (${p.profile_score ?? 0}%)`,
      body: `Votre fiche n'est complète qu'à ${p.profile_score ?? 0}%. Renseignez les informations manquantes.`,
      cta_label: "Compléter mon profil",
      cta_url: "/dashboard/profile",
    }));
    await supabase.from("practitioner_notifications").insert(rows);
    toast({ title: "Notifications envoyées", description: `${targets.length} praticien(s) notifié(s).` });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-display text-xl font-bold">Gestion des praticiens</h2>
            <p className="text-muted-foreground text-sm mt-0.5">
              Gérez les profils et les accès des praticiens.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Score filter */}
            <Select value={scoreFilter} onValueChange={(v) => setScoreFilter(v as any)}>
              <SelectTrigger className="w-48 h-9 text-xs">
                <Filter className="h-3.5 w-3.5 mr-1.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les praticiens</SelectItem>
                <SelectItem value="incomplete">Fiches incomplètes (&lt; 50%)</SelectItem>
                <SelectItem value="low">Score &lt; 70%</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={notifyAllLowScore}>
              <Bell className="h-3.5 w-3.5" />
              Notifier tous &lt; 70%
            </Button>

            {/* Invite dialog */}
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetInviteForm(); }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Inviter un praticien
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Inviter un nouveau praticien</DialogTitle>
              </DialogHeader>
              <div className="space-y-5 pt-2">
                <p className="text-sm text-muted-foreground">
                  Le praticien recevra un email pour activer son compte. Vous pouvez déjà pré-remplir son profil.
                </p>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="invite-email">Email *</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="praticien@exemple.com"
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Prénom</Label>
                      <Input
                        placeholder="Jean"
                        value={inviteForm.first_name}
                        onChange={(e) => setInviteForm((f) => ({ ...f, first_name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Nom</Label>
                      <Input
                        placeholder="Dupont"
                        value={inviteForm.last_name}
                        onChange={(e) => setInviteForm((f) => ({ ...f, last_name: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full justify-between">
                      Informations complémentaires (facultatif)
                      {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Spécialité</Label>
                      <Input
                        placeholder="Ostéopathe, Kinésithérapeute…"
                        value={inviteForm.specialty}
                        onChange={(e) => setInviteForm((f) => ({ ...f, specialty: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Bio / Présentation</Label>
                      <Textarea
                        placeholder="Présentation affichée sur la fiche publique…"
                        rows={3}
                        value={inviteForm.bio}
                        onChange={(e) => setInviteForm((f) => ({ ...f, bio: e.target.value }))}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Téléphone</Label>
                        <Input
                          placeholder="+32 470 000 000"
                          value={inviteForm.phone}
                          onChange={(e) => setInviteForm((f) => ({ ...f, phone: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Email de contact public</Label>
                        <Input
                          type="email"
                          placeholder="contact@praticien.be"
                          value={inviteForm.contact_email}
                          onChange={(e) => setInviteForm((f) => ({ ...f, contact_email: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Planning hebdomadaire</Label>
                      <p className="text-xs text-muted-foreground">
                        Définissez les jours et horaires de présence par défaut du praticien.
                      </p>
                      <ScheduleEditor schedule={inviteSchedule} onChange={setInviteSchedule} />
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Button onClick={handleInvite} disabled={inviting} className="w-full">
                  {inviting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                  Envoyer l'invitation
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Edit dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Modifier le profil du praticien</DialogTitle>
            </DialogHeader>
            <div className="space-y-5 pt-2">
              {/* Avatar */}
              <div className="flex items-center gap-4">
                <ImageUpload
                  bucket="avatars"
                  folder={editingId || "unknown"}
                  currentUrl={editForm.avatar_url || null}
                  onUpload={handleEditAvatarUpload}
                  onRemove={handleEditAvatarRemove}
                  shape="circle"
                  className="h-20 w-20"
                />
                <div>
                  <p className="text-sm font-medium">Photo de profil</p>
                  <p className="text-xs text-muted-foreground mt-0.5">JPG, PNG ou WebP · max 5 Mo</p>
                </div>
              </div>

              {/* Nom */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Prénom</Label>
                  <Input
                    value={editForm.first_name}
                    onChange={(e) => setEditForm((f) => ({ ...f, first_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nom</Label>
                  <Input
                    value={editForm.last_name}
                    onChange={(e) => setEditForm((f) => ({ ...f, last_name: e.target.value }))}
                  />
                </div>
              </div>

              {/* Spécialité */}
              <div className="space-y-2">
                <Label>Spécialité</Label>
                <Input
                  placeholder="Ostéopathe, Kinésithérapeute…"
                  value={editForm.specialty}
                  onChange={(e) => setEditForm((f) => ({ ...f, specialty: e.target.value }))}
                />
              </div>

              {/* Bio */}
              <div className="space-y-2">
                <Label>Biographie</Label>
                <Textarea
                  rows={4}
                  placeholder="Présentation publique du praticien…"
                  value={editForm.bio}
                  onChange={(e) => setEditForm((f) => ({ ...f, bio: e.target.value }))}
                />
              </div>

              {/* Contact */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Téléphone</Label>
                  <Input
                    placeholder="+32 470 000 000"
                    value={editForm.phone}
                    onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email de contact</Label>
                  <Input
                    type="email"
                    placeholder="contact@praticien.be"
                    value={editForm.contact_email}
                    onChange={(e) => setEditForm((f) => ({ ...f, contact_email: e.target.value }))}
                  />
                </div>
              </div>

              {/* INAMI & délai */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>N° INAMI</Label>
                  <Input
                    placeholder="1-23456-78-901"
                    value={editForm.inami_number}
                    onChange={(e) => setEditForm((f) => ({ ...f, inami_number: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Délai moyen RDV (jours)</Label>
                  <Input
                    type="number"
                    placeholder="7"
                    value={editForm.avg_appointment_delay_days}
                    onChange={(e) => setEditForm((f) => ({ ...f, avg_appointment_delay_days: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Lien de réservation externe</Label>
                <Input
                  type="url"
                  placeholder="https://www.doctolib.be/..."
                  value={editForm.external_booking_url}
                  onChange={(e) => setEditForm((f) => ({ ...f, external_booking_url: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">URL vers un outil de prise de RDV tiers (Doctolib, Calendly…)</p>
              </div>

              {/* Toggles */}
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full justify-between">
                    Options & accessibilité
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-3">
                  {([
                    { key: "accepts_new_patients", label: "Accepte nouveaux patients" },
                    { key: "conventioned", label: "Conventionné INAMI" },
                    { key: "tiers_payant", label: "Tiers payant" },
                    { key: "video_available", label: "Consultation vidéo" },
                    { key: "home_visit", label: "Visite à domicile" },
                    { key: "pmr_accessible", label: "Accessible PMR" },
                    { key: "parking", label: "Parking" },
                  ] as const).map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between">
                      <Label className="text-sm">{label}</Label>
                      <Switch
                        checked={editToggles[key]}
                        onCheckedChange={(v) => setEditToggles((t) => ({ ...t, [key]: v }))}
                      />
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>

              {/* Tags: Langues, Spécialités, Paiements, Associations */}
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full justify-between">
                    Langues, spécialités & paiements
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-3">
                  {/* Langues */}
                  <div className="space-y-2">
                    <Label className="text-sm">Langues</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {editLanguages.map((l, i) => (
                        <Badge key={i} variant="secondary" className="gap-1 text-xs">
                          {l}
                          <button type="button" onClick={() => setEditLanguages((arr) => arr.filter((_, j) => j !== i))} className="ml-0.5 hover:text-destructive">×</button>
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input placeholder="Ajouter une langue" value={newEditTag.language} onChange={(e) => setNewEditTag((t) => ({ ...t, language: e.target.value }))} className="h-8 text-xs" />
                      <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => { if (newEditTag.language.trim()) { setEditLanguages((arr) => [...arr, newEditTag.language.trim()]); setNewEditTag((t) => ({ ...t, language: "" })); } }}>+</Button>
                    </div>
                  </div>
                  {/* Spécialités */}
                  <div className="space-y-2">
                    <Label className="text-sm">Spécialités</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {editSpecialties.map((s, i) => (
                        <Badge key={i} variant="secondary" className="gap-1 text-xs">
                          {s}
                          <button type="button" onClick={() => setEditSpecialties((arr) => arr.filter((_, j) => j !== i))} className="ml-0.5 hover:text-destructive">×</button>
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input placeholder="Ajouter une spécialité" value={newEditTag.specialty} onChange={(e) => setNewEditTag((t) => ({ ...t, specialty: e.target.value }))} className="h-8 text-xs" />
                      <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => { if (newEditTag.specialty.trim()) { setEditSpecialties((arr) => [...arr, newEditTag.specialty.trim()]); setNewEditTag((t) => ({ ...t, specialty: "" })); } }}>+</Button>
                    </div>
                  </div>
                  {/* Paiements */}
                  <div className="space-y-2">
                    <Label className="text-sm">Modes de paiement</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {editPaymentMethods.map((m, i) => (
                        <Badge key={i} variant="secondary" className="gap-1 text-xs">
                          {m}
                          <button type="button" onClick={() => setEditPaymentMethods((arr) => arr.filter((_, j) => j !== i))} className="ml-0.5 hover:text-destructive">×</button>
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input placeholder="Ajouter un mode" value={newEditTag.payment} onChange={(e) => setNewEditTag((t) => ({ ...t, payment: e.target.value }))} className="h-8 text-xs" />
                      <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => { if (newEditTag.payment.trim()) { setEditPaymentMethods((arr) => [...arr, newEditTag.payment.trim()]); setNewEditTag((t) => ({ ...t, payment: "" })); } }}>+</Button>
                    </div>
                  </div>
                  {/* Associations */}
                  <div className="space-y-2">
                    <Label className="text-sm">Associations professionnelles</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {editAssociations.map((a, i) => (
                        <Badge key={i} variant="secondary" className="gap-1 text-xs">
                          {a}
                          <button type="button" onClick={() => setEditAssociations((arr) => arr.filter((_, j) => j !== i))} className="ml-0.5 hover:text-destructive">×</button>
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input placeholder="Ajouter une association" value={newEditTag.association} onChange={(e) => setNewEditTag((t) => ({ ...t, association: e.target.value }))} className="h-8 text-xs" />
                      <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => { if (newEditTag.association.trim()) { setEditAssociations((arr) => [...arr, newEditTag.association.trim()]); setNewEditTag((t) => ({ ...t, association: "" })); } }}>+</Button>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Réseaux sociaux */}
              <Collapsible open={showEditSocials} onOpenChange={setShowEditSocials}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full justify-between">
                    Réseaux sociaux & site web
                    {showEditSocials ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-3">
                  {SOCIAL_FIELDS.map(({ key, label, icon: Icon, placeholder }) => (
                    <div key={key} className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <Input
                        type="url"
                        placeholder={placeholder}
                        value={editForm.social_links[key as keyof typeof editForm.social_links]}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            social_links: { ...f.social_links, [key]: e.target.value },
                          }))
                        }
                      />
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>

              {/* Planning */}
              <div className="space-y-2">
                <Label>Planning hebdomadaire</Label>
                <ScheduleEditor schedule={editSchedule} onChange={setEditSchedule} />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <Button variant="outline" onClick={() => setEditOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={handleSaveEdit} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Sauvegarder
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            ) : practitioners.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">Aucun praticien enregistré.</p>
              </div>
            ) : (
              <div className="space-y-3">
              {filteredPractitioners.map((p: any, index: number) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-3">
                      {/* Order number + arrows */}
                      <div className="flex flex-col items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          disabled={index === 0}
                          onClick={() => movePractitioner(index, "up")}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <span className="text-xs font-bold text-muted-foreground tabular-nums w-6 text-center">{index + 1}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          disabled={index === practitioners.length - 1}
                          onClick={() => movePractitioner(index, "down")}
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-display font-bold text-primary text-sm overflow-hidden shrink-0">
                        {p.avatar_url ? (
                          <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span>{p.first_name?.[0]}{p.last_name?.[0]}</span>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">
                            {p.first_name} {p.last_name}
                          </p>
                          {p.roles.includes("admin") && (
                            <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                              Admin
                            </Badge>
                          )}
                          {isAccountPending(p) && (
                            <Badge className="bg-orange-50 text-orange-600 border-orange-200 text-[10px] gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Compte non activé
                            </Badge>
                          )}
                          {isPendingValidation(p) && (
                            <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] gap-1">
                              <ShieldCheck className="h-3 w-3" />
                              Validation requise
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {p.specialty || "Spécialité non renseignée"}
                        </p>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          {(p.contact_email) && (
                            <a href={`mailto:${p.contact_email}`} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {p.contact_email}
                            </a>
                          )}
                          {p.phone && (
                            <a href={`tel:${p.phone}`} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {p.phone}
                            </a>
                          )}
                          {!p.contact_email && !p.phone && (
                            <span className="text-xs text-muted-foreground/50 italic">Aucun contact renseigné</span>
                          )}
                        </div>
                      </div>
                      {/* Score bar */}
                      <div className="hidden md:flex flex-col items-center gap-1 min-w-[80px]">
                        <div className="flex items-center gap-1">
                          {(p.profile_score ?? 0) < 50 && <AlertCircle className="h-3 w-3 text-destructive" />}
                          <span className={`text-xs font-bold ${(p.profile_score ?? 0) < 40 ? 'text-destructive' : (p.profile_score ?? 0) < 70 ? 'text-orange-500' : 'text-emerald-600'}`}>
                            {p.profile_score ?? 0}%
                          </span>
                        </div>
                        <Progress
                          value={p.profile_score ?? 0}
                          className="h-1.5 w-16"
                          style={{
                            // @ts-ignore
                            '--progress-foreground': (p.profile_score ?? 0) < 40 ? 'var(--destructive)' : (p.profile_score ?? 0) < 70 ? '#f59e0b' : '#22c55e'
                          } as any}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Notify button */}
                      {(p.profile_score ?? 0) < 70 && !p.roles.includes("admin") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Envoyer une notification de complétion"
                          disabled={notifyingId === p.id}
                          onClick={() => notifyOnePractitioner(p)}
                          className="text-[#534AB7] hover:text-[#534AB7] hover:bg-[#534AB7]/10"
                        >
                          {notifyingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}
                        </Button>
                      )}
                      {isPendingValidation(p) && (
                        <Button
                          variant="default"
                          size="sm"
                          className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                          disabled={activatingId === p.id}
                          onClick={() => activateAccount(p)}
                        >
                          {activatingId === p.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ShieldCheck className="h-3.5 w-3.5" />
                          )}
                          Activer le compte
                        </Button>
                      )}
                      {!p.roles.includes("admin") && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs gap-1.5"
                          disabled={resendingId === p.id}
                          onClick={() => handleResendInvite(p)}
                          title="Renvoyer l'email d'accès"
                        >
                          {resendingId === p.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Mail className="h-3.5 w-3.5" />
                          )}
                          Renvoyer l'accès
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(p)}
                        title="Modifier le profil"
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1.5" />
                        Éditer
                      </Button>
                      <Badge
                        variant="secondary"
                        className={
                          p.is_active
                            ? "bg-green-50 text-green-700 border-green-200"
                            : isPendingValidation(p)
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-muted text-muted-foreground border-border"
                        }
                      >
                        {p.is_active ? "Visible en ligne" : isPendingValidation(p) ? "En attente" : "Masqué du site"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        title={p.is_active ? "Masquer du site public" : "Afficher sur le site public"}
                        onClick={() => toggleActive(p)}
                      >
                         {p.is_active ? (
                           <Ban className="h-4 w-4 text-muted-foreground" />
                         ) : (
                           <CheckCircle className="h-4 w-4 text-primary" />
                         )}
                       </Button>
                       {!p.roles.includes("admin") && (
                         <Button
                           variant="ghost"
                           size="sm"
                           title="Supprimer définitivement"
                           onClick={() => setDeletingPractitioner(p)}
                           className="text-destructive hover:text-destructive hover:bg-destructive/10"
                         >
                           <Trash2 className="h-4 w-4" />
                         </Button>
                       )}
                     </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delete confirmation dialog */}
        <AlertDialog open={!!deletingPractitioner} onOpenChange={(v) => { if (!v) setDeletingPractitioner(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer définitivement ce praticien ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action est irréversible. Le profil de{" "}
                <strong>{deletingPractitioner?.first_name} {deletingPractitioner?.last_name}</strong>,
                ses réservations, ses activités et son compte utilisateur seront définitivement supprimés.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeletePractitioner}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Supprimer définitivement
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default AdminPractitioners;
