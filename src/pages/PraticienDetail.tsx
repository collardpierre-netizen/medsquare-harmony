import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Mail, Clock, Award } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";

const practitionersData: Record<string, {
  name: string;
  specialty: string;
  image: string;
  bio: string;
  specialties: string[];
  education: string[];
  schedule: { day: string; hours: string }[];
}> = {
  "sophie-martin": {
    name: "Dr. Sophie Martin",
    specialty: "Médecine générale",
    image: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=600&h=700&fit=crop",
    bio: "Le Dr. Sophie Martin exerce la médecine générale depuis plus de 12 ans. Passionnée par la médecine préventive, elle accompagne ses patients dans une approche globale de leur santé, en prenant le temps d'écouter et de comprendre chaque situation.",
    specialties: ["Médecine préventive", "Suivi familial", "Vaccination", "Bilan de santé"],
    education: ["Université Libre de Bruxelles — Doctorat en médecine", "Formation continue en médecine préventive"],
    schedule: [
      { day: "Lundi", hours: "9h00 - 17h00" },
      { day: "Mercredi", hours: "9h00 - 17h00" },
      { day: "Vendredi", hours: "9h00 - 13h00" },
    ],
  },
  "thomas-dupont": {
    name: "Dr. Thomas Dupont",
    specialty: "Kinésithérapie",
    image: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=600&h=700&fit=crop",
    bio: "Le Dr. Thomas Dupont est kinésithérapeute spécialisé en rééducation sportive. Ancien athlète lui-même, il comprend les besoins spécifiques des sportifs et propose des traitements personnalisés pour une récupération optimale.",
    specialties: ["Rééducation sportive", "Thérapie manuelle", "Drainage lymphatique", "Kinésithérapie respiratoire"],
    education: ["UCLouvain — Master en kinésithérapie", "Certification en thérapie manuelle avancée"],
    schedule: [
      { day: "Mardi", hours: "8h00 - 18h00" },
      { day: "Jeudi", hours: "8h00 - 18h00" },
      { day: "Samedi", hours: "9h00 - 13h00" },
    ],
  },
  "claire-leblanc": {
    name: "Dr. Claire Leblanc",
    specialty: "Dermatologie",
    image: "https://images.unsplash.com/photo-1594824476967-48c8b964f137?w=600&h=700&fit=crop",
    bio: "Le Dr. Claire Leblanc est dermatologue avec une expertise en dermatologie clinique et esthétique. Elle prend en charge toutes les pathologies cutanées et propose des traitements personnalisés adaptés à chaque type de peau.",
    specialties: ["Dermatologie clinique", "Dermatologie esthétique", "Suivi des grains de beauté", "Traitement de l'acné"],
    education: ["ULB — Spécialisation en dermatologie", "Formation en dermatoscopie digitale"],
    schedule: [
      { day: "Lundi", hours: "10h00 - 18h00" },
      { day: "Jeudi", hours: "10h00 - 18h00" },
    ],
  },
  "marc-janssen": {
    name: "Dr. Marc Janssen",
    specialty: "Ostéopathie",
    image: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=600&h=700&fit=crop",
    bio: "Le Dr. Marc Janssen pratique l'ostéopathie depuis 15 ans. Son approche holistique lui permet de traiter une grande variété de troubles fonctionnels en considérant le corps dans sa globalité.",
    specialties: ["Ostéopathie structurelle", "Ostéopathie crânienne", "Ostéopathie viscérale", "Ostéopathie pédiatrique"],
    education: ["FICO — Diplôme d'ostéopathie", "Formation en ostéopathie pédiatrique"],
    schedule: [
      { day: "Mardi", hours: "9h00 - 17h00" },
      { day: "Vendredi", hours: "9h00 - 17h00" },
    ],
  },
  "amelie-peeters": {
    name: "Dr. Amélie Peeters",
    specialty: "Psychologie",
    image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&h=700&fit=crop",
    bio: "Le Dr. Amélie Peeters est psychologue clinicienne spécialisée en thérapie cognitive et comportementale. Elle accompagne adultes et adolescents dans la gestion du stress, de l'anxiété et des troubles émotionnels.",
    specialties: ["Thérapie cognitive et comportementale", "Gestion du stress", "Burn-out", "Troubles anxieux"],
    education: ["UCLouvain — Master en psychologie clinique", "Formation en TCC"],
    schedule: [
      { day: "Lundi", hours: "9h00 - 18h00" },
      { day: "Mercredi", hours: "9h00 - 18h00" },
      { day: "Vendredi", hours: "9h00 - 14h00" },
    ],
  },
  "nicolas-vandenberg": {
    name: "Dr. Nicolas Vandenberg",
    specialty: "Nutrition",
    image: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=600&h=700&fit=crop",
    bio: "Le Dr. Nicolas Vandenberg est nutritionniste-diététicien passionné par l'alimentation thérapeutique. Il accompagne ses patients dans l'adoption d'habitudes alimentaires saines et adaptées à leurs besoins spécifiques.",
    specialties: ["Rééquilibrage alimentaire", "Nutrition sportive", "Alimentation thérapeutique", "Gestion du poids"],
    education: ["ULB — Master en nutrition et diététique", "Certification en nutrition sportive"],
    schedule: [
      { day: "Mardi", hours: "10h00 - 18h00" },
      { day: "Jeudi", hours: "10h00 - 18h00" },
      { day: "Samedi", hours: "9h00 - 12h00" },
    ],
  },
};

const PraticienDetail = () => {
  const { id } = useParams<{ id: string }>();
  const practitioner = id ? practitionersData[id] : null;

  if (!practitioner) {
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
              <div className="overflow-hidden rounded-2xl">
                <img
                  src={practitioner.image}
                  alt={practitioner.name}
                  className="w-full aspect-[4/5] object-cover"
                />
              </div>
            </motion.div>

            {/* Info */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <span className="text-primary text-sm font-medium tracking-widest uppercase">
                {practitioner.specialty}
              </span>
              <h1 className="font-display text-3xl md:text-4xl font-bold mt-2 mb-6">
                {practitioner.name}
              </h1>
              <p className="text-muted-foreground leading-relaxed mb-8">
                {practitioner.bio}
              </p>

              {/* Spécialités */}
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <Award className="h-5 w-5 text-primary" />
                  <h3 className="font-display text-lg font-semibold">Spécialités</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {practitioner.specialties.map((spec) => (
                    <span
                      key={spec}
                      className="px-3 py-1.5 rounded-full bg-accent text-accent-foreground text-sm"
                    >
                      {spec}
                    </span>
                  ))}
                </div>
              </div>

              {/* Horaires */}
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-5 w-5 text-primary" />
                  <h3 className="font-display text-lg font-semibold">Horaires de consultation</h3>
                </div>
                <ul className="space-y-2">
                  {practitioner.schedule.map((slot) => (
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
