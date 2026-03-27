import { User, MapPin, Award, Video, Home, Accessibility, ParkingCircle, Share2, FileText, CalendarPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

interface PractitionerHeroProps {
  practitioner: {
    first_name: string;
    last_name: string;
    specialty: string | null;
    avatar_url: string | null;
    accepts_new_patients?: boolean;
    conventioned?: boolean | null;
    inami_number?: string | null;
    languages?: string[];
    video_available?: boolean;
    home_visit?: boolean;
    pmr_accessible?: boolean;
    parking?: boolean;
    avg_appointment_delay_days?: number | null;
  };
  hasBookableActivities: boolean;
  onBookClick: () => void;
}

const PractitionerHero = ({ practitioner, hasBookableActivities, onBookClick }: PractitionerHeroProps) => {
  const { toast } = useToast();
  const fullName = `${practitioner.first_name} ${practitioner.last_name}`;
  const initials = `${practitioner.first_name?.[0] || ""}${practitioner.last_name?.[0] || ""}`.toUpperCase();

  const handleShare = (type: "copy" | "whatsapp" | "email") => {
    const url = window.location.href;
    const text = `${fullName} — Praticien sur MedSquare`;

    switch (type) {
      case "copy":
        navigator.clipboard.writeText(url);
        toast({ title: "Lien copié !", description: "Le lien a été copié dans le presse-papier." });
        break;
      case "whatsapp":
        window.open(`https://wa.me/?text=${encodeURIComponent(text + "\n" + url)}`, "_blank");
        break;
      case "email":
        window.location.href = `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}`;
        break;
    }
  };

  const handlePrint = () => window.print();

  const badges: { label: string; icon?: React.ElementType; show: boolean }[] = [
    { label: "Conventionné(e)", show: !!practitioner.conventioned },
    { label: `INAMI ${practitioner.inami_number || ""}`.trim(), show: !!practitioner.inami_number },
    { label: (practitioner.languages || []).join(", "), show: (practitioner.languages || []).length > 0 },
    { label: "Vidéo", icon: Video, show: !!practitioner.video_available },
    { label: "Domicile", icon: Home, show: !!practitioner.home_visit },
  ];

  return (
    <div className="relative rounded-2xl border border-border bg-card overflow-hidden print:border-0 print:shadow-none">
      <div className="flex flex-col md:flex-row gap-6 p-6 md:p-8">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="w-28 h-28 md:w-36 md:h-36 rounded-2xl overflow-hidden bg-accent">
            {practitioner.avatar_url ? (
              <img src={practitioner.avatar_url} alt={fullName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-3xl md:text-4xl font-display font-bold text-primary">{initials}</span>
              </div>
            )}
          </div>
          {practitioner.accepts_new_patients !== false && (
            <span className="absolute -bottom-1 -right-1 flex h-5 w-5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex rounded-full h-5 w-5 bg-primary border-2 border-card" />
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-2xl md:text-3xl font-bold">{fullName}</h1>

          {practitioner.specialty && (
            <p className="flex items-center gap-1.5 mt-1 text-muted-foreground">
              <Award className="h-4 w-4 text-primary flex-shrink-0" />
              {practitioner.specialty}
            </p>
          )}

          {/* Badges */}
          <div className="flex flex-wrap gap-2 mt-3">
            {badges.filter(b => b.show).map((b, i) => (
              <Badge key={i} variant="secondary" className="text-xs font-normal gap-1">
                {b.icon && <b.icon className="h-3 w-3" />}
                {b.label}
              </Badge>
            ))}
          </div>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              Medsquare, Meslin-l'Évêque
            </span>
            {practitioner.avg_appointment_delay_days != null && (
              <span>Délai moyen : ~{practitioner.avg_appointment_delay_days}j</span>
            )}
            {practitioner.pmr_accessible && (
              <span className="flex items-center gap-1">
                <Accessibility className="h-3.5 w-3.5" />
                PMR
              </span>
            )}
            {practitioner.parking && (
              <span className="flex items-center gap-1">
                <ParkingCircle className="h-3.5 w-3.5" />
                Parking
              </span>
            )}
          </div>
        </div>

        {/* CTA column */}
        <div className="flex flex-row md:flex-col gap-2 flex-shrink-0 print:hidden">
          {hasBookableActivities && (
            <Button
              onClick={onBookClick}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              size="lg"
            >
              <CalendarPlus className="h-4 w-4 mr-2" />
              Prendre RDV
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Share2 className="h-4 w-4 mr-1" />
                Partager
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleShare("copy")}>Copier le lien</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleShare("whatsapp")}>WhatsApp</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleShare("email")}>E-mail</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" onClick={handlePrint}>
            <FileText className="h-4 w-4 mr-1" />
            PDF
          </Button>
        </div>
      </div>

      {/* Accepts new patients banner */}
      {practitioner.accepts_new_patients !== false && (
        <div className="bg-green-50 dark:bg-green-950/30 border-t border-green-200 dark:border-green-900 px-6 py-2 text-sm text-green-700 dark:text-green-400 font-medium print:hidden">
          ● Accepte de nouveaux patients
        </div>
      )}
    </div>
  );
};

export default PractitionerHero;
