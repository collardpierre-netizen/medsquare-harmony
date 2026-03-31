import { useEffect, useState, useRef } from "react";
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

const PractitionerCard = ({ p, height = "480px", qrSize = 56, nameSize = "text-lg" }: { p: Practitioner; height?: string; qrSize?: number; nameSize?: string }) => (
  <div className="shrink-0 w-[280px] md:w-[320px] lg:w-[360px]">
    <div className="rounded-2xl overflow-hidden shadow-lg bg-card flex flex-col" style={{ height }}>
      <div className="flex-1 bg-muted relative min-h-0">
        {p.avatar_url ? (
          <img src={p.avatar_url} alt={`${p.first_name} ${p.last_name}`} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><User className="h-16 w-16 text-muted-foreground/20" /></div>
        )}
      </div>
      <div className="p-4 h-[130px] flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <h3 className={`font-display ${nameSize} font-bold truncate`}>{p.first_name} {p.last_name}</h3>
          <p className="text-sm text-primary flex items-center gap-1 mt-1 line-clamp-2">
            <Award className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{p.specialty || "Praticien"}</span>
          </p>
        </div>
        <WidgetQRCode url={`${SITE_URL}/praticiens/${p.id}`} size={qrSize} />
      </div>
    </div>
  </div>
);

const WidgetPractitioners = ({ config }: { config: WidgetConfig }) => {
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const [paused, setPaused] = useState(false);

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

  // Measure one set width for CSS animation
  useEffect(() => {
    if (config.template !== "carousel" || practitioners.length === 0) return;
    const measure = () => {
      if (!trackRef.current) return;
      // Each set is half the total children (we duplicate once)
      const children = Array.from(trackRef.current.children);
      const half = children.length / 2;
      let width = 0;
      for (let i = 0; i < half; i++) {
        width += (children[i] as HTMLElement).offsetWidth + 24; // 24px = gap-6
      }
      setTrackWidth(width);
    };
    const timer = setTimeout(measure, 200);
    return () => clearTimeout(timer);
  }, [config.template, practitioners]);

  // Duplicate items once for seamless loop
  const loopItems = config.template === "carousel" && practitioners.length > 0
    ? [...practitioners, ...practitioners]
    : practitioners;

  const duration = practitioners.length * 5; // ~5s per card

  if (config.template === "carousel") {
    return (
      <div
        className="overflow-hidden h-full flex items-center"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div
          ref={trackRef}
          className="flex gap-6 items-center"
          style={{
            animation: trackWidth > 0 ? `widgetScroll ${duration}s linear infinite` : "none",
            animationPlayState: paused ? "paused" : "running",
          }}
        >
          {loopItems.map((p, i) => (
            <PractitionerCard key={`${p.id}-${i}`} p={p} />
          ))}
        </div>
        {trackWidth > 0 && (
          <style>{`
            @keyframes widgetScroll {
              0% { transform: translateX(0); }
              100% { transform: translateX(-${trackWidth}px); }
            }
          `}</style>
        )}
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
