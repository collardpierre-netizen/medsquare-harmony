import { useEffect, useState } from "react";
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

const SpacesPreview = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("rooms")
        .select("id, name, description, photos")
        .eq("is_available", true)
        .order("name")
        .limit(3);
      setRooms(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

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
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {rooms.map((room, index) => {
              const imageUrl = room.photos && room.photos.length > 0
                ? room.photos[0]
                : DEFAULT_IMAGE;

              return (
                <motion.div
                  key={room.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="group"
                >
                  <Link to="/espaces" className="block">
                    <div className="relative overflow-hidden rounded-xl mb-4 aspect-[3/2] bg-muted">
                      <img
                        src={imageUrl}
                        alt={room.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    </div>
                    <h3 className="font-display text-xl font-semibold mb-1 group-hover:text-primary transition-colors">
                      {room.name}
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      {room.description || "Un espace de qualité pour vos consultations."}
                    </p>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default SpacesPreview;
