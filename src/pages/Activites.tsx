import { useEffect, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar, Search, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import ActivityCard from "@/components/activities/ActivityCard";
import CategoryPills from "@/components/activities/CategoryPills";

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
      const { data: acts } = await supabase
        .from("activities")
        .select("*, profiles(id, first_name, last_name, specialty, avatar_url)")
        .eq("is_active", true)
        .order("title");

      setActivities(acts || []);

      const { data: sess } = await supabase
        .from("activity_sessions")
        .select("*, rooms(name), activity_registrations(id, user_id)")
        .gte("start_time", new Date().toISOString())
        .eq("status", "scheduled")
        .order("start_time");

      setSessions(sess || []);

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

  const filtered = activities.filter((a: any) => {
    if (selectedCategory !== "all" && a.category !== selectedCategory) return false;
    if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const getNextSession = (activityId: string) =>
    sessions.find((s: any) => s.activity_id === activityId) || null;

  const getSessionsForActivity = (activityId: string) =>
    sessions.filter((s: any) => s.activity_id === activityId);

  return (
    <Layout>
      {/* Hero */}
      <section className="pt-12 pb-6">
        <div className="max-w-6xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl"
          >
            <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-2">
              Activités & Cours
            </h1>
            <p className="text-muted-foreground">
              Yoga, Pilates, Méditation… Découvrez nos activités bien-être et inscrivez-vous en quelques clics.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Search + Category pills */}
      <section className="border-b border-border sticky top-[72px] z-30 bg-background/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 space-y-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-10"
            />
          </div>
          <CategoryPills
            categories={CATEGORIES}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
          />
        </div>
      </section>

      {/* Grid */}
      <section className="py-8">
        <div className="max-w-6xl mx-auto px-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <Calendar className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
              <h3 className="font-display text-lg font-semibold mb-1">Aucune activité trouvée</h3>
              <p className="text-muted-foreground text-sm">Essayez de modifier vos filtres.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filtered.map((activity: any, index: number) => {
                const nextSession = getNextSession(activity.id);
                const actSessions = getSessionsForActivity(activity.id);

                return (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    <div className="space-y-3">
                      <ActivityCard
                        activity={activity}
                        nextSession={nextSession}
                      />

                      {/* Upcoming sessions under card */}
                      {actSessions.length > 0 && (
                        <div className="space-y-1.5 pl-1">
                          {actSessions.slice(0, 2).map((session: any) => {
                            const registered = myRegistrations.includes(session.id);
                            const registrationCount = session.activity_registrations?.length || 0;
                            const isFull = registrationCount >= (session.max_participants || 10);

                            return (
                              <div
                                key={session.id}
                                className="flex items-center justify-between gap-2 text-xs"
                              >
                                <span className="text-muted-foreground truncate">
                                  {format(new Date(session.start_time), "EEE d MMM · HH:mm", { locale: fr })}
                                  <span className="text-muted-foreground/60 ml-1">
                                    ({registrationCount}/{session.max_participants || "∞"})
                                  </span>
                                </span>
                                {registered ? (
                                  <button
                                    onClick={() => handleUnregister(session.id)}
                                    className="text-destructive hover:underline font-medium shrink-0"
                                  >
                                    Annuler
                                  </button>
                                ) : (
                                  <button
                                    disabled={isFull || !user}
                                    onClick={() => {
                                      setSelectedSession({ ...session, activity });
                                      setShowConfirmDialog(true);
                                    }}
                                    className="text-primary hover:underline font-medium shrink-0 disabled:opacity-40 disabled:no-underline"
                                  >
                                    {isFull ? "Complet" : "S'inscrire"}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Confirm dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Confirmer l'inscription</DialogTitle>
          </DialogHeader>
          {selectedSession && (
            <div className="space-y-3 py-2">
              <div className="p-4 rounded-xl bg-accent/50 border border-border">
                <p className="font-display font-semibold">{selectedSession.activity?.title}</p>
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
              {isRegistering ? "Inscription…" : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default ActivitesPage;
