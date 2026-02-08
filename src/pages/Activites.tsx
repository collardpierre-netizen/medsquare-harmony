import { useEffect, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar, Clock, MapPin, Users, ChevronRight, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

const CATEGORIES = [
  { value: "all", label: "Toutes" },
  { value: "yoga", label: "Yoga" },
  { value: "pilates", label: "Pilates" },
  { value: "meditation", label: "Méditation" },
  { value: "fitness", label: "Fitness" },
  { value: "danse", label: "Danse" },
  { value: "sophrologie", label: "Sophrologie" },
  { value: "nutrition", label: "Nutrition" },
  { value: "autre", label: "Autre" },
];

const CATEGORY_COLORS: Record<string, string> = {
  yoga: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pilates: "bg-blue-50 text-blue-700 border-blue-200",
  meditation: "bg-purple-50 text-purple-700 border-purple-200",
  fitness: "bg-orange-50 text-orange-700 border-orange-200",
  danse: "bg-pink-50 text-pink-700 border-pink-200",
  sophrologie: "bg-teal-50 text-teal-700 border-teal-200",
  nutrition: "bg-yellow-50 text-yellow-700 border-yellow-200",
  autre: "bg-gray-50 text-gray-700 border-gray-200",
};

const ActivitesPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activities, setActivities] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [myRegistrations, setMyRegistrations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch active activities with practitioner info
      const { data: acts } = await supabase
        .from("activities")
        .select("*, profiles(first_name, last_name, specialty, avatar_url)")
        .eq("is_active", true)
        .order("title");

      setActivities(acts || []);

      // Fetch upcoming sessions
      const { data: sess } = await supabase
        .from("activity_sessions")
        .select("*, rooms(name), activity_registrations(id, user_id)")
        .gte("start_time", new Date().toISOString())
        .eq("status", "scheduled")
        .order("start_time");

      setSessions(sess || []);

      // Fetch current user's registrations
      if (user) {
        const { data: regs } = await supabase
          .from("activity_registrations")
          .select("session_id")
          .eq("user_id", user.id);
        setMyRegistrations((regs || []).map((r: any) => r.session_id));
      }

      setLoading(false);
    };

    fetchData();
  }, [user]);

  const handleRegister = async () => {
    if (!user || !selectedSession) return;
    setIsRegistering(true);

    const { error } = await supabase.from("activity_registrations").insert({
      session_id: selectedSession.id,
      user_id: user.id,
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message.includes("unique")
          ? "Vous êtes déjà inscrit à cette séance."
          : "Impossible de vous inscrire.",
      });
    } else {
      toast({ title: "Inscription confirmée ! 🎉", description: "Vous recevrez un rappel avant la séance." });
      setMyRegistrations([...myRegistrations, selectedSession.id]);
    }

    setIsRegistering(false);
    setShowConfirmDialog(false);
    setSelectedSession(null);
  };

  const handleUnregister = async (sessionId: string) => {
    if (!user) return;
    await supabase
      .from("activity_registrations")
      .delete()
      .eq("session_id", sessionId)
      .eq("user_id", user.id);
    setMyRegistrations(myRegistrations.filter((id) => id !== sessionId));
    toast({ title: "Inscription annulée" });
  };

  // Filter activities
  const filtered = activities.filter((a: any) => {
    if (selectedCategory !== "all" && a.category !== selectedCategory) return false;
    if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Group sessions by activity
  const getSessionsForActivity = (activityId: string) =>
    sessions.filter((s: any) => s.activity_id === activityId);

  return (
    <Layout>
      {/* Hero */}
      <section className="bg-gradient-to-b from-accent/50 to-background py-16">
        <div className="max-w-6xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-2xl mx-auto"
          >
            <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-4">
              Activités & Cours
            </h1>
            <p className="text-muted-foreground text-lg">
              Yoga, Pilates, Méditation… Découvrez nos activités bien-être et inscrivez-vous en quelques clics.
            </p>
          </motion.div>

          {/* Filters */}
          <div className="mt-8 flex flex-col sm:flex-row items-center gap-3 max-w-xl mx-auto">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher une activité..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* Activities list */}
      <section className="py-12">
        <div className="max-w-6xl mx-auto px-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <Calendar className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
              <h3 className="font-display text-xl font-semibold mb-2">Aucune activité trouvée</h3>
              <p className="text-muted-foreground">Essayez de modifier vos filtres de recherche.</p>
            </div>
          ) : (
            <div className="grid gap-6">
              {filtered.map((activity: any, index: number) => {
                const actSessions = getSessionsForActivity(activity.id);

                return (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="overflow-hidden hover:shadow-md transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex flex-col md:flex-row gap-6">
                          {/* Activity info */}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge
                                variant="secondary"
                                className={CATEGORY_COLORS[activity.category] || CATEGORY_COLORS.autre}
                              >
                                {CATEGORIES.find((c) => c.value === activity.category)?.label || activity.category}
                              </Badge>
                            </div>
                            <h3 className="font-display text-xl font-bold mb-1">
                              {activity.title}
                            </h3>
                            <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
                              {activity.description || "Découvrez cette activité proposée par notre praticien."}
                            </p>
                            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" />
                                {activity.duration_minutes} min
                              </span>
                              <span className="flex items-center gap-1">
                                <Users className="h-3.5 w-3.5" />
                                {activity.max_participants} places
                              </span>
                              {activity.profiles && (
                                <span className="flex items-center gap-1">
                                  Par {activity.profiles.first_name} {activity.profiles.last_name}
                                  {activity.profiles.specialty && (
                                    <span className="text-primary/70"> · {activity.profiles.specialty}</span>
                                  )}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Sessions */}
                          <div className="md:w-80 md:border-l md:pl-6 border-border">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                              Prochaines séances
                            </p>
                            {actSessions.length === 0 ? (
                              <p className="text-xs text-muted-foreground">
                                Aucune séance programmée pour le moment.
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {actSessions.slice(0, 3).map((session: any) => {
                                  const registered = myRegistrations.includes(session.id);
                                  const registrationCount = session.activity_registrations?.length || 0;
                                  const isFull = registrationCount >= (session.max_participants || 10);

                                  return (
                                    <div
                                      key={session.id}
                                      className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 border border-border/50"
                                    >
                                      <div>
                                        <p className="text-sm font-medium">
                                          {format(new Date(session.start_time), "EEE d MMM", { locale: fr })}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {format(new Date(session.start_time), "HH:mm")} — {format(new Date(session.end_time), "HH:mm")}
                                          {session.rooms?.name && ` · ${session.rooms.name}`}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">
                                          {registrationCount}/{session.max_participants || "∞"} inscrits
                                        </p>
                                      </div>
                                      {registered ? (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="text-xs"
                                          onClick={() => handleUnregister(session.id)}
                                        >
                                          Annuler
                                        </Button>
                                      ) : (
                                        <Button
                                          size="sm"
                                          className="text-xs"
                                          disabled={isFull || !user}
                                          onClick={() => {
                                            setSelectedSession({ ...session, activity });
                                            setShowConfirmDialog(true);
                                          }}
                                        >
                                          {isFull ? "Complet" : "S'inscrire"}
                                        </Button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Confirm registration dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Confirmer l'inscription</DialogTitle>
          </DialogHeader>
          {selectedSession && (
            <div className="space-y-3 py-2">
              <div className="p-3 rounded-lg bg-accent">
                <p className="font-semibold">{selectedSession.activity?.title}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {format(new Date(selectedSession.start_time), "EEEE d MMMM yyyy", { locale: fr })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(selectedSession.start_time), "HH:mm")} — {format(new Date(selectedSession.end_time), "HH:mm")}
                </p>
                {selectedSession.rooms?.name && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {selectedSession.rooms.name}
                  </p>
                )}
              </div>
              {!user && (
                <p className="text-sm text-destructive">
                  Vous devez être connecté pour vous inscrire.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleRegister} disabled={isRegistering || !user}>
              {isRegistering ? "Inscription..." : "Confirmer l'inscription"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default ActivitesPage;
