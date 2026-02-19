import { Link } from "react-router-dom";
import { Mail, Clock, MapPin, Phone, Globe, Facebook, Instagram, Linkedin, Twitter, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface DaySchedule {
  day: string;
  start: string;
  end: string;
}

interface SocialLinks {
  website?: string;
  facebook?: string;
  instagram?: string;
  linkedin?: string;
  twitter?: string;
  youtube?: string;
}

interface PractitionerInfoSidebarProps {
  practitioner: {
    first_name: string;
    last_name: string;
    specialty: string | null;
    phone: string | null;
    social_links?: SocialLinks | null;
  };
  scheduleSlots: { day: string; hours: string }[];
}

const SOCIAL_ICONS: { key: keyof SocialLinks; icon: React.ElementType; label: string }[] = [
  { key: "website", icon: Globe, label: "Site web" },
  { key: "facebook", icon: Facebook, label: "Facebook" },
  { key: "instagram", icon: Instagram, label: "Instagram" },
  { key: "linkedin", icon: Linkedin, label: "LinkedIn" },
  { key: "twitter", icon: Twitter, label: "Twitter / X" },
  { key: "youtube", icon: Youtube, label: "YouTube" },
];

const PractitionerInfoSidebar = ({ practitioner, scheduleSlots }: PractitionerInfoSidebarProps) => {
  const socialLinks = practitioner.social_links || {};
  const activeSocials = SOCIAL_ICONS.filter(({ key }) => socialLinks[key]);

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sticky top-28">
      <h3 className="font-display text-lg font-semibold mb-1">
        Prendre rendez-vous
      </h3>
      <p className="text-sm text-muted-foreground mb-5">
        Contactez {practitioner.first_name} pour organiser une consultation.
      </p>

      <Link to="/contact" className="block">
        <Button size="lg" className="w-full">
          <Mail className="h-4 w-4 mr-2" />
          Contacter
        </Button>
      </Link>

      {practitioner.phone && (
        <a href={`tel:${practitioner.phone}`} className="block mt-3">
          <Button variant="outline" size="lg" className="w-full">
            <Phone className="h-4 w-4 mr-2" />
            Appeler
          </Button>
        </a>
      )}

      {activeSocials.length > 0 && (
        <>
          <Separator className="my-5" />
          <div>
            <p className="text-sm font-semibold mb-3">Retrouvez-moi sur</p>
            <div className="flex flex-wrap gap-2">
              {activeSocials.map(({ key, icon: Icon, label }) => (
                <a
                  key={key}
                  href={socialLinks[key]}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={label}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border hover:bg-accent hover:text-foreground text-muted-foreground transition-colors"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </a>
              ))}
            </div>
          </div>
        </>
      )}

      {scheduleSlots.length > 0 && (
        <>
          <Separator className="my-5" />
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Horaires</span>
            </div>
            <ul className="space-y-2">
              {scheduleSlots.map((slot) => (
                <li
                  key={slot.day}
                  className="flex justify-between text-sm"
                >
                  <span className="text-muted-foreground">{slot.day}</span>
                  <span className="font-medium">{slot.hours}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
};

export default PractitionerInfoSidebar;
