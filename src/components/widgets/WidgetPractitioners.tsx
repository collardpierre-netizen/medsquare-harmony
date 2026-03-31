import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Award } from "lucide-react";
import type { WidgetConfig } from "@/pages/Widget";
import WidgetQRCode from "./WidgetQRCode";

interface Practitioner {
  id: string;
  first_name: string;
  last_name: string;
  specialty: string | null;
  avatar_url: string | null;
  bio: string | null;
}

const SITE_URL = "https://medsquare-harmony.lovable.app";

const WidgetPractitioners = ({ config }: { config: WidgetConfig }) => {
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number | null>(null);

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

  // Infinite seamless scroll for carousel — always active
  const startInfiniteScroll = useCallback(() => {
    if (config.template !== "carousel" || !scrollRef.current) return;
    const speed = 0.4;
    const el = scrollRef.current;

    const step = () => {
      if (!el) return;
      el.scrollLeft += speed;
      const halfWidth = el.scrollWidth / 2;
      if (el.scrollLeft >= halfWidth) {
        el.scrollLeft -= halfWidth;
      }
      animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
  }, [config.template]);

  useEffect(() => {
    if (practitioners.length === 0) return;
    // Small delay to ensure DOM is rendered with duplicated items
    const timer = setTimeout(() => startInfiniteScroll(), 100);
    return () => {
      clearTimeout(timer);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [practitioners, startInfiniteScroll]);

  // Always duplicate for carousel
  const loopItems = config.template === "carousel" && practitioners.length > 0
    ? [...practitioners, ...practitioners, ...practitioners]
    : practitioners;

  if (config.template === "carousel") {
    return (
      <div ref={scrollRef} className="flex gap-6 overflow-x-auto h-full items-center scrollbar-hide" style={{ scrollBehavior: "auto" }}>
        {loopItems.map((p, i) => (
          <div key={`${p.id}-${i}`} className="shrink-0 w-[280px] md:w-[320px] lg:w-[360px]">
            <div className="rounded-2xl overflow-hidden shadow-lg bg-card flex flex-col" style={{ height: "480px" }}>
              <div className="flex-1 bg-muted relative min-h-0">
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt={`${p.first_name} ${p.last_name}`} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><User className="h-16 w-16 text-muted-foreground/20" /></div>
                )}
              </div>
              <div className="p-4 h-[130px] flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-lg font-bold truncate">{p.first_name} {p.last_name}</h3>
                  <p className="text-sm text-primary flex items-center gap-1 mt-1 line-clamp-2">
                    <Award className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{p.specialty || "Praticien"}</span>
                  </p>
                </div>
                <WidgetQRCode url={`${SITE_URL}/praticiens/${p.id}`} size={56} />
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
            <div className="min-w-0 flex-1">
              <h3 className="font-display font-bold text-base truncate">{p.first_name} {p.last_name}</h3>
              {p.specialty && <p className="text-sm text-primary">{p.specialty}</p>}
              {p.bio && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{p.bio}</p>}
            </div>
            <WidgetQRCode url={`${SITE_URL}/praticiens/${p.id}`} size={48} />
          </div>
        ))}
      </div>
    );
  }

  // Default: grid
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 overflow-y-auto h-full content-start">
      {practitioners.map((p) => (
        <div key={p.id} className="rounded-2xl overflow-hidden shadow-sm bg-card flex flex-col" style={{ height: "360px" }}>
          <div className="flex-1 bg-muted relative min-h-0">
            {p.avatar_url ? (
              <img src={p.avatar_url} alt={`${p.first_name} ${p.last_name}`} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center"><User className="h-12 w-12 text-muted-foreground/20" /></div>
            )}
          </div>
          <div className="p-3 h-[100px] flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-display text-sm font-bold truncate">{p.first_name} {p.last_name}</h3>
              <p className="text-xs text-primary truncate">{p.specialty || "Praticien"}</p>
            </div>
            <WidgetQRCode url={`${SITE_URL}/praticiens/${p.id}`} size={44} />
          </div>
        </div>
      ))}
    </div>
  );
};

export default WidgetPractitioners;
