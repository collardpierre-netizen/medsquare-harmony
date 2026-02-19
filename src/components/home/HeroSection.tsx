import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import heroImage1 from "@/assets/hero-centre.jpg";
import heroImage2 from "@/assets/hero-gallery-2.jpg";
import heroImage3 from "@/assets/hero-gallery-3.jpg";
import heroImage4 from "@/assets/hero-gallery-4.jpg";

const defaultImages = [
  { src: heroImage1, alt: "Intérieur du centre Medsquare", specialty: "" },
  { src: heroImage2, alt: "Accueil chaleureux du centre", specialty: "" },
  { src: heroImage3, alt: "Salle de consultation moderne", specialty: "" },
  { src: heroImage4, alt: "Espace yoga et bien-être", specialty: "" },
];

const INTERVAL = 6000;

const HeroSection = () => {
  const [current, setCurrent] = useState(0);
  const { settings } = useSiteSettings();
  const hero = settings.hero;

  const images = useMemo(() => {
    if (hero.images && hero.images.length > 0) {
      return hero.images.map((img) => ({ src: img.url, alt: img.alt, specialty: img.specialty || "" }));
    }
    return defaultImages;
  }, [hero.images]);

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % images.length);
  }, [images.length]);

  useEffect(() => {
    setCurrent(0);
  }, [images]);

  useEffect(() => {
    const timer = setInterval(next, INTERVAL);
    return () => clearInterval(timer);
  }, [next]);

  return (
    <section className="relative min-h-[85vh] flex items-center overflow-hidden">
      <AnimatePresence initial={false}>
        <motion.div
          key={current}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          <img src={images[current].src} alt={images[current].alt} className="w-full h-full object-cover" />
        </motion.div>
      </AnimatePresence>

      <div className="absolute inset-0 bg-gradient-to-r from-foreground/80 via-foreground/50 to-transparent z-[1]" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-2xl">
          <motion.span initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="inline-block text-sage text-sm font-medium tracking-widest uppercase mb-4">
            {hero.badge}
          </motion.span>

          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }} className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
            {hero.title}{" "}
            <span className="text-sage italic">{hero.titleAccent}</span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="text-white/80 text-lg md:text-xl leading-relaxed mb-8">
            {hero.subtitle}
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }} className="flex flex-col sm:flex-row gap-4">
            <Link to="/praticiens">
              <Button size="lg" className="text-base px-8">{hero.ctaPrimary}</Button>
            </Link>
            <Link to="/contact">
              <Button variant="outline" size="lg" className="text-base px-8 border-white text-white bg-white/10 hover:bg-white/20 hover:text-white">
                {hero.ctaSecondary}
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>

      {/* Specialty pills */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 flex flex-wrap justify-center gap-2 px-4 max-w-3xl">
        <AnimatePresence mode="wait">
          {images[current].specialty && (
            <motion.span
              key={`specialty-${current}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center rounded-full bg-white/20 backdrop-blur-sm border border-white/30 px-4 py-1.5 text-sm font-medium text-white shadow-lg"
            >
              {images[current].specialty}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
        {images.map((_, idx) => (
          <button key={idx} onClick={() => setCurrent(idx)} className={cn("h-2 rounded-full transition-all duration-500", idx === current ? "w-8 bg-white" : "w-2 bg-white/40 hover:bg-white/60")} aria-label={`Voir image ${idx + 1}`} />
        ))}
      </div>
    </section>
  );
};

export default HeroSection;
