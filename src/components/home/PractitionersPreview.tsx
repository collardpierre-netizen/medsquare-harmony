import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, User, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface Practitioner {
  id: string;
  first_name: string;
  last_name: string;
  specialty: string | null;
  avatar_url: string | null;
}

const CARD_WIDTH = 280; // px
const GAP = 24; // px
const SPEED = 0.4; // px per frame (~24px/s)

const PractitionersPreview = () => {
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const rafRef = useRef<number>(0);
  const pausedRef = useRef(false);

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, specialty, avatar_url")
        .eq("is_active", true)
        .order("display_order" as any)
        .order("last_name");
      setPractitioners(data || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  // Infinite scroll animation
  useEffect(() => {
    if (practitioners.length < 2) return;

    const el = scrollRef.current;
    if (!el) return;

    const totalWidth = practitioners.length * (CARD_WIDTH + GAP);

    const animate = () => {
      if (!pausedRef.current) {
        offsetRef.current += SPEED;
        if (offsetRef.current >= totalWidth) {
          offsetRef.current -= totalWidth;
        }
        el.style.transform = `translateX(-${offsetRef.current}px)`;
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [practitioners]);

  // Triple the list for seamless loop
  const items = practitioners.length >= 2
    ? [...practitioners, ...practitioners, ...practitioners]
    : practitioners;

  const renderCard = (practitioner: Practitioner, index: number) => (
    <div
      key={`${practitioner.id}-${index}`}
      className="flex-shrink-0"
      style={{ width: CARD_WIDTH }}
    >
      <Link to={`/praticiens/${practitioner.id}`} className="group block">
        <div className="relative overflow-hidden rounded-xl mb-3 aspect-[4/5] bg-muted">
          {practitioner.avatar_url ? (
            <img
              src={practitioner.avatar_url}
              alt={`${practitioner.first_name} ${practitioner.last_name}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-accent">
              <User className="h-16 w-16 text-muted-foreground/20" />
            </div>
          )}
        </div>
        <h3 className="font-display text-base font-semibold group-hover:text-primary transition-colors">
          {practitioner.first_name} {practitioner.last_name}
        </h3>
        {practitioner.specialty && (
          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
            <Award className="h-3.5 w-3.5 text-primary" />
            {practitioner.specialty}
          </p>
        )}
      </Link>
    </div>
  );

  return (
    <section className="py-20 md:py-28">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex flex-col md:flex-row md:items-end md:justify-between mb-10"
        >
          <div>
            <span className="text-primary text-sm font-medium tracking-widest uppercase">
              Notre équipe
            </span>
            <h2 className="font-display text-3xl md:text-4xl font-bold mt-3 mb-2">
              Nos praticiens
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl">
              Des professionnels de santé dévoués, unis par une même passion : votre bien-être.
            </p>
          </div>
          <Link to="/praticiens" className="mt-4 md:mt-0">
            <Button variant="ghost" className="group">
              Voir tous les praticiens
              <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : practitioners.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Aucun praticien disponible pour le moment.
          </p>
        ) : practitioners.length === 1 ? (
          <div className="flex justify-center">
            {renderCard(practitioners[0], 0)}
          </div>
        ) : (
          <div
            className="overflow-hidden"
            onMouseEnter={() => { pausedRef.current = true; }}
            onMouseLeave={() => { pausedRef.current = false; }}
          >
            <div
              ref={scrollRef}
              className="flex will-change-transform"
              style={{ gap: GAP }}
            >
              {items.map((p, i) => renderCard(p, i))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default PractitionersPreview;
