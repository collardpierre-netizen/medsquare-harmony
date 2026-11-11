import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Room {
  id: string;
  name: string;
  description: string | null;
  photos: string[] | null;
}

// Salle polyvalente / grande salle en premier, puis les cabinets dans l'ordre
const sortRooms = (rooms: Room[]) =>
  [...rooms].sort((a, b) => {
    const big = (r: Room) => (/salle|polyvalent/i.test(r.name) ? 0 : 1);
    return big(a) - big(b) || a.name.localeCompare(b.name, "fr", { numeric: true });
  });

const SpacesPreview = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase
        .from("rooms")
        .select("id, name, description, photos")
        .eq("is_available", true)
        .order("name");
      setRooms(sortRooms(data || []));
      setLoading(false);
    };
    fetchData();
  }, []);

  return (
    <>
      <section className="py-20 md:py-28 bg-warm">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
            <div>
              <p className="text-sm text-muted-foreground mb-4">Les lieux</p>
              <h2 className="font-display font-normal text-4xl md:text-5xl leading-[1.05] tracking-tight max-w-xl text-balance">
                Des cabinets au calme, une grande salle lumineuse
              </h2>
            </div>
            <Link
              to="/espaces"
              className="group inline-flex items-center gap-1.5 text-[15px] font-medium underline-offset-4 hover:underline shrink-0"
            >
              Tous les espaces
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          {loading ? (
            <div className="grid md:grid-cols-3 gap-5">
              <div className="md:col-span-2 aspect-[16/10] rounded-lg bg-muted animate-pulse" />
              <div className="aspect-[4/3] rounded-lg bg-muted animate-pulse" />
            </div>
          ) : rooms.length === 0 ? (
            <p className="text-muted-foreground py-8">Aucun espace disponible pour le moment.</p>
          ) : (
            <ul className="grid md:grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-10">
              {rooms.map((room, i) => {
                const photo = room.photos?.[0];
                const featured = i === 0 && rooms.length > 2;
                return (
                  <li key={room.id} className={cn(featured && "lg:col-span-2 lg:row-span-2")}>
                    <Link to={`/espaces/${room.id}`} className="group block">
                      <div
                        className={cn(
                          "relative overflow-hidden rounded-lg bg-muted mb-4",
                          featured ? "aspect-[4/3] lg:aspect-[16/11]" : "aspect-[4/3]",
                        )}
                      >
                        {photo && (
                          <img
                            src={photo}
                            alt={room.name}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                            loading="lazy"
                          />
                        )}
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className={cn("font-display", featured ? "text-3xl" : "text-xl")}>{room.name}</h3>
                          {room.description && (
                            <p
                              className={cn(
                                "text-muted-foreground leading-relaxed mt-1.5",
                                featured ? "line-clamp-3 max-w-xl" : "line-clamp-2 text-sm",
                              )}
                            >
                              {room.description}
                            </p>
                          )}
                        </div>
                        <ArrowUpRight className="h-5 w-5 mt-1.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Appel aux praticiens */}
      <section className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-16 md:py-20 grid lg:grid-cols-12 gap-8 items-end">
          <div className="lg:col-span-7">
            <p className="text-sm text-primary-foreground/70 mb-4">Vous êtes praticien ?</p>
            <h2 className="font-display font-normal text-4xl md:text-5xl leading-[1.05] tracking-tight text-balance">
              Installez votre pratique à Medsquare.
            </h2>
          </div>
          <div className="lg:col-span-5">
            <p className="text-primary-foreground/80 leading-relaxed mb-6">
              Cabinets équipés à louer à l'heure ou au forfait mensuel, réservation en ligne, parking pour vos
              patients et des confrères de disciplines complémentaires sous le même toit.
            </p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link to="/contact">
                <Button size="lg" variant="secondary" className="h-12 px-6 rounded-full text-[15px]">
                  Visiter le centre
                </Button>
              </Link>
              <Link
                to="/espaces"
                className="group inline-flex items-center gap-1.5 text-[15px] font-medium underline-offset-4 hover:underline"
              >
                Voir les disponibilités
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default SpacesPreview;
