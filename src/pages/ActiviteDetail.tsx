import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Clock,
  Users,
  User,
  Award,
  Calendar,
  MapPin,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import ActivityDetailSessions from "@/components/activities/ActivityDetailSessions";

const STOCK_PHOTOS: Record<string, string> = {
  yoga: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=1200&h=600&fit=crop",
  pilates: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=1200&h=600&fit=crop",
  meditation: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1200&h=600&fit=crop",
  fitness: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=1200&h=600&fit=crop",
  danse: "https://images.unsplash.com/photo-1504609773096-104ff2c73ba4?w=1200&h=600&fit=crop",
  sophrologie: "https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=1200&h=600&fit=crop",
  nutrition: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=1200&h=600&fit=crop",
  autre: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&h=600&fit=crop",
};

const CATEGORY_LABELS: Record<string, string> = {
  yoga: "Yoga",
  pilates: "Pilates",
  meditation: "Méditation",
  fitness: "Fitness",
  danse: "Danse",
  sophrologie: "Sophrologie",
  nutrition: "Nutrition",
  autre: "Autre",
};

interface Activity {
  id: string;
  title: string;
  description: string | null;
  category: string;
  duration_minutes: number;
  max_participants: number | null;
  photo_url: string | null;
  location: string | null;
  profiles: {
    id: string;
    first_name: string;
    last_name: string;
    specialty: string | null;
    avatar_url: string | null;
  } | null;
}

interface Session {
  id: string;
  start_time: string;
  end_time: string;
  max_participants: number | null;
  status: string;
  rooms: { name: string } | null;
  activity_registrations: { id: string; user_id: string }[];
}

const ActiviteDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();

  const [activity, setActivity] = useState<Activity | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [myRegistrations, setMyRegistrations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;

      const { data: act } = await supabase
        .from("activities")
        .select(
          "id, title, description, category, duration_minutes, max_participants, photo_url, location, profiles(id, first_name, last_name, specialty, avatar_url)"
        )
        .eq("id", id)
        .eq("is_active", true)
        .maybeSingle();

      if (!act) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setActivity(act as unknown as Activity);

      const { data: sess } = await supabase
        .from("activity_sessions")
        .select(
          "id, start_time, end_time, max_participants, status, rooms(name), activity_registrations(id, user_id)"
        )
        .eq("activity_id", id)
        .gte("start_time", new Date().toISOString())
        .eq("status", "scheduled")
        .order("start_time");

      setSessions((sess || []) as unknown as Session[]);

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
  }, [id, user]);

  const handleRegister = async (sessionId: string) => {
    if (!user) return;
    const { error } = await supabase.from("activity_registrations").insert({
      session_id: sessionId,
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
      toast({
        title: "Inscription confirmée ! 🎉",
        description: "Vous recevrez un rappel avant la séance.",
      });
      setMyRegistrations((prev) => [...prev, sessionId]);
    }
  };

  const handleUnregister = async (sessionId: string) => {
    if (!user) return;
    await supabase
      .from("activity_registrations")
      .delete()
      .eq("session_id", sessionId)
      .eq("user_id", user.id);
    setMyRegistrations((prev) => prev.filter((id) => id !== sessionId));
    toast({ title: "Inscription annulée" });
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      </Layout>
    );
  }

  if (notFound || !activity) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <h1 className="font-display text-3xl font-bold mb-4">
              Activité introuvable
            </h1>
            <Link to="/activites">
              <Button>Retour aux activités</Button>
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  const photo =
    activity.photo_url ||
    STOCK_PHOTOS[activity.category] ||
    STOCK_PHOTOS.autre;
  const practitioner = activity.profiles;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <Link
          to="/activites"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Activités
        </Link>

        {/* Hero image */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <div className="overflow-hidden rounded-2xl bg-muted aspect-[21/9] max-h-[400px] relative">
            <img
              src={photo}
              alt={activity.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-4 left-4">
              <span className="inline-flex items-center rounded-full bg-background/90 backdrop-blur-sm px-4 py-1.5 text-sm font-medium text-foreground shadow-sm">
                {CATEGORY_LABELS[activity.category] || activity.category}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Grid: content + sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-10 items-start">
          {/* Left — main content */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            {/* Title */}
            <h1 className="font-display text-3xl md:text-4xl font-bold mb-3">
              {activity.title}
            </h1>

            {/* Meta pills */}
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-6">
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-primary" />
                {activity.duration_minutes} min
              </span>
              {activity.max_participants && (
                <span className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-primary" />
                  {activity.max_participants} participants max
                </span>
              )}
              {activity.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {activity.location}
                </span>
              )}
            </div>

            <Separator className="mb-6" />

            {/* Description */}
            <div className="mb-8">
              <h2 className="font-display text-xl font-semibold mb-3">
                Description
              </h2>
              {activity.description ? (
                <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                  {activity.description}
                </p>
              ) : (
                <p className="text-muted-foreground italic">
                  Aucune description renseignée pour cette activité.
                </p>
              )}
            </div>

            <Separator className="mb-8" />

            {/* Sessions */}
            <div className="mb-8">
              <h2 className="font-display text-xl font-semibold mb-4">
                Prochaines séances
              </h2>
              <ActivityDetailSessions
                sessions={sessions}
                myRegistrations={myRegistrations}
                isAuthenticated={!!user}
                onRegister={handleRegister}
                onUnregister={handleUnregister}
              />
            </div>
          </motion.div>

          {/* Right sidebar — practitioner card */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="hidden lg:block"
          >
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sticky top-28">
              <h3 className="text-sm font-medium text-muted-foreground mb-4">
                Animée par
              </h3>

              {practitioner ? (
                <Link
                  to={`/praticiens/${practitioner.id}`}
                  className="group block"
                >
                  <div className="flex items-center gap-4 mb-4">
                    {practitioner.avatar_url ? (
                      <img
                        src={practitioner.avatar_url}
                        alt={`${practitioner.first_name} ${practitioner.last_name}`}
                        className="h-14 w-14 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-14 w-14 rounded-full bg-accent flex items-center justify-center">
                        <User className="h-6 w-6 text-muted-foreground/30" />
                      </div>
                    )}
                    <div>
                      <p className="font-display font-semibold group-hover:text-primary transition-colors">
                        {practitioner.first_name} {practitioner.last_name}
                      </p>
                      {practitioner.specialty && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Award className="h-3.5 w-3.5 text-primary" />
                          {practitioner.specialty}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="w-full">
                    Voir le profil
                  </Button>
                </Link>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Praticien non renseigné
                </p>
              )}

              <Separator className="my-5" />

              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="font-medium">
                    {sessions.length} séance{sessions.length !== 1 ? "s" : ""}{" "}
                    à venir
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <span>{activity.duration_minutes} minutes par séance</span>
                </div>
                {activity.max_participants && (
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span>{activity.max_participants} places maximum</span>
                  </div>
                )}
              </div>

              {!user && sessions.length > 0 && (
                <>
                  <Separator className="my-5" />
                  <p className="text-xs text-muted-foreground">
                    <Link
                      to="/login"
                      className="text-primary font-medium hover:underline"
                    >
                      Connectez-vous
                    </Link>{" "}
                    pour vous inscrire à une séance.
                  </p>
                </>
              )}
            </div>
          </motion.div>
        </div>

        {/* Mobile CTA */}
        {practitioner && (
          <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border p-4 z-40">
            <div className="flex items-center justify-between gap-4 max-w-lg mx-auto">
              <div>
                <p className="font-display font-semibold text-sm">
                  {activity.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {practitioner.first_name} {practitioner.last_name}
                </p>
              </div>
              <Link to={`/praticiens/${practitioner.id}`}>
                <Button size="sm" variant="outline">
                  Praticien
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ActiviteDetail;
