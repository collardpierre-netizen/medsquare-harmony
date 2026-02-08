import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";

const practitioners = [
  {
    id: "sophie-martin",
    name: "Dr. Sophie Martin",
    specialty: "Médecine générale",
    description: "Médecin généraliste passionnée par la médecine préventive et le suivi familial.",
    image: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&h=500&fit=crop",
  },
  {
    id: "thomas-dupont",
    name: "Dr. Thomas Dupont",
    specialty: "Kinésithérapie",
    description: "Spécialisé en rééducation sportive et en thérapie manuelle.",
    image: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&h=500&fit=crop",
  },
  {
    id: "claire-leblanc",
    name: "Dr. Claire Leblanc",
    specialty: "Dermatologie",
    description: "Experte en dermatologie clinique et esthétique.",
    image: "https://images.unsplash.com/photo-1594824476967-48c8b964f137?w=400&h=500&fit=crop",
  },
  {
    id: "marc-janssen",
    name: "Dr. Marc Janssen",
    specialty: "Ostéopathie",
    description: "Ostéopathe certifié avec 15 ans d'expérience.",
    image: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400&h=500&fit=crop",
  },
  {
    id: "amelie-peeters",
    name: "Dr. Amélie Peeters",
    specialty: "Psychologie",
    description: "Psychologue clinicienne spécialisée en thérapie cognitive et comportementale.",
    image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=500&fit=crop",
  },
  {
    id: "nicolas-vandenberg",
    name: "Dr. Nicolas Vandenberg",
    specialty: "Nutrition",
    description: "Nutritionniste-diététicien spécialisé en alimentation thérapeutique.",
    image: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=400&h=500&fit=crop",
  },
];

const Praticiens = () => {
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
              Notre équipe
            </span>
            <h1 className="font-display text-4xl md:text-5xl font-bold mt-3 mb-6">
              Nos praticiens
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Des professionnels qualifiés et passionnés, unis par une mission commune : 
              prendre soin de vous avec expertise et humanité.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Grid */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {practitioners.map((practitioner, index) => (
              <motion.div
                key={practitioner.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.08 }}
              >
                <Link to={`/praticiens/${practitioner.id}`} className="group block">
                  <div className="relative overflow-hidden rounded-xl mb-4 aspect-[4/5]">
                    <img
                      src={practitioner.image}
                      alt={practitioner.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-foreground/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>
                  <h3 className="font-display text-xl font-semibold group-hover:text-primary transition-colors">
                    {practitioner.name}
                  </h3>
                  <p className="text-primary text-sm font-medium mt-1">{practitioner.specialty}</p>
                  <p className="text-muted-foreground text-sm mt-2">{practitioner.description}</p>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Praticiens;
