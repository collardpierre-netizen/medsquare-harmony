import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, DoorOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface Room {
  id: string;
  name: string;
  description: string | null;
  photos: string[] | null;
}

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=600&h=400&fit=crop";

const CARD_WIDTH = 380; // px
const GAP = 24; // px
const SPEED = 0.4; // px per frame

const SpacesPreview = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const rafRef = useRef<number>(0);
  const pausedRef = useRef(false);

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase
        .from("rooms")
        .select("id, name, description, photos")
        .eq("is_available", true)
        .order("name");
      setRooms(data || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  // Infinite scroll animation
  useEffect(() => {
    if (rooms.length < 2) return;
    const el = scrollRef.current;
    if (!el) return;

    const totalWidth = rooms.length * (CARD_WIDTH + GAP);

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
  }, [rooms]);

  // Triple list for seamless loop
  const items = rooms.length >= 2
    ? [...rooms, ...rooms, ...rooms]
    : rooms;

  const renderCard = (room: Room, index: number) => {
    const imageUrl = room.photos && room.photos.length > 0 ? room.photos[0] : DEFAULT_IMAGE;
    return (
      <div
        key={`${room.id}-${index}`}
        className="flex-shrink-0"
        style={{ width: CARD_WIDTH }}
      >
        <Link to="/espaces" className="group block">
          <div className="relative overflow-hidden rounded-xl mb-4 aspect-[3/2] bg-muted">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={room.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-accent">
                <DoorOpen className="h-12 w-12 text-muted-foreground/20" />
              </div>
            )}
          </div>
          <h3 className="font-display text-xl font-semibold mb-1 group-hover:text-primary transition-colors">
            {room.name}
          </h3>
          <p className="text-muted-foreground text-sm line-clamp-3">
            {room.description || "Un espace de qualité pour vos consultations."}
          </p>
        </Link>
      </div>
    );
  };

  return (
    <section className="py-20 md:py-28 bg-warm">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex flex-col md:flex-row md:items-end md:justify-between mb-12"
        >
          <div>
            <span className="text-primary text-sm font-medium tracking-widest uppercase">
              Nos locaux
            </span>
            <h2 className="font-display text-3xl md:text-4xl font-bold mt-3 mb-2">
              Des espaces pensés pour vous
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl">
              Des salles modernes et chaleureuses, conçues pour offrir le meilleur environnement de soins.
            </p>
          </div>
          <Link to="/espaces" className="mt-4 md:mt-0">
            <Button variant="ghost" className="group">
              Découvrir nos espaces
              <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : rooms.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Aucun espace disponible pour le moment.
          </p>
        ) : rooms.length === 1 ? (
          <div className="flex justify-center">
            {renderCard(rooms[0], 0)}
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
              {items.map((r, i) => renderCard(r, i))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default SpacesPreview;
