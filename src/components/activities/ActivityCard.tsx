import { Link } from "react-router-dom";
import { Clock, Users, User } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface ActivityCardProps {
  activity: {
    id: string;
    title: string;
    description: string | null;
    category: string;
    duration_minutes: number;
    max_participants: number | null;
    photo_url: string | null;
    photos?: string[] | null;
    is_free?: boolean;
    price?: number | null;
    profiles?: {
      id?: string;
      first_name: string;
      last_name: string;
      specialty: string | null;
      avatar_url: string | null;
    };
  };
  nextSession?: {
    start_time: string;
    rooms?: { name: string } | null;
  } | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  yoga: "Yoga",
  pilates: "Pilates",
  meditation: "Méditation",
  fitness: "Fitness",
  danse: "Danse",
  sophrologie: "Sophrologie",
  nutrition: "Nutrition",
  autre: "Autre",
};

const STOCK_PHOTOS: Record<string, string> = {
  yoga: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&h=400&fit=crop",
  pilates: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=600&h=400&fit=crop",
  meditation: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=600&h=400&fit=crop",
  fitness: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=600&h=400&fit=crop",
  danse: "https://images.unsplash.com/photo-1504609773096-104ff2c73ba4?w=600&h=400&fit=crop",
  sophrologie: "https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=600&h=400&fit=crop",
  nutrition: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=600&h=400&fit=crop",
  autre: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=400&fit=crop",
};

const ActivityCard = ({ activity, nextSession }: ActivityCardProps) => {
  const photos = activity.photos?.length ? activity.photos : [];
  const photo = photos[0] || activity.photo_url || STOCK_PHOTOS[activity.category] || STOCK_PHOTOS.autre;
  const practitioner = activity.profiles;

  return (
    <Link to={`/activites/${activity.id}`} className="group block">
      {/* Photo */}
      <div className="relative overflow-hidden rounded-xl aspect-[4/3] bg-muted mb-3">
        <img
          src={photo}
          alt={activity.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute top-3 left-3">
          <span className="inline-flex items-center rounded-full bg-background/90 backdrop-blur-sm px-3 py-1 text-xs font-medium text-foreground shadow-sm">
            {CATEGORY_LABELS[activity.category] || activity.category}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-base font-semibold text-foreground group-hover:text-primary transition-colors truncate">
            {activity.title}
          </h3>
        </div>

        {practitioner && (
          <div className="flex items-center gap-2">
            {practitioner.avatar_url ? (
              <img
                src={practitioner.avatar_url}
                alt={practitioner.first_name}
                className="h-5 w-5 rounded-full object-cover"
              />
            ) : (
              <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center">
                <User className="h-3 w-3 text-muted-foreground" />
              </div>
            )}
            <span className="text-sm text-muted-foreground">
              {practitioner.first_name} {practitioner.last_name}
            </span>
          </div>
        )}

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {activity.duration_minutes} min
          </span>
          {activity.max_participants && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {activity.max_participants} pers.
            </span>
          )}
          <span className="font-medium">
            {activity.is_free !== false ? "Gratuit" : activity.price ? `${activity.price} €` : "Payant"}
          </span>
        </div>

        {nextSession && (
          <p className="text-xs text-primary font-medium">
            Prochaine séance · {format(new Date(nextSession.start_time), "EEE d MMM · HH:mm", { locale: fr })}
          </p>
        )}
      </div>
    </Link>
  );
};

export default ActivityCard;
