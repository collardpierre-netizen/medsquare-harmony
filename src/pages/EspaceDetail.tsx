import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Users, Euro, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import RoomPhotoGallery from "@/components/rooms/RoomPhotoGallery";
import RoomAvailability from "@/components/rooms/RoomAvailability";

const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=1200&h=600&fit=crop";

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
}

interface Booking {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
}

const EspaceDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [room, setRoom] = useState<Room | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;

      const { data: r } = await supabase
        .from("rooms")
        .select("id, name, description, capacity, hourly_rate, equipment, photos, pricing, credits_info")
        .eq("id", id)
        .eq("is_available", true)
        .maybeSingle();

      if (!r) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setRoom(r as unknown as Room);

      // Fetch upcoming bookings for availability display (next 14 days)
      const now = new Date();
      const twoWeeksLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

      const { data: bk } = await supabase
        .from("bookings")
        .select("id, start_time, end_time, status, notes")
        .eq("room_id", id)
        .gte("start_time", now.toISOString())
        .lte("start_time", twoWeeksLater.toISOString())
        .in("status", ["confirmed", "pending"])
        .order("start_time");

      setBookings((bk || []) as Booking[]);
      setLoading(false);
    };

    fetchData();
  }, [id]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      </Layout>
    );
  }

  if (notFound || !room) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <h1 className="font-display text-3xl font-bold mb-4">
              Espace introuvable
            </h1>
            <Link to="/espaces">
              <Button>Retour aux espaces</Button>
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  const photos =
    room.photos && room.photos.length > 0 ? room.photos : [DEFAULT_IMAGE];

  const isPrivatized = bookings.some((b) => b.notes?.includes("[Privatisé]"));

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <Link
          to="/espaces"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Espaces
        </Link>

        {/* Photo gallery */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <RoomPhotoGallery photos={photos} roomName={room.name} />
        </motion.div>

        {/* Grid: content + sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-10 items-start">
          {/* Left — main content */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <h1 className="font-display text-3xl md:text-4xl font-bold mb-3">
              {room.name}
              {isPrivatized && (
                <Badge variant="secondary" className="ml-3 bg-destructive/10 text-destructive border-destructive/20 text-xs gap-1">
                  <Lock className="h-3 w-3" />
                  Espace privatisé
                </Badge>
              )}
            </h1>

            {/* Meta pills */}
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-6">
              {room.capacity && (
                <span className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-primary" />
                  {room.capacity} {room.capacity > 1 ? "personnes" : "personne"}
                </span>
              )}
              {room.hourly_rate != null && room.hourly_rate > 0 && (
                <span className="flex items-center gap-1.5">
                  <Euro className="h-4 w-4 text-primary" />
                  {room.hourly_rate}€ / heure
                </span>
              )}
            </div>

            <Separator className="mb-6" />

            {/* Description */}
            <div className="mb-8">
              <h2 className="font-display text-xl font-semibold mb-3">
                Description
              </h2>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                {room.description ||
                  "Un espace de qualité pour vos consultations et activités."}
              </p>
            </div>

            {/* Equipment */}
            {room.equipment && room.equipment.length > 0 && (
              <>
                <Separator className="mb-8" />
                <div className="mb-8">
                  <h2 className="font-display text-xl font-semibold mb-4">
                    Équipements
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {room.equipment.map((eq) => (
                      <div
                        key={eq}
                        className="flex items-center gap-2 p-3 rounded-xl border border-border bg-card text-sm"
                      >
                        <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                        {eq}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Pricing */}
            {room.pricing && room.pricing.length > 0 && (
              <>
                <Separator className="mb-8" />
                <div id="tarifs" className="mb-8 scroll-mt-24">
                  <h2 className="font-display text-xl font-semibold mb-2">
                    Tarifs – {room.name}
                  </h2>
                  {room.credits_info && (
                    <p className="text-sm text-muted-foreground mb-1">{room.credits_info}</p>
                  )}
                  <p className="text-xs text-muted-foreground mb-4">Tous les tarifs sont indiqués HTVA.</p>

                  {/* Hourly rate highlight */}
                  {room.hourly_rate != null && room.hourly_rate > 0 && (
                    <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card mb-4">
                      <span className="font-medium">Tarif horaire</span>
                      <span className="font-display font-bold text-primary">{room.hourly_rate} € / h</span>
                    </div>
                  )}

                  {/* Other packages */}
                  <h3 className="font-semibold text-sm mb-3">Autres forfaits</h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                    {room.pricing.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between py-2.5 border-b border-border/50"
                      >
                        <span className="text-sm text-primary font-medium">{item.label}</span>
                        <span className="text-sm font-semibold tabular-nums">{item.price}</span>
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-muted-foreground mt-4">
                    Besoin d'un devis ou d'un forfait personnalisé ?{" "}
                    <Link to="/contact" className="text-primary hover:underline">Contactez-nous</Link>.
                  </p>
                </div>
              </>
            )}

            <Separator className="mb-8" />

            {/* Availability */}
            <div className="mb-8">
              <h2 className="font-display text-xl font-semibold mb-4">
                Disponibilités (14 prochains jours)
              </h2>
              <RoomAvailability bookings={bookings} />
            </div>
          </motion.div>

          {/* Right sidebar — booking CTA */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="hidden lg:block"
          >
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sticky top-28">
              {isPrivatized ? (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <Lock className="h-5 w-5 text-destructive" />
                    <h3 className="font-display text-lg font-semibold">
                      Espace privatisé
                    </h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-5">
                    Cet espace est actuellement réservé de manière exclusive et n'est pas disponible à la location.
                  </p>
                  <Link to="/contact">
                    <Button variant="outline" className="w-full" size="lg">
                      Nous contacter pour plus d'infos
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <h3 className="font-display text-lg font-semibold mb-2">
                    Réserver cet espace
                  </h3>
                  <p className="text-sm text-muted-foreground mb-5">
                    Contactez-nous pour réserver cette salle ou obtenir plus
                    d'informations sur les tarifs et disponibilités.
                  </p>

                  {room.hourly_rate != null && room.hourly_rate > 0 && (
                    <div className="flex items-baseline gap-1 mb-5">
                      <span className="font-display text-3xl font-bold text-primary">
                        {room.hourly_rate}€
                      </span>
                      <span className="text-muted-foreground text-sm">/ heure</span>
                    </div>
                  )}

                  <div className="space-y-3 text-sm mb-6">
                    {room.capacity && (
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        <span>Capacité : {room.capacity} personne{room.capacity > 1 ? "s" : ""}</span>
                      </div>
                    )}
                    {room.equipment && room.equipment.length > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 flex items-center justify-center text-primary font-bold text-xs">✓</div>
                        <span>{room.equipment.length} équipement{room.equipment.length > 1 ? "s" : ""} inclus</span>
                      </div>
                    )}
                  </div>

                  <Link to="/contact">
                    <Button className="w-full" size="lg">
                      Contactez-nous
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        </div>

        {/* Mobile CTA */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border p-4 z-40">
          <div className="flex items-center justify-between gap-4 max-w-lg mx-auto">
            <div>
              <p className="font-display font-semibold text-sm">{room.name}</p>
              {isPrivatized ? (
                <p className="text-xs text-destructive font-medium flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Privatisé
                </p>
              ) : room.hourly_rate != null && room.hourly_rate > 0 ? (
                <p className="text-xs text-primary font-medium">
                  {room.hourly_rate}€/h
                </p>
              ) : null}
            </div>
            <Link to="/contact">
              <Button size="sm" variant={isPrivatized ? "outline" : "default"}>
                {isPrivatized ? "Nous contacter" : "Réserver"}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default EspaceDetail;
