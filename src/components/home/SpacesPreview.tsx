import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const spaces = [
  {
    name: "Salle de consultation",
    description: "Espaces lumineux et équipés pour vos consultations.",
    image: "https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=600&h=400&fit=crop",
  },
  {
    name: "Salle de kinésithérapie",
    description: "Équipements modernes pour la rééducation.",
    image: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=600&h=400&fit=crop",
  },
  {
    name: "Espace bien-être",
    description: "Un cadre apaisant dédié à la relaxation.",
    image: "https://images.unsplash.com/photo-1540555700478-4be289fbec6d?w=600&h=400&fit=crop",
  },
];

const SpacesPreview = () => {
  return (
    <section className="py-20 md:py-28 bg-warm">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex flex-col md:flex-row md:items-end md:justify-between mb-12"
        >
          <div>
            <span className="text-primary text-sm font-medium tracking-widest uppercase">
              Nos locaux
            </span>
            <h2 className="font-display text-3xl md:text-4xl font-bold mt-3 mb-2">
              Des espaces pensés pour vous
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl">
              Des salles modernes et chaleureuses, conçues pour offrir le meilleur environnement de soins.
            </p>
          </div>
          <Link to="/espaces" className="mt-4 md:mt-0">
            <Button variant="ghost" className="group">
              Découvrir nos espaces
              <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {spaces.map((space, index) => (
            <motion.div
              key={space.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group"
            >
              <div className="relative overflow-hidden rounded-xl mb-4 aspect-[3/2]">
                <img
                  src={space.image}
                  alt={space.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
              </div>
              <h3 className="font-display text-xl font-semibold mb-1">{space.name}</h3>
              <p className="text-muted-foreground text-sm">{space.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SpacesPreview;
