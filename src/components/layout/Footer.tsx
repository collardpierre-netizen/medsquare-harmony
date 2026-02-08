import { Link } from "react-router-dom";
import { Phone, Mail, MapPin } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-foreground text-background">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div>
            <h3 className="font-display text-2xl font-bold mb-4">Medsquare</h3>
            <p className="text-background/70 text-sm leading-relaxed">
              Un centre médical pluridisciplinaire dédié à votre bien-être, 
              dans un cadre chaleureux et professionnel.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="font-display text-lg font-semibold mb-4">Navigation</h4>
            <ul className="space-y-2">
              {[
                { label: "Accueil", href: "/" },
                { label: "Le Centre", href: "/centre" },
                { label: "Nos Praticiens", href: "/praticiens" },
                { label: "Nos Espaces", href: "/espaces" },
                { label: "Contact", href: "/contact" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-background/70 hover:text-background text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-display text-lg font-semibold mb-4">Contact</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-3 text-sm text-background/70">
                <Phone className="h-4 w-4 mt-0.5 shrink-0" />
                <span>+32 2 123 45 67</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-background/70">
                <Mail className="h-4 w-4 mt-0.5 shrink-0" />
                <span>contact@medsquare.be</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-background/70">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Avenue Louise 123, 1050 Bruxelles</span>
              </li>
            </ul>
          </div>

          {/* Horaires */}
          <div>
            <h4 className="font-display text-lg font-semibold mb-4">Horaires</h4>
            <ul className="space-y-2 text-sm text-background/70">
              <li className="flex justify-between">
                <span>Lun - Ven</span>
                <span>8h00 - 19h00</span>
              </li>
              <li className="flex justify-between">
                <span>Samedi</span>
                <span>9h00 - 14h00</span>
              </li>
              <li className="flex justify-between">
                <span>Dimanche</span>
                <span>Fermé</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-background/10 text-center">
          <p className="text-background/50 text-sm">
            © {new Date().getFullYear()} Medsquare. Tous droits réservés.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
