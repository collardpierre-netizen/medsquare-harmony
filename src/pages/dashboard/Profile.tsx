import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import SmartDashboardLayout from "@/components/dashboard/SmartDashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Save, User, Mail, BellRing, Coffee, Globe, Facebook, Instagram, Linkedin, Twitter, Youtube,
  Stethoscope, Languages, CreditCard, Accessibility, ParkingCircle, Video, Home, UserCheck, Clock, X, Plus, Award,
  Briefcase, GraduationCap, Trash2,
} from "lucide-react";
import ScheduleEditor, { type DaySchedule } from "@/components/dashboard/profile/ScheduleEditor";
import ImageUpload from "@/components/dashboard/ImageUpload";

const Profile = () => {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const [form, setForm] = useState({
    first_name: profile?.first_name || "",
    last_name: profile?.last_name || "",
    specialty: profile?.specialty || "",
    bio: profile?.bio || "",
    phone: profile?.phone || "",
    contact_email: (profile as any)?.contact_email || "",
    break_minutes: (profile as any)?.break_minutes ?? 15,
    inami_number: (profile as any)?.inami_number || "",
    avg_appointment_delay_days: (profile as any)?.avg_appointment_delay_days ?? "",
  });

  const [toggles, setToggles] = useState({
    accepts_new_patients: true,
    conventioned: false,
    tiers_payant: false,
    video_available: false,
    home_visit: false,
    pmr_accessible: false,
    parking: false,
  });

  const [languages, setLanguages] = useState<string[]>(["français"]);
  const [newLanguage, setNewLanguage] = useState("");
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [newSpecialty, setNewSpecialty] = useState("");
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [newPayment, setNewPayment] = useState("");
  const [associations, setAssociations] = useState<string[]>([]);
  const [newAssociation, setNewAssociation] = useState("");

  const [socialLinks, setSocialLinks] = useState({
    website: "", facebook: "", instagram: "", linkedin: "", twitter: "", youtube: "",
  });

  const [schedule, setSchedule] = useState<DaySchedule[]>([]);
  const [notifPrefs, setNotifPrefs] = useState({
    bookings: true, activities: true, registrations: true,
  });

  useEffect(() => {
    if (profile) {
      const p = profile as any;
      const prefs = p?.notification_preferences;
      if (prefs && typeof prefs === "object") {
        setNotifPrefs({
          bookings: prefs.bookings !== false,
          activities: prefs.activities !== false,
          registrations: prefs.registrations !== false,
        });
      }
    }
  }, [profile]);

  useEffect(() => {
    if (profile?.schedule) {
      try {
        const parsed = typeof profile.schedule === "string" ? JSON.parse(profile.schedule) : profile.schedule;
        if (Array.isArray(parsed)) setSchedule(parsed);
      } catch { setSchedule([]); }
    }
  }, [profile]);

  useEffect(() => {
    if (profile) {
      const p = profile as any;
      setForm({
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        specialty: profile.specialty || "",
        bio: profile.bio || "",
        phone: profile.phone || "",
        contact_email: p?.contact_email || "",
        break_minutes: p?.break_minutes ?? 15,
        inami_number: p?.inami_number || "",
        avg_appointment_delay_days: p?.avg_appointment_delay_days ?? "",
      });
      setToggles({
        accepts_new_patients: p?.accepts_new_patients ?? true,
        conventioned: p?.conventioned ?? false,
        tiers_payant: p?.tiers_payant ?? false,
        video_available: p?.video_available ?? false,
        home_visit: p?.home_visit ?? false,
        pmr_accessible: p?.pmr_accessible ?? false,
        parking: p?.parking ?? false,
      });
      setLanguages(p?.languages?.length ? p.languages : ["français"]);
      setSpecialties(p?.specialties || []);
      setPaymentMethods(p?.payment_methods || []);
      setAssociations(p?.associations || []);
      const sl = p?.social_links || {};
      setSocialLinks({
        website: sl.website || "", facebook: sl.facebook || "", instagram: sl.instagram || "",
        linkedin: sl.linkedin || "", twitter: sl.twitter || "", youtube: sl.youtube || "",
      });
    }
  }, [profile]);

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!profile) return;
    setIsLoading(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: form.first_name,
        last_name: form.last_name,
        specialty: form.specialty,
        bio: form.bio,
        phone: form.phone,
        contact_email: form.contact_email || null,
        break_minutes: form.break_minutes,
        inami_number: form.inami_number || null,
        avg_appointment_delay_days: form.avg_appointment_delay_days ? parseInt(String(form.avg_appointment_delay_days)) : null,
        accepts_new_patients: toggles.accepts_new_patients,
        conventioned: toggles.conventioned,
        tiers_payant: toggles.tiers_payant,
        video_available: toggles.video_available,
        home_visit: toggles.home_visit,
        pmr_accessible: toggles.pmr_accessible,
        parking: toggles.parking,
        languages: languages,
        specialties: specialties,
        payment_methods: paymentMethods,
        associations: associations,
        schedule: schedule as any,
        notification_preferences: notifPrefs as any,
        social_links: socialLinks as any,
      } as any)
      .eq("id", profile.id);

    if (error) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de sauvegarder le profil." });
    } else {
      await refreshProfile();
      toast({ title: "Profil sauvegardé", description: "Vos modifications sont visibles sur le site." });
    }
    setIsLoading(false);
  };

  const handleAvatarUpload = async (url: string) => {
    if (!profile) return;
    await supabase.from("profiles").update({ avatar_url: url }).eq("id", profile.id);
    await refreshProfile();
    toast({ title: "Photo de profil mise à jour" });
  };

  const handleAvatarRemove = async () => {
    if (!profile) return;
    await supabase.from("profiles").update({ avatar_url: "" }).eq("id", profile.id);
    await refreshProfile();
  };

  const addTag = (list: string[], setList: (v: string[]) => void, value: string, setInput: (v: string) => void) => {
    const trimmed = value.trim();
    if (trimmed && !list.includes(trimmed)) {
      setList([...list, trimmed]);
    }
    setInput("");
  };

  const removeTag = (list: string[], setList: (v: string[]) => void, index: number) => {
    setList(list.filter((_, i) => i !== index));
  };

  const TagInput = ({
    label, icon: Icon, list, setList, inputValue, setInputValue, placeholder,
  }: {
    label: string; icon: React.ElementType; list: string[]; setList: (v: string[]) => void;
    inputValue: string; setInputValue: (v: string) => void; placeholder: string;
  }) => (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <Label className="font-medium">{label}</Label>
      </div>
      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
        {list.map((item, i) => (
          <Badge key={i} variant="secondary" className="gap-1 text-xs">
            {item}
            <button type="button" onClick={() => removeTag(list, setList, i)} className="ml-0.5 hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={placeholder}
          className="flex-1"
          maxLength={50}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag(list, setList, inputValue, setInputValue);
            }
          }}
        />
        <Button
          type="button" variant="outline" size="sm"
          onClick={() => addTag(list, setList, inputValue, setInputValue)}
          disabled={!inputValue.trim()}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <SmartDashboardLayout>
      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <User className="h-5 w-5" />
              Mon profil public
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-5">
              {/* Avatar upload */}
              <div className="flex items-center gap-5">
                <ImageUpload
                  bucket="avatars"
                  folder={profile?.user_id || "unknown"}
                  currentUrl={profile?.avatar_url || null}
                  onUpload={handleAvatarUpload}
                  onRemove={handleAvatarRemove}
                  shape="circle"
                  className="h-24 w-24"
                  placeholder={
                    <div className="h-24 w-24 flex items-center justify-center">
                      <User className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                  }
                />
                <div>
                  <p className="text-sm font-medium">Photo de profil</p>
                  <p className="text-xs text-muted-foreground mt-0.5">JPG, PNG ou WebP · max 5 Mo</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name">Prénom</Label>
                  <Input id="first_name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="mt-1.5" required />
                </div>
                <div>
                  <Label htmlFor="last_name">Nom</Label>
                  <Input id="last_name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="mt-1.5" required />
                </div>
              </div>

              <div>
                <Label htmlFor="specialty">Spécialité principale</Label>
                <Input id="specialty" value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} placeholder="Ex: Médecine générale, Kinésithérapie..." className="mt-1.5" />
              </div>

              <div>
                <Label htmlFor="phone">Téléphone</Label>
                <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+32 ..." className="mt-1.5" />
              </div>

              {/* INAMI & Conventionné */}
              <div className="rounded-lg border border-border bg-accent/30 p-4 space-y-4">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-primary" />
                  Informations INAMI
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="inami_number">N° INAMI</Label>
                    <Input id="inami_number" value={form.inami_number} onChange={(e) => setForm({ ...form, inami_number: e.target.value })} placeholder="X-XXXXX-XX-XXX" className="mt-1.5" maxLength={20} />
                  </div>
                  <div>
                    <Label htmlFor="avg_delay">Délai moyen RDV (jours)</Label>
                    <Input id="avg_delay" type="number" min={0} max={365} value={form.avg_appointment_delay_days} onChange={(e) => setForm({ ...form, avg_appointment_delay_days: e.target.value })} placeholder="Ex: 7" className="mt-1.5" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Conventionné(e)</p>
                    <p className="text-xs text-muted-foreground">Appliquez-vous les tarifs conventionnés ?</p>
                  </div>
                  <Switch checked={toggles.conventioned} onCheckedChange={(v) => setToggles({ ...toggles, conventioned: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Tiers payant</p>
                    <p className="text-xs text-muted-foreground">Le patient ne paie que le ticket modérateur</p>
                  </div>
                  <Switch checked={toggles.tiers_payant} onCheckedChange={(v) => setToggles({ ...toggles, tiers_payant: v })} />
                </div>
              </div>

              {/* Availability & Services */}
              <div className="rounded-lg border border-border bg-accent/30 p-4 space-y-4">
                <p className="text-sm font-medium flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-primary" />
                  Disponibilité & services
                </p>
                {([
                  { key: "accepts_new_patients" as const, icon: UserCheck, label: "Accepte de nouveaux patients", desc: "Affiché publiquement sur votre fiche" },
                  { key: "video_available" as const, icon: Video, label: "Consultation vidéo", desc: "Proposez-vous des consultations à distance ?" },
                  { key: "home_visit" as const, icon: Home, label: "Visite à domicile", desc: "Proposez-vous des visites à domicile ?" },
                  { key: "pmr_accessible" as const, icon: Accessibility, label: "Accessibilité PMR", desc: "Votre cabinet est-il accessible aux personnes à mobilité réduite ?" },
                  { key: "parking" as const, icon: ParkingCircle, label: "Parking disponible", desc: "Y a-t-il un parking à proximité ?" },
                ] as const).map(({ key, icon: Icon, label, desc }) => (
                  <div key={key} className="flex items-center justify-between">
                    <div className="flex items-start gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                    </div>
                    <Switch checked={toggles[key]} onCheckedChange={(v) => setToggles({ ...toggles, [key]: v })} />
                  </div>
                ))}
              </div>

              {/* Tags sections */}
              <div className="rounded-lg border border-border bg-accent/30 p-4 space-y-5">
                <TagInput label="Langues parlées" icon={Languages} list={languages} setList={setLanguages} inputValue={newLanguage} setInputValue={setNewLanguage} placeholder="Ajouter une langue..." />
                <TagInput label="Spécialités / Compétences" icon={Award} list={specialties} setList={setSpecialties} inputValue={newSpecialty} setInputValue={setNewSpecialty} placeholder="Ajouter une spécialité..." />
                <TagInput label="Moyens de paiement" icon={CreditCard} list={paymentMethods} setList={setPaymentMethods} inputValue={newPayment} setInputValue={setNewPayment} placeholder="Ex: Bancontact, Espèces..." />
                <TagInput label="Associations professionnelles" icon={Award} list={associations} setList={setAssociations} inputValue={newAssociation} setInputValue={setNewAssociation} placeholder="Ex: Ordre des médecins..." />
              </div>

              {/* Break minutes */}
              <div className="rounded-lg border border-border bg-accent/30 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Coffee className="h-4 w-4 text-primary" />
                  <Label htmlFor="break_minutes" className="font-medium">Pause entre RDV (minutes)</Label>
                </div>
                <p className="text-xs text-muted-foreground">Temps de battement entre deux rendez-vous pour vous préparer.</p>
                <Input id="break_minutes" type="number" min={0} max={60} value={form.break_minutes} onChange={(e) => setForm({ ...form, break_minutes: parseInt(e.target.value) || 0 })} className="mt-1 w-32" />
              </div>

              {/* Contact email */}
              <div className="rounded-lg border border-border bg-accent/30 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  <Label htmlFor="contact_email" className="font-medium">Email de notification</Label>
                </div>
                <p className="text-xs text-muted-foreground">Les inscriptions à vos activités seront envoyées à cette adresse.</p>
                <Input id="contact_email" type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} placeholder="mon-email@exemple.com" className="mt-1" maxLength={255} />
              </div>

              <div>
                <Label htmlFor="bio">Biographie</Label>
                <Textarea id="bio" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="Présentez-vous en quelques lignes..." rows={5} className="mt-1.5" />
              </div>

              {/* Social links */}
              <div className="rounded-lg border border-border bg-accent/30 p-4 space-y-3">
                <p className="text-sm font-medium">Réseaux sociaux & site web</p>
                <p className="text-xs text-muted-foreground">Ces liens apparaîtront sur votre fiche publique.</p>
                {[
                  { key: "website", label: "Site web", icon: Globe, placeholder: "https://mon-site.be" },
                  { key: "facebook", label: "Facebook", icon: Facebook, placeholder: "https://facebook.com/..." },
                  { key: "instagram", label: "Instagram", icon: Instagram, placeholder: "https://instagram.com/..." },
                  { key: "linkedin", label: "LinkedIn", icon: Linkedin, placeholder: "https://linkedin.com/in/..." },
                  { key: "twitter", label: "Twitter / X", icon: Twitter, placeholder: "https://twitter.com/..." },
                  { key: "youtube", label: "YouTube", icon: Youtube, placeholder: "https://youtube.com/@..." },
                ].map(({ key, icon: Icon, placeholder }) => (
                  <div key={key} className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Input type="url" placeholder={placeholder} value={socialLinks[key as keyof typeof socialLinks]} onChange={(e) => setSocialLinks((prev) => ({ ...prev, [key]: e.target.value }))} />
                  </div>
                ))}
              </div>

              <Button type="submit" disabled={isLoading}>
                <Save className="h-4 w-4 mr-2" />
                {isLoading ? "Sauvegarde..." : "Sauvegarder"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Notification preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2 text-base">
              <BellRing className="h-5 w-5" />
              Préférences de notification
            </CardTitle>
            <CardDescription className="text-xs">Choisissez les types de notifications que vous souhaitez recevoir.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { key: "bookings" as const, label: "Réservations", desc: "Nouvelles réservations, confirmations et refus" },
              { key: "activities" as const, label: "Séances d'activité", desc: "Nouvelles séances planifiées pour vos activités" },
              { key: "registrations" as const, label: "Inscriptions", desc: "Inscriptions et annulations de participants" },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                <Switch checked={notifPrefs[key]} onCheckedChange={(checked) => setNotifPrefs((prev) => ({ ...prev, [key]: checked }))} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Schedule editor */}
        <ScheduleEditor schedule={schedule} onChange={setSchedule} />
        <div className="flex justify-end">
          <Button onClick={() => handleSave()} disabled={isLoading}>
            <Save className="h-4 w-4 mr-2" />
            {isLoading ? "Sauvegarde..." : "Sauvegarder tout"}
          </Button>
        </div>
      </div>
    </SmartDashboardLayout>
  );
};

export default Profile;
