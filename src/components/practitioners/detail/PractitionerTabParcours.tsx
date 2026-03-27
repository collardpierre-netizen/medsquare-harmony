import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Briefcase, Calendar, MapPin } from "lucide-react";

interface TimelineItem {
  title: string;
  institution?: string;
  location?: string;
  start_year?: string | number;
  end_year?: string | number;
  description?: string;
}

interface Props {
  practitionerName: string;
  experiences: TimelineItem[];
  formations: TimelineItem[];
  associations: string[];
}

function TimelineSection({ title, icon: Icon, items, color }: {
  title: string;
  icon: React.ElementType;
  items: TimelineItem[];
  color: string;
}) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="font-display font-semibold text-base flex items-center gap-2">
        <div className={`h-8 w-8 rounded-lg ${color} flex items-center justify-center`}>
          <Icon className="h-4 w-4 text-primary" />
        </div>
        {title}
      </h3>

      <div className="relative ml-4 border-l-2 border-primary/20 pl-6 space-y-6">
        {items.map((item, i) => {
          const period = item.start_year
            ? item.end_year
              ? `${item.start_year} – ${item.end_year}`
              : `Depuis ${item.start_year}`
            : null;

          return (
            <div key={i} className="relative">
              {/* Dot on timeline */}
              <div className="absolute -left-[31px] top-1.5 h-3 w-3 rounded-full bg-primary border-2 border-background" />

              <div>
                <p className="font-medium text-sm">{item.title}</p>
                {item.institution && (
                  <p className="text-sm text-muted-foreground">{item.institution}</p>
                )}
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {period && (
                    <Badge variant="outline" className="text-[10px] font-normal gap-1 px-1.5 py-0">
                      <Calendar className="h-2.5 w-2.5" />
                      {period}
                    </Badge>
                  )}
                  {item.location && (
                    <Badge variant="outline" className="text-[10px] font-normal gap-1 px-1.5 py-0">
                      <MapPin className="h-2.5 w-2.5" />
                      {item.location}
                    </Badge>
                  )}
                </div>
                {item.description && (
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{item.description}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const PractitionerTabParcours = ({ practitionerName, experiences, formations, associations }: Props) => {
  const hasContent = experiences.length > 0 || formations.length > 0 || associations.length > 0;

  if (!hasContent) {
    return (
      <div className="text-center py-12">
        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <GraduationCap className="h-6 w-6 text-primary" />
        </div>
        <h3 className="font-display text-lg font-semibold mb-1">Parcours professionnel</h3>
        <p className="text-muted-foreground text-sm">
          {practitionerName} n'a pas encore renseigné son parcours.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <TimelineSection
        title="Expériences professionnelles"
        icon={Briefcase}
        items={experiences}
        color="bg-primary/10"
      />

      <TimelineSection
        title="Formations & Diplômes"
        icon={GraduationCap}
        items={formations}
        color="bg-primary/10"
      />

      {associations.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-display font-semibold text-base flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Briefcase className="h-4 w-4 text-primary" />
            </div>
            Associations professionnelles
          </h3>
          <div className="flex flex-wrap gap-2 ml-4">
            {associations.map((a, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {a}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PractitionerTabParcours;
