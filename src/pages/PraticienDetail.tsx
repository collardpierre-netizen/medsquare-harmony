import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, CalendarDays, Star, MessageCircle, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PractitionerHero from "@/components/practitioners/detail/PractitionerHero";
import PractitionerInfoSidebar from "@/components/practitioners/PractitionerInfoSidebar";
import PractitionerTabProfile from "@/components/practitioners/detail/PractitionerTabProfile";
import PractitionerTabPlaceholder from "@/components/practitioners/detail/PractitionerTabPlaceholder";
import PractitionerTabTarifs from "@/components/practitioners/detail/PractitionerTabTarifs";
import PractitionerTabAvis from "@/components/practitioners/detail/PractitionerTabAvis";
import PatientBookingDialog from "@/components/booking/PatientBookingDialog";
import ContactPractitionerDialog from "@/components/practitioners/ContactPractitionerDialog";
import { generatePractitionerPdf } from "@/components/practitioners/detail/practitionerPdfExport";

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
  contact_email: string | null;
  schedule: DaySchedule[] | null;
  social_links: Record<string, string> | null;
  accepts_new_patients: boolean;
  avg_appointment_delay_days: number | null;
  collaboration_ids: string[];
  video_available: boolean;
  home_visit: boolean;
  pmr_accessible: boolean;
  parking: boolean;
  languages: string[];
  payment_methods: string[];
  conventioned: boolean | null;
  inami_number: string | null;
  tiers_payant: boolean;
  specialties: string[];
  experiences: any[];
  formations: any[];
  associations: string[];
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

interface Collaborator {
  id: string;
  first_name: string;
  last_name: string;
  specialty: string | null;
}

const DAYS_ORDER = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

const PraticienDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [practitioner, setPractitioner] = useState<PractitionerProfile | null>(null);
  const [activities, setActivities] = useState<ActivityWithSessions[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [showMobileContact, setShowMobileContact] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const handlePdfExport = async () => {
    if (!practitioner) return;
    setPdfLoading(true);
    try {
      await generatePractitionerPdf(practitioner);
    } catch (e) {
      console.error("PDF export error:", e);
    }
    setPdfLoading(false);
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
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
          const raw = typeof profile.schedule === "string" ? JSON.parse(profile.schedule) : profile.schedule;
          if (Array.isArray(raw)) parsedSchedule = raw;
        } catch { /* ignore */ }
      }

      const p: PractitionerProfile = {
        ...profile,
        schedule: parsedSchedule,
        social_links: (profile.social_links as Record<string, string> | null) || null,
        accepts_new_patients: (profile as any).accepts_new_patients ?? true,
        avg_appointment_delay_days: (profile as any).avg_appointment_delay_days ?? null,
        collaboration_ids: (profile as any).collaboration_ids || [],
        video_available: (profile as any).video_available ?? false,
        home_visit: (profile as any).home_visit ?? false,
        pmr_accessible: (profile as any).pmr_accessible ?? false,
        parking: (profile as any).parking ?? false,
        languages: (profile as any).languages || ["français"],
        payment_methods: (profile as any).payment_methods || [],
        conventioned: (profile as any).conventioned ?? null,
        inami_number: (profile as any).inami_number ?? null,
        tiers_payant: (profile as any).tiers_payant ?? false,
        specialties: (profile as any).specialties || [],
        experiences: (profile as any).experiences || [],
        formations: (profile as any).formations || [],
        associations: (profile as any).associations || [],
      };

      setPractitioner(p);

      // Fetch activities
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

      // Fetch collaborators
      if (p.collaboration_ids.length > 0) {
        const { data: collabs } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, specialty")
          .in("id", p.collaboration_ids)
          .eq("is_active", true);
        setCollaborators(collabs || []);
      }

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
      .map((day) => ({ day: day.charAt(0).toUpperCase() + day.slice(1), hours: grouped.get(day)!.join(", ") }));
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
        <div className="flex items-center justify-center min-h-[60vh] text-center">
          <div>
            <h1 className="font-display text-3xl font-bold mb-4">Praticien introuvable</h1>
            <Link to="/praticiens"><Button>Retour aux praticiens</Button></Link>
          </div>
        </div>
      </Layout>
    );
  }

  const scheduleSlots = practitioner.schedule ? formatSchedule(practitioner.schedule) : [];
  const hasBookable = activities.some((a) => a.booking_enabled);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 print:py-2">
        {/* Breadcrumb */}
        <Link
          to="/praticiens"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 print:hidden"
        >
          <ArrowLeft className="h-4 w-4" />
          Praticiens
        </Link>

        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mb-8">
          <PractitionerHero
            practitioner={practitioner}
            hasBookableActivities={hasBookable}
            onBookClick={() => setShowBooking(true)}
            onPdfClick={handlePdfExport}
            isPdfLoading={pdfLoading}
          />
        </motion.div>

        {/* Main grid: tabs + sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-10 items-start">
          {/* Tabs */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
          >
            <Tabs defaultValue="profil" className="w-full">
              <TabsList className="w-full justify-start overflow-x-auto bg-transparent border-b border-border rounded-none p-0 h-auto print:hidden">
                {[
                  { value: "profil", label: "Profil" },
                  { value: "reserver", label: "Réserver" },
                  { value: "tarifs", label: "Tarifs" },
                  { value: "avis", label: "Avis" },
                  { value: "qr", label: "Q&R" },
                  { value: "parcours", label: "Parcours" },
                ].map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm"
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="profil" className="mt-6 animate-in fade-in-0 duration-150">
                <PractitionerTabProfile
                  practitioner={practitioner}
                  activities={activities}
                  collaborators={collaborators}
                />
              </TabsContent>

              <TabsContent value="reserver" className="mt-6 animate-in fade-in-0 duration-150">
                <PractitionerTabPlaceholder
                  title="Réservation en ligne"
                  description="Le système de réservation avancé avec créneaux en temps réel sera bientôt disponible."
                  icon={CalendarDays}
                />
              </TabsContent>

              <TabsContent value="tarifs" className="mt-6 animate-in fade-in-0 duration-150">
                <PractitionerTabTarifs
                  practitionerId={practitioner.id}
                  practitionerName={`${practitioner.first_name} ${practitioner.last_name}`}
                />
              </TabsContent>

              <TabsContent value="avis" className="mt-6 animate-in fade-in-0 duration-150">
                <PractitionerTabPlaceholder
                  title="Avis patients"
                  description="Les avis multi-critères seront bientôt disponibles."
                  icon={Star}
                />
              </TabsContent>

              <TabsContent value="qr" className="mt-6 animate-in fade-in-0 duration-150">
                <PractitionerTabPlaceholder
                  title="Questions & Réponses"
                  description="La section Q&R sera bientôt disponible."
                  icon={MessageCircle}
                />
              </TabsContent>

              <TabsContent value="parcours" className="mt-6 animate-in fade-in-0 duration-150">
                <PractitionerTabPlaceholder
                  title="Parcours professionnel"
                  description="La timeline du parcours sera bientôt disponible."
                  icon={GraduationCap}
                />
              </TabsContent>
            </Tabs>
          </motion.div>

          {/* Sidebar */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.15 }}
            className="hidden lg:block print:hidden"
          >
            <PractitionerInfoSidebar practitioner={practitioner} scheduleSlots={scheduleSlots} />
          </motion.div>
        </div>

        {/* Mobile CTA */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border p-4 z-40 print:hidden">
          <div className="flex items-center justify-between gap-4 max-w-lg mx-auto">
            <div>
              <p className="font-display font-semibold text-sm">{practitioner.first_name} {practitioner.last_name}</p>
              {practitioner.specialty && <p className="text-xs text-muted-foreground">{practitioner.specialty}</p>}
            </div>
            <Button size="sm" onClick={() => setShowMobileContact(true)}>Contacter</Button>
            {hasBookable && (
              <Button size="sm" variant="default" onClick={() => setShowBooking(true)}>Réserver</Button>
            )}
          </div>
        </div>

        {/* Dialogs */}
        <PatientBookingDialog
          open={showBooking}
          onOpenChange={setShowBooking}
          practitionerId={practitioner.id}
          practitionerName={`${practitioner.first_name} ${practitioner.last_name}`}
          activities={activities.filter((a) => a.booking_enabled).map((a) => ({
            id: a.id, title: a.title, duration_minutes: a.duration_minutes,
            price: a.price, is_free: a.is_free, max_participants: a.max_participants, category: a.category,
          }))}
        />
        <ContactPractitionerDialog
          open={showMobileContact}
          onOpenChange={setShowMobileContact}
          practitionerName={`${practitioner.first_name} ${practitioner.last_name}`}
          practitionerEmail={practitioner.contact_email || ""}
        />
      </div>
    </Layout>
  );
};

export default PraticienDetail;
