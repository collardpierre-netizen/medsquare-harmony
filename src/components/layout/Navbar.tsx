import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navLinks = [
  { label: "Le centre", href: "/centre" },
  { label: "Praticiens", href: "/praticiens" },
  { label: "Espaces", href: "/espaces" },
  { label: "Activités", href: "/activites" },
  { label: "Contact", href: "/contact" },
];

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setIsOpen(false), [location.pathname]);

  const isActive = (href: string) => location.pathname === href || location.pathname.startsWith(`${href}/`);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-colors duration-300",
        scrolled || isOpen ? "bg-background/90 backdrop-blur-md border-b border-border" : "bg-background border-b border-transparent",
      )}
    >
      <nav className="container mx-auto flex items-center justify-between h-16 md:h-20 px-4">
        <Link to="/" className="flex items-center" aria-label="Medsquare — accueil">
          <img src="/logo-medsquare.png" alt="Medsquare" className="h-12 md:h-14 w-auto" />
        </Link>

        <ul className="hidden md:flex items-center gap-7">
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link
                to={link.href}
                className={cn(
                  "relative text-[15px] transition-colors py-2",
                  "after:absolute after:left-0 after:-bottom-0.5 after:h-px after:bg-foreground after:transition-all after:duration-300",
                  isActive(link.href)
                    ? "text-foreground after:w-full"
                    : "text-muted-foreground hover:text-foreground after:w-0 hover:after:w-full",
                )}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden md:flex items-center gap-5">
          <Link to="/login" className="text-[15px] text-muted-foreground hover:text-foreground transition-colors">
            Espace praticien
          </Link>
          <Link to="/praticiens">
            <Button className="rounded-full h-10 px-5">Prendre rendez-vous</Button>
          </Link>
        </div>

        <button
          className="md:hidden p-2 -mr-2 rounded-md"
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={isOpen}
        >
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {isOpen && (
        <div className="md:hidden fixed inset-0 top-16 bg-background z-40 overflow-y-auto">
          <ul className="container mx-auto px-4 pt-4">
            {[{ label: "Accueil", href: "/" }, ...navLinks].map((link) => (
              <li key={link.href} className="border-b border-border">
                <Link
                  to={link.href}
                  className={cn(
                    "block py-4 font-display text-3xl",
                    location.pathname === link.href ? "text-primary" : "text-foreground",
                  )}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="container mx-auto px-4 py-8 flex flex-col gap-3">
            <Link to="/praticiens">
              <Button className="w-full rounded-full h-12">Prendre rendez-vous</Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" className="w-full rounded-full h-12">Espace praticien</Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
