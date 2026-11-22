import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Practitioner {
  id: string;
  first_name: string;
  last_name: string;
  specialty: string | null;
  avatar_url: string | null;
}

const MAX = 8;

const initials = (p: Practitioner) =>
  `${p.first_name?.[0] ?? ""}${p.last_name?.[0] ?? ""}`.toUpperCase();

const PractitionersPreview = () => {
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, specialty, avatar_url")
        .eq("is_active", true)
        .order("display_order" as any)
        .order("last_name");
      const list = data || [];
      // Ordre aléatoire à chaque visite, profils avec photo en priorité
      const shuffled = [...list];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const sorted = [...shuffled.filter((p) => p.avatar_url), ...shuffled.filter((p) => !p.avatar_url)];
      setTotal(list.length);
      setPractitioners(sorted.slice(0, MAX));
      setLoading(false);
    };
    fetchData();
  }, []);

  return (
    <section className="py-20 md:py-28">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
          <div>
            <p className="text-sm text-muted-foreground mb-4">{total > 0 ? `${total} praticiens` : "L'équipe"}</p>
            <h2 className="font-display font-normal text-4xl md:text-5xl leading-[1.05] tracking-tight max-w-xl text-balance">
              Ceux qui consultent au centre
            </h2>
          </div>
          <Link
            to="/praticiens"
            className="group inline-flex items-center gap-1.5 text-[15px] font-medium underline-offset-4 hover:underline shrink-0"
          >
            Voir tous les praticiens
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-10">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : practitioners.length === 0 ? (
          <p className="text-muted-foreground py-8">Aucun praticien disponible pour le moment.</p>
        ) : (
          <ul className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-10">
            {practitioners.map((p) => (
              <li key={p.id}>
                <Link to={`/praticiens/${p.id}`} className="group block">
                  <div className="relative overflow-hidden rounded-lg mb-4 aspect-[3/4] bg-accent">
                    {p.avatar_url ? (
                      <img
                        src={p.avatar_url}
                        alt={`${p.first_name} ${p.last_name}`}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full grid place-items-center font-display text-5xl text-primary/40">
                        {initials(p)}
                      </div>
                    )}
                  </div>
                  <h3 className="font-sans font-medium text-[15px] tracking-normal group-hover:underline underline-offset-4">
                    {p.first_name} {p.last_name}
                  </h3>
                  {p.specialty?.trim() && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2 leading-snug">{p.specialty}</p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default PractitionersPreview;
