import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, User, MapPin, Award, CalendarPlus } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import PractitionerInfoSidebar from "@/components/practitioners/PractitionerInfoSidebar";
import PractitionerActivities from "@/components/practitioners/PractitionerActivities";
import PatientBookingDialog from "@/components/booking/PatientBookingDialog";

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
  photo_url?: string | null;
  is_free: boolean;
  price: number | null;
  booking_enabled: boolean;
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
  const [showBooking, setShowBooking] = useState(false);

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

      const { data: acts } = await supabase
        .from("activities")
        .select("id, title, category, description, duration_minutes, max_participants, photo_url, is_free, price, booking_enabled, activity_sessions(id, start_time, end_time, rooms(name))")
        .eq("practitioner_id", profile.id)
        .eq("is_active", true)
        .order("title");

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

  const formatSchedule = (schedule: DaySchedule[]) => {
    const grouped = new Map<string, string[]>();
    schedule.forEach((slot) => {
      const existing = grouped.get(slot.day) || [];
      existing.push(`${slot.start} – ${slot.end}`);
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
      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <Link
          to="/praticiens"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Praticiens
        </Link>

        {/* Hero photo + title */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <div className="overflow-hidden rounded-2xl bg-muted aspect-[21/9] max-h-[400px]">
            {practitioner.avatar_url ? (
              <img
                src={practitioner.avatar_url}
                alt={`${practitioner.first_name} ${practitioner.last_name}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-accent">
                <User className="h-24 w-24 text-muted-foreground/20" />
              </div>
            )}
          </div>
        </motion.div>

        {/* Main grid: content + sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-10 items-start">
          {/* Left content */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            {/* Title + specialty */}
            <div className="mb-6">
              <h1 className="font-display text-3xl md:text-4xl font-bold">
                {practitioner.first_name} {practitioner.last_name}
              </h1>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                {practitioner.specialty && (
                  <span className="flex items-center gap-1.5">
                    <Award className="h-4 w-4 text-primary" />
                    {practitioner.specialty}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  Medsquare, Meslin-l'Évêque
                </span>
              </div>
            </div>

            <Separator className="mb-6" />

            {/* Bio */}
            <div className="mb-8">
              <h2 className="font-display text-xl font-semibold mb-3">À propos</h2>
              {practitioner.bio ? (
                <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                  {practitioner.bio}
                </p>
              ) : (
                <p className="text-muted-foreground italic">
                  Ce praticien n'a pas encore renseigné sa biographie.
                </p>
              )}
            </div>

            <Separator className="mb-8" />

            {/* Activities */}
            {activities.length > 0 && (
              <div className="mb-8">
                <PractitionerActivities activities={activities} />
              </div>
            )}
          </motion.div>

          {/* Right sidebar */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="hidden lg:block"
          >
            <PractitionerInfoSidebar
              practitioner={practitioner}
              scheduleSlots={scheduleSlots}
            />
            {activities.length > 0 && (
              <Button className="w-full mt-4" onClick={() => setShowBooking(true)}>
                <CalendarPlus className="h-4 w-4 mr-2" />
                Prendre rendez-vous
              </Button>
            )}
          </motion.div>
        </div>

        {/* Mobile CTA (visible only on smaller screens) */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border p-4 z-40">
          <div className="flex items-center justify-between gap-4 max-w-lg mx-auto">
            <div>
              <p className="font-display font-semibold text-sm">
                {practitioner.first_name} {practitioner.last_name}
              </p>
              {practitioner.specialty && (
                <p className="text-xs text-muted-foreground">{practitioner.specialty}</p>
              )}
            </div>
            <Link to="/contact">
              <Button size="sm">Contacter</Button>
            </Link>
            {activities.length > 0 && (
              <Button size="sm" variant="default" onClick={() => setShowBooking(true)}>
                <CalendarPlus className="h-4 w-4 mr-1" />
                Réserver
              </Button>
            )}
          </div>
        </div>

        {practitioner && (
          <PatientBookingDialog
            open={showBooking}
            onOpenChange={setShowBooking}
            practitionerId={practitioner.id}
            practitionerName={`${practitioner.first_name} ${practitioner.last_name}`}
            activities={activities.map((a) => ({
              id: a.id,
              title: a.title,
              duration_minutes: a.duration_minutes,
              price: a.price,
              is_free: a.is_free,
              max_participants: a.max_participants,
              category: a.category,
            }))}
          />
        )}
      </div>
    </Layout>
  );
};

export default PraticienDetail;
