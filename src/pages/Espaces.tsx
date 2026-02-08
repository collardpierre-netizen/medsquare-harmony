import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Users, Wifi, Monitor, Wind } from "lucide-react";

const spaces = [
  {
    name: "Salle de consultation classique",
    description: "Idéale pour les consultations médicales individuelles. Équipée d'un bureau, d'un lit d'examen et du matériel médical de base.",
    capacity: "1-2 personnes",
    price: "À partir de 35€/h",
    equipment: ["Bureau ergonomique", "Lit d'examen", "Point d'eau", "Wi-Fi haut débit"],
    image: "https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=800&h=500&fit=crop",
  },
  {
    name: "Salle de kinésithérapie",
    description: "Espace spacieux avec équipements de rééducation, tapis de sol et matériel de kinésithérapie.",
    capacity: "1-3 personnes",
    price: "À partir de 45€/h",
    equipment: ["Équipement de rééducation", "Tapis de sol", "Barres parallèles", "Wi-Fi haut débit"],
    image: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&h=500&fit=crop",
  },
  {
    name: "Bureau de consultation premium",
    description: "Bureau spacieux et élégant pour les consultations nécessitant un cadre particulièrement confortable.",
    capacity: "1-3 personnes",
    price: "À partir de 50€/h",
    equipment: ["Bureau grand format", "Fauteuils confortables", "Écran de présentation", "Wi-Fi haut débit"],
    image: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=800&h=500&fit=crop",
  },
  {
    name: "Salle polyvalente",
    description: "Espace modulable pour ateliers de groupe, formations ou réunions entre praticiens.",
    capacity: "6-12 personnes",
    price: "À partir de 80€/h",
    equipment: ["Tables modulables", "Vidéoprojecteur", "Tableau blanc", "Wi-Fi haut débit"],
    image: "https://images.unsplash.com/photo-1540555700478-4be289fbec6d?w=800&h=500&fit=crop",
  },
];

const equipmentIcons: Record<string, typeof Users> = {
  "Wi-Fi haut débit": Wifi,
  "Écran de présentation": Monitor,
  "Vidéoprojecteur": Monitor,
};

const Espaces = () => {
  return (
    <Layout>
      {/* Hero */}
      <section className="py-20 md:py-28 bg-warm">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl mx-auto text-center"
          >
            <span className="text-primary text-sm font-medium tracking-widest uppercase">
              Nos locaux
            </span>
            <h1 className="font-display text-4xl md:text-5xl font-bold mt-3 mb-6">
              Nos espaces
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Des salles modernes et équipées, disponibles à la location pour les professionnels de santé. 
              Chaque espace est conçu pour offrir le meilleur cadre de travail.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Spaces list */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="space-y-16">
            {spaces.map((space, index) => (
              <motion.div
                key={space.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className={`grid grid-cols-1 lg:grid-cols-2 gap-8 items-center ${
                  index % 2 === 1 ? "lg:direction-rtl" : ""
                }`}
              >
                <div className={index % 2 === 1 ? "lg:order-2" : ""}>
                  <div className="overflow-hidden rounded-xl">
                    <img
                      src={space.image}
                      alt={space.name}
                      className="w-full aspect-[16/10] object-cover hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  </div>
                </div>
                <div className={index % 2 === 1 ? "lg:order-1" : ""}>
                  <h3 className="font-display text-2xl font-bold mb-3">{space.name}</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">{space.description}</p>
                  
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-primary" />
                      <span>{space.capacity}</span>
                    </div>
                    <span className="text-primary font-semibold">{space.price}</span>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-6">
                    {space.equipment.map((eq) => (
                      <span
                        key={eq}
                        className="px-3 py-1.5 rounded-full bg-accent text-accent-foreground text-xs"
                      >
                        {eq}
                      </span>
                    ))}
                  </div>

                  <Link to="/contact">
                    <Button>Contactez-nous pour réserver</Button>
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Espaces;
