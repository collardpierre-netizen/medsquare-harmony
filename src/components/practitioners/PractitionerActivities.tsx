import { Link } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Clock, Users, Calendar, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface ActivityWithSessions {
  id: string;
  title: string;
  category: string;
  description: string | null;
  duration_minutes: number;
  max_participants: number | null;
  photo_url?: string | null;
  activity_sessions: {
    id: string;
    start_time: string;
    end_time: string;
    rooms: { name: string } | null;
  }[];
}

const STOCK_PHOTOS: Record<string, string> = {
  yoga: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&h=300&fit=crop",
  pilates: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=400&h=300&fit=crop",
  meditation: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400&h=300&fit=crop",
  fitness: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&h=300&fit=crop",
  danse: "https://images.unsplash.com/photo-1504609773096-104ff2c73ba4?w=400&h=300&fit=crop",
  sophrologie: "https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=400&h=300&fit=crop",
  nutrition: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=400&h=300&fit=crop",
  autre: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop",
};

interface Props {
  activities: ActivityWithSessions[];
}

const PractitionerActivities = ({ activities }: Props) => {
  if (activities.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl font-semibold">Activités proposées</h2>
        <Link to="/activites">
          <Button variant="ghost" size="sm" className="text-sm group">
            Tout voir
            <ArrowRight className="h-3.5 w-3.5 ml-1 group-hover:translate-x-0.5 transition-transform" />
          </Button>
        </Link>
      </div>

      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4">
          {activities.map((activity) => {
            const photo = activity.photo_url || STOCK_PHOTOS[activity.category] || STOCK_PHOTOS.autre;
            const nextSession = activity.activity_sessions[0];

            return (
              <div
                key={activity.id}
                className="min-w-[260px] max-w-[280px] flex-shrink-0 rounded-xl border border-border overflow-hidden bg-card hover:shadow-md transition-shadow group"
              >
                <div className="aspect-[4/3] overflow-hidden">
                  <img
                    src={photo}
                    alt={activity.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-medium text-accent-foreground">
                      {activity.category}
                    </span>
                  </div>
                  <h3 className="font-display text-sm font-semibold line-clamp-1">
                    {activity.title}
                  </h3>
                  {activity.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {activity.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {activity.duration_minutes} min
                    </span>
                    {activity.max_participants && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {activity.max_participants}
                      </span>
                    )}
                  </div>
                  {nextSession && (
                    <div className="flex items-center gap-1.5 text-xs text-primary font-medium pt-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(nextSession.start_time), "EEE d MMM · HH:mm", { locale: fr })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
};

export default PractitionerActivities;
