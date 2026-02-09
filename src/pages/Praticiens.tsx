import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { User, Award, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/layout/Layout";
import { Input } from "@/components/ui/input";
import CategoryPills from "@/components/activities/CategoryPills";

interface Practitioner {
  id: string;
  first_name: string;
  last_name: string;
  specialty: string | null;
  bio: string | null;
  avatar_url: string | null;
}

const Praticiens = () => {
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("all");

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

  // Derive unique specialties from data
  const specialtyOptions = useMemo(() => {
    const set = new Set<string>();
    practitioners.forEach((p) => {
      if (p.specialty) set.add(p.specialty);
    });
    const sorted = Array.from(set).sort((a, b) => a.localeCompare(b, "fr"));
    return [
      { value: "all", label: "Toutes les spécialités" },
      ...sorted.map((s) => ({ value: s, label: s })),
    ];
  }, [practitioners]);

  // Filter
  const filtered = useMemo(() => {
    return practitioners.filter((p) => {
      if (selectedSpecialty !== "all" && p.specialty !== selectedSpecialty) return false;
      if (search) {
        const q = search.toLowerCase();
        const fullName = `${p.first_name} ${p.last_name}`.toLowerCase();
        const spec = (p.specialty || "").toLowerCase();
        if (!fullName.includes(q) && !spec.includes(q)) return false;
      }
      return true;
    });
  }, [practitioners, search, selectedSpecialty]);

  return (
    <Layout>
      {/* Hero */}
      <section className="pt-12 pb-6">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="max-w-2xl"
          >
            <h1 className="font-display text-3xl md:text-4xl font-bold">
              Nos praticiens
            </h1>
            <p className="text-muted-foreground mt-2">
              Des professionnels qualifiés et passionnés, unis par une mission commune :
              prendre soin de vous.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Search + Specialty filters */}
      <section className="border-b border-border sticky top-[72px] z-30 bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 space-y-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un praticien…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-10"
            />
          </div>
          {specialtyOptions.length > 1 && (
            <CategoryPills
              categories={specialtyOptions}
              selected={selectedSpecialty}
              onSelect={setSelectedSpecialty}
            />
          )}
        </div>
      </section>

      {/* Grid */}
      <section className="py-8 pb-20">
        <div className="container mx-auto px-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <User className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-muted-foreground">
                {practitioners.length === 0
                  ? "Aucun praticien disponible pour le moment."
                  : "Aucun praticien ne correspond à votre recherche."}
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-5">
                {filtered.length} praticien{filtered.length > 1 ? "s" : ""}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filtered.map((practitioner, index) => (
                  <motion.div
                    key={practitioner.id}
                    initial={{ opacity: 0, y: 15 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: index * 0.04 }}
                  >
                    <Link to={`/praticiens/${practitioner.id}`} className="group block">
                      <div className="relative overflow-hidden rounded-xl aspect-[4/5] bg-muted mb-3">
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
                      {practitioner.bio && (
                        <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">
                          {practitioner.bio}
                        </p>
                      )}
                    </Link>
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </Layout>
  );
};

export default Praticiens;
