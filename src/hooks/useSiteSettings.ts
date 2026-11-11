import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface HeroImageItem {
  url: string;
  alt: string;
  specialty?: string;
}

export interface HeroSettings {
  badge: string;
  title: string;
  titleAccent: string;
  subtitle: string;
  ctaPrimary: string;
  ctaSecondary: string;
  images?: HeroImageItem[];
}

export interface FeatureItem {
  icon: string;
  title: string;
  description: string;
}

export interface WhySettings {
  badge: string;
  title: string;
  subtitle: string;
  features: FeatureItem[];
}

export interface TestimonialItem {
  text: string;
  author: string;
  role: string;
}

export interface TestimonialsSettings {
  badge: string;
  title: string;
  visible: boolean;
  items: TestimonialItem[];
}

export interface ContactSettings {
  title: string;
  subtitle: string;
  phone: string;
  email: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqSettings {
  badge: string;
  title: string;
  visible: boolean;
  items: FaqItem[];
}

export interface SiteSettings {
  hero: HeroSettings;
  why: WhySettings;
  testimonials: TestimonialsSettings;
  contact: ContactSettings;
  faq: FaqSettings;
}

export const DEFAULT_SETTINGS: SiteSettings = {
  hero: {
    badge: "Centre paramédical",
    title: "Soins, thérapies et cours,",
    titleAccent: "sous un même toit.",
    subtitle: "Psychologues, kinésiologues, massothérapeutes, pédicures, professeurs de yoga et de pilates : on vient pour un rendez-vous, on revient pour un cours.",
    ctaPrimary: "Trouver un praticien",
    ctaSecondary: "Nous contacter",
  },
  why: {
    badge: "Le centre",
    title: "Concrètement, ce qui change.",
    subtitle: "Un centre paramédical à Meslin-l'Évêque, à deux pas d'Ath, pensé pour les soins comme pour le mouvement.",
    features: [
      { icon: "Users", title: "Plusieurs disciplines, un seul lieu", description: "Psychologie, kinésiologie, massages, pédicure, yoga, pilates… Quand un suivi demande plusieurs approches, tout se passe au même endroit." },
      { icon: "Shield", title: "Parking sur place", description: "Un grand parking au pied du centre, avec des places réservées aux personnes à mobilité réduite." },
      { icon: "Clock", title: "Ouvert tard, et le week-end", description: "Du lundi au vendredi de 8h à 22h, le samedi et le dimanche de 9h à 21h. De quoi caser une séance après le travail." },
      { icon: "Heart", title: "Une salle de 60 m²", description: "Lumineuse, entourée de baies vitrées, avec vestiaires et douche : cours collectifs, ateliers et conférences jusqu'à 50 personnes." },
    ],
  },
  testimonials: {
    badge: "Témoignages",
    title: "Ce que disent nos patients",
    visible: true,
    items: [
      { text: "Un accueil chaleureux et des praticiens à l'écoute. Je recommande vivement Medsquare à tous ceux qui cherchent un suivi médical de qualité.", author: "Marie D.", role: "Patiente depuis 2023" },
      { text: "Les locaux sont magnifiques et le personnel très professionnel. On se sent vraiment en confiance dès le premier rendez-vous.", author: "Jean-Pierre L.", role: "Patient depuis 2022" },
      { text: "Enfin un centre médical qui prend le temps de vous écouter. L'approche pluridisciplinaire fait toute la différence.", author: "Isabelle V.", role: "Patiente depuis 2024" },
    ],
  },
  contact: {
    title: "À deux pas d'Ath, avec parking sur place.",
    subtitle: "Une question sur un praticien, une salle ou un cours ? Appelez-nous ou passez au centre.",
    phone: "+32 498 64 41 30",
    email: "medsquare7822@gmail.com",
  },
  faq: {
    badge: "FAQ",
    title: "Questions fréquentes",
    visible: true,
    items: [
      { question: "Comment prendre rendez-vous ?", answer: "Vous pouvez prendre rendez-vous directement en contactant le praticien par téléphone ou email via notre page Contact." },
      { question: "Quels sont les modes de paiement acceptés ?", answer: "Nos praticiens acceptent les paiements en espèces, par carte bancaire et par virement. Les conditions varient selon le praticien." },
      { question: "Les consultations sont-elles remboursées ?", answer: "Le remboursement dépend de votre mutualité et du type de praticien consulté. Renseignez-vous auprès de votre praticien lors de la prise de rendez-vous." },
      { question: "Le centre est-il accessible aux personnes à mobilité réduite ?", answer: "Oui, notre centre est entièrement accessible aux personnes à mobilité réduite, avec un ascenseur et des places de parking dédiées." },
    ],
  },
};

export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", ["hero", "why", "testimonials", "contact", "faq"]);

      if (data && data.length > 0) {
        const merged = { ...DEFAULT_SETTINGS };
        for (const row of data) {
          const k = row.key as keyof SiteSettings;
          if (k in merged) {
            merged[k] = { ...merged[k], ...(row.value as any) };
          }
        }
        setSettings(merged);
      }
      setLoading(false);
    };
    fetchSettings();
  }, []);

  return { settings, loading };
}

export async function saveSiteSettings(key: keyof SiteSettings, value: any) {
  const { error } = await supabase
    .from("settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw error;
}
