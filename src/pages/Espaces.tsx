import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Users, DoorOpen, Euro, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";

import { isRoomBlockedNow } from "@/lib/roomPrivatization";
import RoomStatusBadge from "@/components/rooms/RoomStatusBadge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PricingItem {
  label: string;
  price: number;
}

interface Room {
  id: string;
  name: string;
  description: string | null;
  capacity: number | null;
  hourly_rate: number | null;
  equipment: string[] | null;
  photos: string[] | null;
  pricing: PricingItem[] | null;
  credits_info: string | null;
  is_available: boolean;
  privatized_from: string | null;
  privatized_until: string | null;
}

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=800&h=500&fit=crop";

const Espaces = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [pricingRoom, setPricingRoom] = useState<Room | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("rooms")
        .select("id, name, description, capacity, hourly_rate, equipment, photos, pricing, credits_info, is_available, privatized_from, privatized_until")
        .order("name");
      setRooms((data as unknown as Room[]) || []);
      setLoading(false);
    };
    fetch();
  }, []);

  return (
    <Layout>
      {/* Hero */}
      <section className="py-20 md:py-28 bg-warm">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl mx-auto text-center"
          >
            <span className="text-primary text-sm font-medium tracking-widest uppercase">
              Nos locaux
            </span>
            <h1 className="font-display text-4xl md:text-5xl font-bold mt-3 mb-6">
              Nos espaces
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Des salles modernes et équipées, disponibles à la location pour les professionnels de santé.
              Chaque espace est conçu pour offrir le meilleur cadre de travail.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Spaces list */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : rooms.length === 0 ? (
            <div className="text-center py-16">
              <DoorOpen className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
              <p className="text-muted-foreground text-lg">
                Aucun espace disponible pour le moment.
              </p>
            </div>
          ) : (
            <div className="space-y-16">
              {rooms.map((room, index) => {
                const imageUrl = room.photos && room.photos.length > 0
                  ? room.photos[0]
                  : DEFAULT_IMAGE;

                const blocked = isRoomBlockedNow(room);

                return (
                  <motion.div
                    key={room.id}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center"
                  >
                    <div className={index % 2 === 1 ? "lg:order-2" : ""}>
                      <div className="overflow-hidden rounded-xl bg-muted">
                        <img
                          src={imageUrl}
                          alt={room.name}
                          className="w-full aspect-[16/10] object-cover hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                        />
                      </div>
                    </div>
                    <div className={index % 2 === 1 ? "lg:order-1" : ""}>
                      <h3 className="font-display text-2xl font-bold mb-3 flex items-center flex-wrap gap-2">
                        <span>{room.name}</span>
                        <RoomStatusBadge room={room} />
                      </h3>
                      <p className="text-muted-foreground leading-relaxed mb-4">
                        {room.description || "Un espace de qualité pour vos consultations."}
                      </p>

                      <div className="flex items-center gap-4 mb-4">
                        {room.capacity && (
                          <div className="flex items-center gap-2 text-sm">
                            <Users className="h-4 w-4 text-primary" />
                            <span>{room.capacity} {room.capacity > 1 ? "personnes" : "personne"}</span>
                          </div>
                        )}
                        {room.hourly_rate != null && room.hourly_rate > 0 && (
                          <span className="text-primary font-semibold">
                            {room.hourly_rate}€/h
                          </span>
                        )}
                      </div>

                      {room.equipment && room.equipment.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-6">
                          {room.equipment.map((eq) => (
                            <span
                              key={eq}
                              className="px-3 py-1.5 rounded-full bg-accent text-accent-foreground text-xs"
                            >
                              {eq}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        <Link to={`/espaces/${room.id}`}>
                          <Button>Voir les détails</Button>
                        </Link>
                        {!blocked ? (
                          <Button
                            variant="outline"
                            onClick={() => setPricingRoom(room)}
                          >
                            <Euro className="h-4 w-4 mr-1.5" />
                            Voir les tarifs
                          </Button>
                        ) : (
                          <Link to="/contact">
                            <Button variant="outline">
                              Nous contacter
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Pricing Dialog */}
      <Dialog open={!!pricingRoom} onOpenChange={(open) => !open && setPricingRoom(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {pricingRoom && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-lg">
                  Tarifs – {pricingRoom.name}
                </DialogTitle>
              </DialogHeader>

              {pricingRoom.credits_info && (
                <p className="text-sm text-primary font-medium">{pricingRoom.credits_info}</p>
              )}
              <p className="text-xs text-muted-foreground">Tous les tarifs sont indiqués HTVA.</p>

              {/* Hourly rate highlight */}
              {pricingRoom.hourly_rate != null && pricingRoom.hourly_rate > 0 && (
                <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card mt-2">
                  <span className="font-medium">Tarif horaire</span>
                  <span className="font-display font-bold text-primary">
                    {pricingRoom.hourly_rate} € / h
                  </span>
                </div>
              )}

              {/* Pricing grid */}
              {pricingRoom.pricing && pricingRoom.pricing.length > 0 ? (
                <div className="mt-4">
                  <h3 className="font-semibold text-sm mb-3">Autres forfaits</h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                    {pricingRoom.pricing.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between py-2.5 border-b border-border/50"
                      >
                        <span className="text-sm text-primary font-medium">{item.label}</span>
                        <span className="text-sm font-semibold tabular-nums">{item.price}€</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mt-4">
                  Aucun forfait configuré pour cet espace.
                </p>
              )}

              <p className="text-xs text-muted-foreground mt-4">
                Besoin d'un devis ou d'un forfait personnalisé ?{" "}
                <Link to="/contact" className="text-primary hover:underline">
                  Contactez-nous
                </Link>.
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Espaces;
