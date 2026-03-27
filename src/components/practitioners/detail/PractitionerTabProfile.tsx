import { Globe, CreditCard, Accessibility, Clock, Home, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import PractitionerActivities from "@/components/practitioners/PractitionerActivities";

interface InfoItem {
  icon: React.ElementType;
  label: string;
  value: string;
}

interface Collaborator {
  id: string;
  first_name: string;
  last_name: string;
  specialty: string | null;
}

interface Props {
  practitioner: {
    bio: string | null;
    specialties?: string[];
    languages?: string[];
    payment_methods?: string[];
    tiers_payant?: boolean;
    pmr_accessible?: boolean;
    avg_appointment_delay_days?: number | null;
    home_visit?: boolean;
  };
  activities: any[];
  collaborators: Collaborator[];
}

const PractitionerTabProfile = ({ practitioner, activities, collaborators }: Props) => {
  const infoGrid: InfoItem[] = [
    {
      icon: Globe,
      label: "Langues",
      value: (practitioner.languages || []).join(", ") || "Français",
    },
    {
      icon: CreditCard,
      label: "Paiements",
      value: (practitioner.payment_methods || []).length > 0 ? practitioner.payment_methods!.join(", ") : "Espèces, Bancontact",
    },
    {
      icon: CreditCard,
      label: "Tiers payant",
      value: practitioner.tiers_payant ? "Oui" : "Non",
    },
    {
      icon: Accessibility,
      label: "Accessibilité PMR",
      value: practitioner.pmr_accessible ? "Oui" : "Non",
    },
    {
      icon: Clock,
      label: "Délai moyen RDV",
      value: practitioner.avg_appointment_delay_days != null ? `~${practitioner.avg_appointment_delay_days} jours` : "Non renseigné",
    },
    {
      icon: Home,
      label: "Visite à domicile",
      value: practitioner.home_visit ? "Oui" : "Non",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Bio */}
      <section>
        <h2 className="font-display text-xl font-semibold mb-3">À propos</h2>
        {practitioner.bio ? (
          <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{practitioner.bio}</p>
        ) : (
          <p className="text-muted-foreground italic">Ce praticien n'a pas encore renseigné sa biographie.</p>
        )}
      </section>

      {/* Specialties */}
      {(practitioner.specialties || []).length > 0 && (
        <section>
          <h2 className="font-display text-xl font-semibold mb-3">Spécialités</h2>
          <div className="flex flex-wrap gap-2">
            {practitioner.specialties!.map((s, i) => (
              <Badge key={i} variant="outline" className="text-sm py-1.5 px-3">
                {s}
              </Badge>
            ))}
          </div>
        </section>
      )}

      {/* Info grid */}
      <section>
        <h2 className="font-display text-xl font-semibold mb-3">Informations pratiques</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {infoGrid.map((item, i) => (
            <Card key={i} className="shadow-none">
              <CardContent className="flex items-start gap-3 p-4">
                <item.icon className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-sm font-medium">{item.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Activities */}
      {activities.length > 0 && (
        <section>
          <PractitionerActivities activities={activities} />
        </section>
      )}

      {/* Collaborators */}
      {collaborators.length > 0 && (
        <section>
          <h2 className="font-display text-xl font-semibold mb-3">En collaboration avec</h2>
          <div className="flex flex-wrap gap-2">
            {collaborators.map((c) => (
              <Link key={c.id} to={`/praticiens/${c.id}`}>
                <Badge variant="secondary" className="text-sm py-1.5 px-3 hover:bg-accent cursor-pointer">
                  <Users className="h-3 w-3 mr-1" />
                  {c.first_name} {c.last_name}
                  {c.specialty && <span className="ml-1 text-muted-foreground">· {c.specialty}</span>}
                </Badge>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default PractitionerTabProfile;
