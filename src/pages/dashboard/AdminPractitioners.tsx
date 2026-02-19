import { useEffect, useState } from "react";
import { Users, Ban, CheckCircle, Plus, Loader2, Mail, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
import ScheduleEditor, { DaySchedule } from "@/components/dashboard/profile/ScheduleEditor";

const DEFAULT_SCHEDULE: DaySchedule[] = [];

const AdminPractitioners = () => {
  const { toast } = useToast();
  const [practitioners, setPractitioners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [schedule, setSchedule] = useState<DaySchedule[]>(DEFAULT_SCHEDULE);
  const [form, setForm] = useState({
    email: "",
    first_name: "",
    last_name: "",
    specialty: "",
    bio: "",
    phone: "",
    contact_email: "",
  });

  const fetchPractitioners = async () => {
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").order("last_name"),
      supabase.from("user_roles").select("user_id, role"),
    ]);

    const rolesMap = new Map<string, string[]>();
    (roles || []).forEach((r: any) => {
      const existing = rolesMap.get(r.user_id) || [];
      existing.push(r.role);
      rolesMap.set(r.user_id, existing);
    });

    const merged = (profiles || []).map((p: any) => ({
      ...p,
      roles: rolesMap.get(p.user_id) || [],
    }));

    setPractitioners(merged);
    setLoading(false);
  };

  useEffect(() => {
    fetchPractitioners();
  }, []);

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

  const resetForm = () => {
    setForm({ email: "", first_name: "", last_name: "", specialty: "", bio: "", phone: "", contact_email: "" });
    setSchedule(DEFAULT_SCHEDULE);
    setShowAdvanced(false);
  };

  const handleInvite = async () => {
    if (!form.email) {
      toast({ title: "L'email est requis", variant: "destructive" });
      return;
    }
    setInviting(true);
    try {
      const res = await supabase.functions.invoke("invite-practitioner", {
        body: {
          email: form.email,
          first_name: form.first_name,
          last_name: form.last_name,
          specialty: form.specialty,
          bio: form.bio,
          phone: form.phone,
          contact_email: form.contact_email || form.email,
          schedule: schedule.length > 0 ? schedule : null,
        },
      });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);
      toast({ title: "Invitation envoyée !", description: `Un email a été envoyé à ${form.email}` });
      resetForm();
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

  const isAccountPending = (p: any) => {
    return p.created_at === p.updated_at && !p.contact_email && !p.specialty;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-bold">Gestion des praticiens</h2>
            <p className="text-muted-foreground text-sm mt-0.5">
              Gérez les profils et les accès des praticiens.
            </p>
          </div>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
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

                {/* Required */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="invite-email">Email *</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="praticien@exemple.com"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="invite-first">Prénom</Label>
                      <Input
                        id="invite-first"
                        placeholder="Jean"
                        value={form.first_name}
                        onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="invite-last">Nom</Label>
                      <Input
                        id="invite-last"
                        placeholder="Dupont"
                        value={form.last_name}
                        onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Advanced / optional */}
                <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full justify-between">
                      Informations complémentaires (facultatif)
                      {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="invite-specialty">Spécialité</Label>
                      <Input
                        id="invite-specialty"
                        placeholder="Ostéopathe, Kinésithérapeute…"
                        value={form.specialty}
                        onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="invite-bio">Bio / Présentation</Label>
                      <Textarea
                        id="invite-bio"
                        placeholder="Présentation affichée sur la fiche publique du praticien…"
                        rows={3}
                        value={form.bio}
                        onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="invite-phone">Téléphone</Label>
                        <Input
                          id="invite-phone"
                          placeholder="+32 470 000 000"
                          value={form.phone}
                          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="invite-contact-email">Email de contact public</Label>
                        <Input
                          id="invite-contact-email"
                          type="email"
                          placeholder="contact@praticien.be"
                          value={form.contact_email}
                          onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Planning hebdomadaire</Label>
                      <p className="text-xs text-muted-foreground">
                        Définissez les jours et horaires de présence par défaut du praticien.
                      </p>
                      <ScheduleEditor schedule={schedule} onChange={setSchedule} />
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Button onClick={handleInvite} disabled={inviting} className="w-full">
                  {inviting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Mail className="h-4 w-4 mr-2" />
                  )}
                  Envoyer l'invitation
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

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
                {practitioners.map((p: any) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-display font-bold text-primary text-sm">
                        {p.first_name?.[0]}{p.last_name?.[0]}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">
                            {p.first_name} {p.last_name}
                          </p>
                          {p.roles.includes("admin") && (
                            <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                              Admin
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {p.specialty || "Spécialité non renseignée"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isAccountPending(p) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs gap-1.5"
                          disabled={resendingId === p.id}
                          onClick={() => handleResendInvite(p)}
                        >
                          {resendingId === p.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5" />
                          )}
                          Renvoyer
                        </Button>
                      )}
                      <Badge
                        variant="secondary"
                        className={
                          p.is_active
                            ? "bg-green-50 text-green-700 border-green-200"
                            : "bg-muted text-muted-foreground border-border"
                        }
                      >
                        {p.is_active ? "Visible en ligne" : "Masqué du site"}
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
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminPractitioners;
