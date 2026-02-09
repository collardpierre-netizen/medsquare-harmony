import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Save, User } from "lucide-react";
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
  });

  const [schedule, setSchedule] = useState<DaySchedule[]>([]);

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
        schedule: schedule as any,
      })
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
    <DashboardLayout>
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

              <Button type="submit" disabled={isLoading}>
                <Save className="h-4 w-4 mr-2" />
                {isLoading ? "Sauvegarde..." : "Sauvegarder"}
              </Button>
            </form>
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
    </DashboardLayout>
  );
};

export default Profile;
