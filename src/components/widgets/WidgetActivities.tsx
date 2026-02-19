import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, MapPin, Users, Clock } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { WidgetConfig } from "@/pages/Widget";

interface Activity {
  id: string;
  title: string;
  category: string;
  description: string | null;
  photo_url: string | null;
  duration_minutes: number;
  location: string | null;
  max_participants: number | null;
  practitioner: { first_name: string; last_name: string; specialty: string | null } | null;
  next_session?: { start_time: string } | null;
}

const WidgetActivities = ({ config }: { config: WidgetConfig }) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("activities")
        .select("id, title, category, description, photo_url, duration_minutes, location, max_participants, practitioner_id")
        .eq("is_active", true)
        .limit(config.settings.maxItems || 20);

      if (!data) return;

      // Fetch practitioner names and next sessions
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

  const ActivityCard = ({ a }: { a: Activity }) => (
    <div className="rounded-2xl overflow-hidden shadow-sm bg-card h-full flex flex-col">
      {a.photo_url && (
        <div className="aspect-[16/9] bg-muted">
          <img src={a.photo_url} alt={a.title} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-4 flex-1 flex flex-col gap-2">
        <span className="text-[10px] uppercase tracking-widest text-primary font-semibold">{a.category}</span>
        <h3 className="font-display font-bold text-base">{a.title}</h3>
        {a.practitioner && (
          <p className="text-xs text-muted-foreground">
            {a.practitioner.first_name} {a.practitioner.last_name}
          </p>
        )}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-auto pt-2">
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{a.duration_minutes} min</span>
          {a.max_participants && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{a.max_participants} places</span>}
          {a.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{a.location}</span>}
        </div>
        {a.next_session && (
          <p className="text-xs font-medium text-primary mt-1 flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Prochaine : {format(new Date(a.next_session.start_time), "EEE d MMM · HH:mm", { locale: fr })}
          </p>
        )}
      </div>
    </div>
  );

  if (config.template === "carousel") {
    return (
      <div ref={scrollRef} className="flex gap-6 overflow-x-auto h-full items-center scrollbar-hide snap-x snap-mandatory">
        {activities.map((a) => (
          <div key={a.id} className="snap-start shrink-0 w-[300px] md:w-[360px]">
            <ActivityCard a={a} />
          </div>
        ))}
      </div>
    );
  }

  if (config.template === "list") {
    return (
      <div className="space-y-3 overflow-y-auto h-full pr-2">
        {activities.map((a) => (
          <div key={a.id} className="flex items-center gap-4 p-4 rounded-xl bg-card shadow-sm">
            {a.photo_url && (
              <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-muted">
                <img src={a.photo_url} alt={a.title} className="w-full h-full object-cover" />
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
