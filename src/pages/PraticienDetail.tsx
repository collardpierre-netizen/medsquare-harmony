import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Mail, Clock, Award, User, Calendar } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface DaySchedule {
  day: string;
  start: string;
  end: string;
}

interface PractitionerProfile {
  id: string;
  first_name: string;
  last_name: string;
  specialty: string | null;
  bio: string | null;
  avatar_url: string | null;
  phone: string | null;
  schedule: DaySchedule[] | null;
}

interface ActivityWithSessions {
  id: string;
  title: string;
  category: string;
  description: string | null;
  duration_minutes: number;
  max_participants: number | null;
  activity_sessions: {
    id: string;
    start_time: string;
    end_time: string;
    rooms: { name: string } | null;
  }[];
}

const DAYS_ORDER = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

const PraticienDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [practitioner, setPractitioner] = useState<PractitionerProfile | null>(null);
  const [activities, setActivities] = useState<ActivityWithSessions[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, specialty, bio, avatar_url, phone, schedule")
        .eq("id", id)
        .eq("is_active", true)
        .maybeSingle();

      if (!profile) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // Parse schedule
      let parsedSchedule: DaySchedule[] | null = null;
      if (profile.schedule) {
        try {
          const raw = typeof profile.schedule === "string"
            ? JSON.parse(profile.schedule)
            : profile.schedule;
          if (Array.isArray(raw)) parsedSchedule = raw;
        } catch { /* ignore */ }
      }

      setPractitioner({ ...profile, schedule: parsedSchedule });

      // Fetch practitioner's active activities with upcoming sessions
      const { data: acts } = await supabase
        .from("activities")
        .select("id, title, category, description, duration_minutes, max_participants, activity_sessions(id, start_time, end_time, rooms(name))")
        .eq("practitioner_id", profile.id)
        .eq("is_active", true)
        .order("title");

      // Filter to only upcoming sessions
      const now = new Date().toISOString();
      const filtered = (acts || []).map((a: any) => ({
        ...a,
        activity_sessions: (a.activity_sessions || [])
          .filter((s: any) => s.start_time >= now)
          .sort((a: any, b: any) => a.start_time.localeCompare(b.start_time))
          .slice(0, 3),
      }));

      setActivities(filtered);
      setLoading(false);
    };

    fetchData();
  }, [id]);

  // Group schedule by day and format
  const formatSchedule = (schedule: DaySchedule[]) => {
    const grouped = new Map<string, string[]>();
    schedule.forEach((slot) => {
      const existing = grouped.get(slot.day) || [];
      existing.push(`${slot.start} - ${slot.end}`);
      grouped.set(slot.day, existing);
    });

    return DAYS_ORDER
      .filter((day) => grouped.has(day))
      .map((day) => ({
        day: day.charAt(0).toUpperCase() + day.slice(1),
        hours: grouped.get(day)!.join(", "),
      }));
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

  if (notFound || !practitioner) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <h1 className="font-display text-3xl font-bold mb-4">Praticien introuvable</h1>
            <Link to="/praticiens">
              <Button>Retour aux praticiens</Button>
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  const scheduleSlots = practitioner.schedule ? formatSchedule(practitioner.schedule) : [];

  return (
    <Layout>
      <section className="py-12 md:py-20">
        <div className="container mx-auto px-4">
          <Link
            to="/praticiens"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-8 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour aux praticiens
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            {/* Photo */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="overflow-hidden rounded-2xl bg-muted aspect-[4/5]">
                {practitioner.avatar_url ? (
                  <img
                    src={practitioner.avatar_url}
                    alt={`${practitioner.first_name} ${practitioner.last_name}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-accent">
                    <User className="h-32 w-32 text-muted-foreground/20" />
                  </div>
                )}
              </div>
            </motion.div>

            {/* Info */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              {practitioner.specialty && (
                <span className="text-primary text-sm font-medium tracking-widest uppercase">
                  {practitioner.specialty}
                </span>
              )}
              <h1 className="font-display text-3xl md:text-4xl font-bold mt-2 mb-6">
                {practitioner.first_name} {practitioner.last_name}
              </h1>

              {practitioner.bio ? (
                <p className="text-muted-foreground leading-relaxed mb-8">
                  {practitioner.bio}
                </p>
              ) : (
                <p className="text-muted-foreground leading-relaxed mb-8 italic">
                  Ce praticien n'a pas encore renseigné sa biographie.
                </p>
              )}

              {/* Horaires */}
              {scheduleSlots.length > 0 && (
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="h-5 w-5 text-primary" />
                    <h3 className="font-display text-lg font-semibold">Horaires de consultation</h3>
                  </div>
                  <ul className="space-y-2">
                    {scheduleSlots.map((slot) => (
                      <li
                        key={slot.day}
                        className="flex justify-between py-2 border-b border-border text-sm"
                      >
                        <span className="font-medium">{slot.day}</span>
                        <span className="text-muted-foreground">{slot.hours}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Activities */}
              {activities.length > 0 && (
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-3">
                    <Award className="h-5 w-5 text-primary" />
                    <h3 className="font-display text-lg font-semibold">Activités proposées</h3>
                  </div>
                  <div className="space-y-3">
                    {activities.map((activity) => (
                      <Card key={activity.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-sm">{activity.title}</h4>
                            <Badge variant="secondary" className="text-[10px]">
                              {activity.category}
                            </Badge>
                          </div>
                          {activity.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                              {activity.description}
                            </p>
                          )}
                          {activity.activity_sessions.length > 0 && (
                            <div className="space-y-1 mt-2">
                              {activity.activity_sessions.map((session) => (
                                <div key={session.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Calendar className="h-3 w-3 text-primary" />
                                  <span>
                                    {format(new Date(session.start_time), "EEE d MMM · HH:mm", { locale: fr })}
                                  </span>
                                  {session.rooms?.name && (
                                    <span className="text-primary/70">· {session.rooms.name}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <Link to="/activites" className="mt-3 inline-block">
                    <Button variant="outline" size="sm" className="text-xs">
                      Voir toutes les activités
                    </Button>
                  </Link>
                </div>
              )}

              {/* Contact */}
              <Link to="/contact">
                <Button size="lg" className="w-full sm:w-auto">
                  <Mail className="h-4 w-4 mr-2" />
                  Contacter ce praticien
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default PraticienDetail;
