import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DoorOpen, Users, Ruler } from "lucide-react";
import type { WidgetConfig } from "@/pages/Widget";

interface Room {
  id: string;
  name: string;
  description: string | null;
  capacity: number | null;
  surface_area: number | null;
  photos: string[] | null;
  floor: string | null;
}

const WidgetRooms = ({ config }: { config: WidgetConfig }) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("rooms")
        .select("id, name, description, capacity, surface_area, photos, floor")
        .eq("is_available", true)
        .limit(config.settings.maxItems || 20);
      setRooms(data || []);
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

  const RoomCard = ({ r }: { r: Room }) => (
    <div className="rounded-2xl overflow-hidden shadow-sm bg-card h-full flex flex-col">
      <div className="aspect-[16/9] bg-muted">
        {r.photos?.[0] ? (
          <img src={r.photos[0]} alt={r.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><DoorOpen className="h-12 w-12 text-muted-foreground/20" /></div>
        )}
      </div>
      <div className="p-4 flex-1 flex flex-col gap-1">
        <h3 className="font-display font-bold text-base">{r.name}</h3>
        {r.floor && <p className="text-xs text-muted-foreground">{r.floor}</p>}
        <div className="flex gap-3 text-xs text-muted-foreground mt-auto pt-2">
          {r.capacity && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{r.capacity} pers.</span>}
          {r.surface_area && <span className="flex items-center gap-1"><Ruler className="h-3 w-3" />{r.surface_area} m²</span>}
        </div>
      </div>
    </div>
  );

  if (config.template === "carousel") {
    return (
      <div ref={scrollRef} className="flex gap-6 overflow-x-auto h-full items-center scrollbar-hide snap-x snap-mandatory">
        {rooms.map((r) => (
          <div key={r.id} className="snap-start shrink-0 w-[300px] md:w-[360px]">
            <RoomCard r={r} />
          </div>
        ))}
      </div>
    );
  }

  if (config.template === "list") {
    return (
      <div className="space-y-3 overflow-y-auto h-full pr-2">
        {rooms.map((r) => (
          <div key={r.id} className="flex items-center gap-4 p-4 rounded-xl bg-card shadow-sm">
            <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-muted">
              {r.photos?.[0] ? (
                <img src={r.photos[0]} alt={r.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><DoorOpen className="h-6 w-6 text-muted-foreground/20" /></div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-display font-bold text-sm">{r.name}</h3>
              {r.description && <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto h-full content-start">
      {rooms.map((r) => <RoomCard key={r.id} r={r} />)}
    </div>
  );
};

export default WidgetRooms;
