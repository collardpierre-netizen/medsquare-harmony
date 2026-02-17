import { Link } from "react-router-dom";
import { Phone, Mail, MapPin, Facebook, Instagram, Linkedin, Twitter } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-foreground text-background">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div>
            <img src="/logo-medsquare.png" alt="Medsquare" className="h-12 w-auto mb-4 brightness-0 invert" />
            <p className="text-background/70 text-sm leading-relaxed mb-6">
              Un centre médical pluridisciplinaire dédié à votre bien-être, 
              dans un cadre chaleureux et professionnel.
            </p>
            {/* Social Links */}
            <div className="flex items-center gap-4">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-background/70 hover:text-background transition-colors"
                aria-label="Facebook"
              >
                <Facebook className="h-5 w-5" />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-background/70 hover:text-background transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="h-5 w-5" />
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-background/70 hover:text-background transition-colors"
                aria-label="LinkedIn"
              >
                <Linkedin className="h-5 w-5" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-background/70 hover:text-background transition-colors"
                aria-label="Twitter"
              >
                <Twitter className="h-5 w-5" />
              </a>
            </div>
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
                <span>+32 498 64 41 30</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-background/70">
                <Mail className="h-4 w-4 mt-0.5 shrink-0" />
                <span>medsquare7822@gmail.com</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-background/70">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                <span>25 rue de la Procession, 7822 Meslin-l'Évêque</span>
              </li>
            </ul>
          </div>

          {/* Horaires */}
          <div>
            <h4 className="font-display text-lg font-semibold mb-4">Horaires</h4>
            <ul className="space-y-2 text-sm text-background/70">
              <li className="flex justify-between">
                <span>Lun - Ven</span>
                <span>08h00 - 22h00</span>
              </li>
              <li className="flex justify-between">
                <span>Sam - Dim</span>
                <span>09h00 - 21h00</span>
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
