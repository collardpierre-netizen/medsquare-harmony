import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Award } from "lucide-react";
import type { WidgetConfig } from "@/pages/Widget";

interface Practitioner {
  id: string;
  first_name: string;
  last_name: string;
  specialty: string | null;
  avatar_url: string | null;
  bio: string | null;
}

const WidgetPractitioners = ({ config }: { config: WidgetConfig }) => {
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, specialty, avatar_url, bio")
        .eq("is_active", true)
        .order("display_order")
        .order("last_name")
        .limit(config.settings.maxItems || 20);
      setPractitioners(data || []);
    };
    fetch();
  }, [config.settings.maxItems]);

  // Auto-scroll for carousel
  useEffect(() => {
    if (config.template !== "carousel" || !config.settings.autoScroll || !scrollRef.current) return;
    const interval = setInterval(() => {
      const el = scrollRef.current;
      if (!el) return;
      if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 10) {
        el.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        el.scrollBy({ left: el.clientWidth * 0.8, behavior: "smooth" });
      }
    }, (config.settings.scrollInterval || 5) * 1000);
    return () => clearInterval(interval);
  }, [config.template, config.settings.autoScroll, config.settings.scrollInterval]);

  if (config.template === "carousel") {
    return (
      <div ref={scrollRef} className="flex gap-6 overflow-x-auto h-full items-center scrollbar-hide snap-x snap-mandatory">
        {practitioners.map((p) => (
          <div key={p.id} className="snap-start shrink-0 w-[280px] md:w-[320px] lg:w-[360px]">
            <div className="rounded-2xl overflow-hidden shadow-lg bg-card h-full">
              <div className="aspect-[3/4] bg-muted relative">
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt={`${p.first_name} ${p.last_name}`} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><User className="h-16 w-16 text-muted-foreground/20" /></div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-display text-lg font-bold">{p.first_name} {p.last_name}</h3>
                {p.specialty && (
                  <p className="text-sm text-primary flex items-center gap-1 mt-1"><Award className="h-3.5 w-3.5" />{p.specialty}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (config.template === "list") {
    return (
      <div className="space-y-3 overflow-y-auto h-full pr-2">
        {practitioners.map((p) => (
          <div key={p.id} className="flex items-center gap-4 p-4 rounded-xl bg-card shadow-sm">
            <div className="w-16 h-16 rounded-full overflow-hidden shrink-0 bg-muted">
              {p.avatar_url ? (
                <img src={p.avatar_url} alt={`${p.first_name} ${p.last_name}`} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><User className="h-6 w-6 text-muted-foreground/20" /></div>
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-display font-bold text-base truncate">{p.first_name} {p.last_name}</h3>
              {p.specialty && <p className="text-sm text-primary">{p.specialty}</p>}
              {p.bio && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{p.bio}</p>}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Default: grid
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 overflow-y-auto h-full content-start">
      {practitioners.map((p) => (
        <div key={p.id} className="rounded-2xl overflow-hidden shadow-sm bg-card">
          <div className="aspect-[3/4] bg-muted relative">
            {p.avatar_url ? (
              <img src={p.avatar_url} alt={`${p.first_name} ${p.last_name}`} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center"><User className="h-12 w-12 text-muted-foreground/20" /></div>
            )}
          </div>
          <div className="p-3">
            <h3 className="font-display text-sm font-bold truncate">{p.first_name} {p.last_name}</h3>
            {p.specialty && <p className="text-xs text-primary truncate">{p.specialty}</p>}
          </div>
        </div>
      ))}
    </div>
  );
};

export default WidgetPractitioners;
