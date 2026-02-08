import { motion } from "framer-motion";
import Layout from "@/components/layout/Layout";
import { Heart, Target, Eye } from "lucide-react";

const values = [
  {
    icon: Heart,
    title: "Bienveillance",
    description: "Chaque personne est accueillie avec respect, empathie et attention.",
  },
  {
    icon: Target,
    title: "Excellence",
    description: "Nous visons les plus hauts standards de qualité dans tous nos soins.",
  },
  {
    icon: Eye,
    title: "Transparence",
    description: "Une communication claire et honnête avec chacun de nos patients.",
  },
];

const galleryImages = [
  {
    src: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=600&h=400&fit=crop",
    alt: "Salle d'attente Medsquare",
  },
  {
    src: "https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=600&h=400&fit=crop",
    alt: "Bureau de consultation",
  },
  {
    src: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=600&h=400&fit=crop",
    alt: "Couloir du centre",
  },
  {
    src: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=600&h=400&fit=crop",
    alt: "Espace de soins",
  },
];

const Centre = () => {
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
              Notre centre
            </span>
            <h1 className="font-display text-4xl md:text-5xl font-bold mt-3 mb-6">
              Un lieu de soins pensé pour vous
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Medsquare est né de la volonté de créer un espace médical différent : 
              un lieu où l'humain est au cœur de chaque décision, où la qualité des soins 
              se marie à la chaleur de l'accueil.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Valeurs */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">Nos valeurs</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Les principes qui guident notre pratique au quotidien.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {values.map((value, index) => (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="text-center"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent mb-5">
                  <value.icon className="h-7 w-7 text-accent-foreground" />
                </div>
                <h3 className="font-display text-xl font-semibold mb-3">{value.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{value.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Galerie */}
      <section className="py-20 md:py-28 bg-warm">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">Nos espaces</h2>
            <p className="text-muted-foreground text-lg">
              Découvrez notre centre en images.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {galleryImages.map((img, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="overflow-hidden rounded-xl"
              >
                <img
                  src={img.src}
                  alt={img.alt}
                  className="w-full h-64 object-cover hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Localisation */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">Nous trouver</h2>
              <p className="text-muted-foreground text-lg">
                Avenue Louise 123, 1050 Bruxelles
              </p>
            </div>
            <div className="rounded-xl overflow-hidden shadow-md">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2520.041988087025!2d4.356!3d50.832!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47c3c4852b2e0f9d%3A0x1e4f5a7b7c8d9e0f!2sAvenue%20Louise%2C%201050%20Bruxelles!5e0!3m2!1sfr!2sbe!4v1700000000000!5m2!1sfr!2sbe"
                width="100%"
                height="400"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Localisation Medsquare"
              />
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Centre;
