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
import { useToast } from "@/hooks/use-toast";
import { Save, User, Mail, BellRing, Coffee, Globe, Facebook, Instagram, Linkedin, Twitter, Youtube } from "lucide-react";
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
  });

  const [socialLinks, setSocialLinks] = useState({
    website: "",
    facebook: "",
    instagram: "",
    linkedin: "",
    twitter: "",
    youtube: "",
  });

  const [schedule, setSchedule] = useState<DaySchedule[]>([]);
  const [notifPrefs, setNotifPrefs] = useState({
    bookings: true,
    activities: true,
    registrations: true,
  });

  // Load notification preferences from profile
  useEffect(() => {
    if (profile) {
      const prefs = (profile as any)?.notification_preferences;
      if (prefs && typeof prefs === "object") {
        setNotifPrefs({
          bookings: prefs.bookings !== false,
          activities: prefs.activities !== false,
          registrations: prefs.registrations !== false,
        });
      }
    }
  }, [profile]);

  // Load schedule from profile
  useEffect(() => {
    if (profile?.schedule) {
      try {
        const parsed = typeof profile.schedule === "string"
          ? JSON.parse(profile.schedule)
          : profile.schedule;
        if (Array.isArray(parsed)) {
          setSchedule(parsed);
        }
      } catch {
        setSchedule([]);
      }
    }
  }, [profile]);

  // Sync form with profile when profile loads
  useEffect(() => {
    if (profile) {
      setForm({
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        specialty: profile.specialty || "",
        bio: profile.bio || "",
        phone: profile.phone || "",
        contact_email: (profile as any)?.contact_email || "",
        break_minutes: (profile as any)?.break_minutes ?? 15,
      });
      const sl = (profile as any)?.social_links || {};
      setSocialLinks({
        website: sl.website || "",
        facebook: sl.facebook || "",
        instagram: sl.instagram || "",
        linkedin: sl.linkedin || "",
        twitter: sl.twitter || "",
        youtube: sl.youtube || "",
      });
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
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
        schedule: schedule as any,
        notification_preferences: notifPrefs as any,
        social_links: socialLinks as any,
      } as any)
      .eq("id", profile.id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de sauvegarder le profil.",
      });
    } else {
      await refreshProfile();
      toast({
        title: "Profil sauvegardé",
        description: "Vos modifications sont visibles sur le site.",
      });
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
                  <p className="text-xs text-muted-foreground mt-0.5">
                    JPG, PNG ou WebP · max 5 Mo
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name">Prénom</Label>
                  <Input
                    id="first_name"
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    className="mt-1.5"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="last_name">Nom</Label>
                  <Input
                    id="last_name"
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    className="mt-1.5"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="specialty">Spécialité</Label>
                <Input
                  id="specialty"
                  value={form.specialty}
                  onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                  placeholder="Ex: Médecine générale, Kinésithérapie..."
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="phone">Téléphone</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+32 ..."
                  className="mt-1.5"
                />
               </div>

              {/* Break minutes */}
              <div className="rounded-lg border border-border bg-accent/30 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Coffee className="h-4 w-4 text-primary" />
                  <Label htmlFor="break_minutes" className="font-medium">Pause entre RDV (minutes)</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Temps de battement entre deux rendez-vous pour vous préparer.
                </p>
                <Input
                  id="break_minutes"
                  type="number"
                  min={0}
                  max={60}
                  value={form.break_minutes}
                  onChange={(e) => setForm({ ...form, break_minutes: parseInt(e.target.value) || 0 })}
                  className="mt-1 w-32"
                />
              </div>


              <div className="rounded-lg border border-border bg-accent/30 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  <Label htmlFor="contact_email" className="font-medium">Email de notification</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Les inscriptions à vos activités seront envoyées à cette adresse. 
                  Laissez vide pour gérer les inscriptions uniquement via le dashboard.
                </p>
                <Input
                  id="contact_email"
                  type="email"
                  value={form.contact_email}
                  onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                  placeholder="mon-email@exemple.com"
                  className="mt-1"
                  maxLength={255}
                />
              </div>

              <div>
                <Label htmlFor="bio">Biographie</Label>
                <Textarea
                  id="bio"
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  placeholder="Présentez-vous en quelques lignes..."
                  rows={5}
                  className="mt-1.5"
                />
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
                ].map(({ key, label, icon: Icon, placeholder }) => (
                  <div key={key} className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1">
                      <Input
                        type="url"
                        placeholder={placeholder}
                        value={socialLinks[key as keyof typeof socialLinks]}
                        onChange={(e) => setSocialLinks((prev) => ({ ...prev, [key]: e.target.value }))}
                      />
                    </div>
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
            <CardDescription className="text-xs">
              Choisissez les types de notifications que vous souhaitez recevoir.
            </CardDescription>
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
                <Switch
                  checked={notifPrefs[key]}
                  onCheckedChange={(checked) =>
                    setNotifPrefs((prev) => ({ ...prev, [key]: checked }))
                  }
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Schedule editor */}
        <ScheduleEditor schedule={schedule} onChange={setSchedule} />
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isLoading}>
            <Save className="h-4 w-4 mr-2" />
            {isLoading ? "Sauvegarde..." : "Sauvegarder tout"}
          </Button>
        </div>
      </div>
    </SmartDashboardLayout>
  );
};

export default Profile;
