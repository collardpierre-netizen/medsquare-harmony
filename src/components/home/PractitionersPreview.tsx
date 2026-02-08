import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const practitioners = [
  {
    name: "Dr. Sophie Martin",
    specialty: "Médecine générale",
    image: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&h=500&fit=crop",
  },
  {
    name: "Dr. Thomas Dupont",
    specialty: "Kinésithérapie",
    image: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&h=500&fit=crop",
  },
  {
    name: "Dr. Claire Leblanc",
    specialty: "Dermatologie",
    image: "https://images.unsplash.com/photo-1594824476967-48c8b964f137?w=400&h=500&fit=crop",
  },
  {
    name: "Dr. Marc Janssen",
    specialty: "Ostéopathie",
    image: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400&h=500&fit=crop",
  },
];

const PractitionersPreview = () => {
  return (
    <section className="py-20 md:py-28">
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
              Notre équipe
            </span>
            <h2 className="font-display text-3xl md:text-4xl font-bold mt-3 mb-2">
              Nos praticiens
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl">
              Des professionnels de santé dévoués, unis par une même passion : votre bien-être.
            </p>
          </div>
          <Link to="/praticiens" className="mt-4 md:mt-0">
            <Button variant="ghost" className="group">
              Voir tous les praticiens
              <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {practitioners.map((practitioner, index) => (
            <motion.div
              key={practitioner.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group cursor-pointer"
            >
              <div className="relative overflow-hidden rounded-xl mb-4 aspect-[4/5]">
                <img
                  src={practitioner.image}
                  alt={practitioner.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
              <h3 className="font-display text-lg font-semibold">{practitioner.name}</h3>
              <p className="text-muted-foreground text-sm">{practitioner.specialty}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PractitionersPreview;
