import { Link } from "react-router-dom";
import { Mail, Clock, MapPin, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface DaySchedule {
  day: string;
  start: string;
  end: string;
}

interface PractitionerInfoSidebarProps {
  practitioner: {
    first_name: string;
    last_name: string;
    specialty: string | null;
    phone: string | null;
  };
  scheduleSlots: { day: string; hours: string }[];
}

const PractitionerInfoSidebar = ({ practitioner, scheduleSlots }: PractitionerInfoSidebarProps) => {
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
