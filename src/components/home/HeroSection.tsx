import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { supabase } from "@/integrations/supabase/client";
import heroImage1 from "@/assets/hero-centre.jpg";
import heroImage2 from "@/assets/hero-gallery-2.jpg";
import heroImage3 from "@/assets/hero-gallery-3.jpg";
import heroImage4 from "@/assets/hero-gallery-4.jpg";

const defaultImages = [
  { src: heroImage1, alt: "Intérieur du centre Medsquare", specialty: "" },
  { src: heroImage2, alt: "Accueil du centre", specialty: "" },
  { src: heroImage3, alt: "Cabinet de consultation", specialty: "" },
  { src: heroImage4, alt: "Salle polyvalente", specialty: "" },
];

const INTERVAL = 6500;
const pad = (n: number) => String(n).padStart(2, "0");

const HeroSection = () => {
  const [current, setCurrent] = useState(0);
  const [counts, setCounts] = useState<{ practitioners: number | null; rooms: number | null }>({
    practitioners: null,
    rooms: null,
  });
  const { settings } = useSiteSettings();
  const hero = settings.hero;

  const images = useMemo(() => {
    if (hero.images && hero.images.length > 0) {
      return hero.images.map((img) => ({ src: img.url, alt: img.alt || "Medsquare", specialty: img.specialty || "" }));
    }
    return defaultImages;
  }, [hero.images]);

  const go = useCallback(
    (dir: 1 | -1) => setCurrent((prev) => (prev + dir + images.length) % images.length),
    [images.length],
  );

  useEffect(() => setCurrent(0), [images]);

  useEffect(() => {
    const timer = setInterval(() => go(1), INTERVAL);
    return () => clearInterval(timer);
  }, [go, current]);

  useEffect(() => {
    (async () => {
      const [p, r] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("rooms").select("id", { count: "exact", head: true }).eq("is_available", true),
      ]);
      setCounts({ practitioners: p.count ?? null, rooms: r.count ?? null });
    })();
  }, []);

  const facts = [
    { value: counts.practitioners ? String(counts.practitioners) : "—", label: "praticiens installés" },
    { value: counts.rooms ? String(counts.rooms) : "—", label: "cabinets & salle" },
    { value: "7j/7", label: "jusqu'à 22h en semaine" },
  ];

  const img = images[current];

  return (
    <section className="pt-8 pb-16 md:pt-14 md:pb-24">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          {/* Texte */}
          <div className="lg:col-span-5 order-2 lg:order-1">
            <p className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              {hero.badge} · Meslin-l'Évêque, Ath
            </p>

            <h1 className="font-display font-normal text-[2.75rem] leading-[1.02] md:text-6xl xl:text-7xl tracking-tight mb-6 text-balance">
              {hero.title} <em className="text-primary">{hero.titleAccent}</em>
            </h1>

            <p className="text-lg text-muted-foreground leading-relaxed max-w-md mb-8">{hero.subtitle}</p>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link to="/praticiens">
                <Button size="lg" className="h-12 px-6 rounded-full text-[15px]">
                  {hero.ctaPrimary}
                </Button>
              </Link>
              <Link
                to="/contact"
                className="group inline-flex items-center gap-1.5 text-[15px] font-medium underline-offset-4 hover:underline"
              >
                {hero.ctaSecondary}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>

            <dl className="grid grid-cols-3 gap-4 mt-12 pt-6 border-t border-border">
              {facts.map((f) => (
                <div key={f.label}>
                  <dt className="sr-only">{f.label}</dt>
                  <dd className="font-display text-3xl md:text-4xl leading-none">{f.value}</dd>
                  <dd className="text-xs md:text-sm text-muted-foreground mt-2 leading-snug">{f.label}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Image */}
          <div className="lg:col-span-7 order-1 lg:order-2">
            <div className="relative aspect-[4/3] lg:aspect-[5/4] overflow-hidden rounded-lg bg-muted">
              <AnimatePresence initial={false}>
                <motion.img
                  key={img.src}
                  src={img.src}
                  alt={img.alt}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.9, ease: "easeInOut" }}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </AnimatePresence>

              <div className="absolute inset-x-0 bottom-0 p-4 md:p-5 flex items-end justify-between gap-4 bg-gradient-to-t from-black/45 to-transparent">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={`sp-${current}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="text-white text-sm md:text-[15px] max-w-[70%] leading-snug"
                  >
                    {img.specialty || img.alt}
                  </motion.p>
                </AnimatePresence>

                {images.length > 1 && (
                  <div className="flex items-center gap-1 text-white shrink-0">
                    <button
                      onClick={() => go(-1)}
                      aria-label="Image précédente"
                      className="h-9 w-9 grid place-items-center rounded-full hover:bg-white/15 transition-colors"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <span className="text-xs tabular-nums w-12 text-center">
                      {pad(current + 1)} / {pad(images.length)}
                    </span>
                    <button
                      onClick={() => go(1)}
                      aria-label="Image suivante"
                      className="h-9 w-9 grid place-items-center rounded-full hover:bg-white/15 transition-colors"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
