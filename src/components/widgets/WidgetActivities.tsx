import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, MapPin, Users, Clock } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { WidgetConfig } from "@/pages/Widget";
import WidgetQRCode from "./WidgetQRCode";

interface Activity {
  id: string;
  title: string;
  category: string;
  description: string | null;
  photo_url: string | null;
  photos: string[] | null;
  duration_minutes: number;
  location: string | null;
  max_participants: number | null;
  practitioner: { first_name: string; last_name: string; specialty: string | null } | null;
  next_session?: { start_time: string } | null;
}

const SITE_URL = "https://medsquare-harmony.lovable.app";

const ActivityCard = ({ a }: { a: Activity }) => {
  const imgUrl = a.photo_url || a.photos?.[0] || null;
  return (
    <div className="rounded-2xl overflow-hidden shadow-sm bg-card flex flex-col" style={{ height: "420px" }}>
      <div className="h-[180px] bg-muted shrink-0">
        {imgUrl ? (
          <img src={imgUrl} alt={a.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><Calendar className="h-12 w-12 text-muted-foreground/20" /></div>
        )}
      </div>
      <div className="p-4 flex-1 flex flex-col gap-1 min-h-0">
        <span className="text-[10px] uppercase tracking-widest text-primary font-semibold">{a.category}</span>
        <h3 className="font-display font-bold text-base truncate">{a.title}</h3>
        {a.practitioner && (
          <p className="text-xs text-muted-foreground truncate">
            {a.practitioner.first_name} {a.practitioner.last_name}
          </p>
        )}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-auto pt-2">
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{a.duration_minutes} min</span>
          {a.max_participants && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{a.max_participants} places</span>}
          {a.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{a.location}</span>}
        </div>
        <div className="flex items-end justify-between mt-1">
          <div className="min-w-0">
            {a.next_session && (
              <p className="text-xs font-medium text-primary flex items-center gap-1 truncate">
                <Calendar className="h-3 w-3 shrink-0" />
                Prochaine : {format(new Date(a.next_session.start_time), "EEE d MMM · HH:mm", { locale: fr })}
              </p>
            )}
          </div>
          <WidgetQRCode url={`${SITE_URL}/activites/${a.id}`} size={48} className="shrink-0 ml-2" />
        </div>
      </div>
    </div>
  );
};

const WidgetActivities = ({ config }: { config: WidgetConfig }) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("activities")
        .select("id, title, category, description, photo_url, photos, duration_minutes, location, max_participants, practitioner_id")
        .eq("is_active", true)
        .limit(config.settings.maxItems || 20);

      if (!data) return;

      const practitionerIds = [...new Set(data.map((a) => a.practitioner_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, specialty")
        .in("id", practitionerIds);

      const now = new Date().toISOString();
      const { data: sessions } = await supabase
        .from("activity_sessions")
        .select("activity_id, start_time")
        .in("activity_id", data.map((a) => a.id))
        .gte("start_time", now)
        .eq("status", "scheduled")
        .order("start_time")
        .limit(100);

      const enriched: Activity[] = data.map((a) => ({
        ...a,
        practitioner: profiles?.find((p) => p.id === a.practitioner_id) || null,
        next_session: sessions?.find((s) => s.activity_id === a.id) || null,
      }));

      setActivities(enriched);
    };
    fetch();
  }, [config.settings.maxItems]);

  // Measure one set width for CSS animation
  useEffect(() => {
    if (config.template !== "carousel" || activities.length === 0) return;
    const measure = () => {
      if (!trackRef.current) return;
      const children = Array.from(trackRef.current.children);
      const half = children.length / 2;
      let width = 0;
      for (let i = 0; i < half; i++) {
        width += (children[i] as HTMLElement).offsetWidth + 24;
      }
      setTrackWidth(width);
    };
    const timer = setTimeout(measure, 200);
    return () => clearTimeout(timer);
  }, [config.template, activities]);

  const loopItems = config.template === "carousel" && activities.length > 0
    ? [...activities, ...activities]
    : activities;

  const duration = activities.length * 5;

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
            animation: trackWidth > 0 ? `widgetScrollAct ${duration}s linear infinite` : "none",
            animationPlayState: paused ? "paused" : "running",
          }}
        >
          {loopItems.map((a, i) => (
            <div key={`${a.id}-${i}`} className="shrink-0 w-[300px] md:w-[360px]">
              <ActivityCard a={a} />
            </div>
          ))}
        </div>
        {trackWidth > 0 && (
          <style>{`
            @keyframes widgetScrollAct {
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
        {activities.map((a) => (
          <div key={a.id} className="flex items-center gap-4 p-4 rounded-xl bg-card shadow-sm">
            {(a.photo_url || a.photos?.[0]) && (
              <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-muted">
                <img src={(a.photo_url || a.photos?.[0])!} alt={a.title} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <span className="text-[10px] uppercase tracking-widest text-primary font-semibold">{a.category}</span>
              <h3 className="font-display font-bold text-sm truncate">{a.title}</h3>
              {a.practitioner && <p className="text-xs text-muted-foreground">{a.practitioner.first_name} {a.practitioner.last_name}</p>}
              {a.next_session && (
                <p className="text-xs font-medium text-primary mt-1">
                  {format(new Date(a.next_session.start_time), "EEE d MMM · HH:mm", { locale: fr })}
                </p>
              )}
            </div>
            <WidgetQRCode url={`${SITE_URL}/activites/${a.id}`} size={48} />
          </div>
        ))}
      </div>
    );
  }

  // grid
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto h-full content-start">
      {activities.map((a) => (
        <ActivityCard key={a.id} a={a} />
      ))}
    </div>
  );
};

export default WidgetActivities;
