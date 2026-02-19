import { useEffect, useState } from "react";
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

const PractitionersPreview = () => {
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, specialty, avatar_url")
        .eq("is_active", true)
        .order("display_order" as any).order("last_name")
        .limit(4);
      setPractitioners(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

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
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {practitioners.map((practitioner, index) => (
              <motion.div
                key={practitioner.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
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
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default PractitionersPreview;
