import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface HeroImageItem {
  url: string;
  alt: string;
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
    badge: "Centre médical pluridisciplinaire",
    title: "Votre santé, notre",
    titleAccent: "priorité",
    subtitle: "Un espace de soins chaleureux où des praticiens passionnés vous accompagnent avec expertise et bienveillance.",
    ctaPrimary: "Découvrir nos praticiens",
    ctaSecondary: "Nous contacter",
  },
  why: {
    badge: "Nos valeurs",
    title: "Pourquoi choisir Medsquare ?",
    subtitle: "Un centre médical pensé pour votre confort et votre bien-être.",
    features: [
      { icon: "Heart", title: "Approche humaine", description: "Chaque patient est unique. Nos praticiens prennent le temps de vous écouter et de vous accompagner." },
      { icon: "Users", title: "Équipe pluridisciplinaire", description: "Une synergie entre professionnels de santé pour une prise en charge globale et coordonnée." },
      { icon: "Shield", title: "Excellence médicale", description: "Des praticiens qualifiés, formés aux dernières avancées, dans un environnement moderne." },
      { icon: "Clock", title: "Accessibilité", description: "Des horaires flexibles et un accueil attentif pour s'adapter à votre emploi du temps." },
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
    title: "Une question ? Contactez-nous.",
    subtitle: "Notre équipe est à votre disposition pour répondre à toutes vos questions.",
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
