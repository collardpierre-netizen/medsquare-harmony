import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/layout/Layout";

interface Practitioner {
  id: string;
  first_name: string;
  last_name: string;
  specialty: string | null;
  bio: string | null;
  avatar_url: string | null;
}

const DEFAULT_AVATAR = "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&h=500&fit=crop";

const Praticiens = () => {
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, specialty, bio, avatar_url")
        .eq("is_active", true)
        .order("last_name");
      setPractitioners(data || []);
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
              Notre équipe
            </span>
            <h1 className="font-display text-4xl md:text-5xl font-bold mt-3 mb-6">
              Nos praticiens
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Des professionnels qualifiés et passionnés, unis par une mission commune :
              prendre soin de vous avec expertise et humanité.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Grid */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : practitioners.length === 0 ? (
            <div className="text-center py-16">
              <User className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
              <p className="text-muted-foreground text-lg">
                Aucun praticien disponible pour le moment.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {practitioners.map((practitioner, index) => (
                <motion.div
                  key={practitioner.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.08 }}
                >
                  <Link to={`/praticiens/${practitioner.id}`} className="group block">
                    <div className="relative overflow-hidden rounded-xl mb-4 aspect-[4/5] bg-muted">
                      {practitioner.avatar_url ? (
                        <img
                          src={practitioner.avatar_url}
                          alt={`${practitioner.first_name} ${practitioner.last_name}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-accent">
                          <User className="h-20 w-20 text-muted-foreground/30" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-foreground/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>
                    <h3 className="font-display text-xl font-semibold group-hover:text-primary transition-colors">
                      {practitioner.first_name} {practitioner.last_name}
                    </h3>
                    {practitioner.specialty && (
                      <p className="text-primary text-sm font-medium mt-1">{practitioner.specialty}</p>
                    )}
                    {practitioner.bio && (
                      <p className="text-muted-foreground text-sm mt-2 line-clamp-2">{practitioner.bio}</p>
                    )}
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
};

export default Praticiens;
