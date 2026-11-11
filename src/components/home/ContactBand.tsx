import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSiteSettings } from "@/hooks/useSiteSettings";

export const ADDRESS = "25 rue de la Procession, 7822 Meslin-l'Évêque";
export const MAPS_URL =
  "https://www.google.com/maps/dir/?api=1&destination=Rue+de+la+Procession+25,+7822+Meslin-l%27%C3%89v%C3%AAque,+Belgium";
export const HOURS = [
  { days: "Lundi – vendredi", time: "08h00 – 22h00" },
  { days: "Samedi – dimanche", time: "09h00 – 21h00" },
];

const ContactBand = () => {
  const { settings } = useSiteSettings();
  const c = settings.contact;
  const tel = c.phone.replace(/[^\d+]/g, "");

  return (
    <section className="py-20 md:py-28 bg-warm">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-14">
          <div className="lg:col-span-5">
            <p className="text-sm text-muted-foreground mb-4">Venir au centre</p>
            <h2 className="font-display font-normal text-4xl md:text-5xl leading-[1.05] tracking-tight mb-8 text-balance">
              {c.title}
            </h2>

            <dl className="divide-y divide-foreground/15 border-y border-foreground/15">
              <div className="py-4 grid grid-cols-3 gap-4">
                <dt className="text-sm text-muted-foreground">Adresse</dt>
                <dd className="col-span-2">
                  <a href={MAPS_URL} target="_blank" rel="noopener noreferrer" className="hover:underline underline-offset-4">
                    {ADDRESS}
                  </a>
                </dd>
              </div>
              <div className="py-4 grid grid-cols-3 gap-4">
                <dt className="text-sm text-muted-foreground">Horaires</dt>
                <dd className="col-span-2 space-y-1">
                  {HOURS.map((h) => (
                    <div key={h.days} className="flex justify-between gap-4">
                      <span>{h.days}</span>
                      <span className="tabular-nums text-muted-foreground">{h.time}</span>
                    </div>
                  ))}
                </dd>
              </div>
              <div className="py-4 grid grid-cols-3 gap-4">
                <dt className="text-sm text-muted-foreground">Téléphone</dt>
                <dd className="col-span-2">
                  <a href={`tel:${tel}`} className="hover:underline underline-offset-4 tabular-nums">{c.phone}</a>
                </dd>
              </div>
              <div className="py-4 grid grid-cols-3 gap-4">
                <dt className="text-sm text-muted-foreground">E-mail</dt>
                <dd className="col-span-2 break-all">
                  <a href={`mailto:${c.email}`} className="hover:underline underline-offset-4">{c.email}</a>
                </dd>
              </div>
            </dl>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-8">
              <a href={MAPS_URL} target="_blank" rel="noopener noreferrer">
                <Button size="lg" className="h-12 px-6 rounded-full text-[15px]">
                  Itinéraire
                  <ArrowUpRight className="h-4 w-4 ml-1" />
                </Button>
              </a>
              <Link to="/contact" className="text-[15px] font-medium underline-offset-4 hover:underline">
                Écrire au centre
              </Link>
            </div>
          </div>

          <div className="lg:col-span-7 min-h-[320px] rounded-lg overflow-hidden bg-muted">
            <iframe
              src="https://www.google.com/maps?q=Rue+de+la+Procession+25,+7822+Meslin-l%27%C3%89v%C3%AAque,+Belgium&output=embed"
              className="w-full h-full min-h-[320px] lg:min-h-[480px] grayscale-[35%]"
              style={{ border: 0 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Plan d'accès Medsquare"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default ContactBand;
