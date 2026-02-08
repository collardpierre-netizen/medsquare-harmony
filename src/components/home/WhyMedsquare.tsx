import { motion } from "framer-motion";
import { Heart, Users, Shield, Clock } from "lucide-react";

const features = [
  {
    icon: Heart,
    title: "Approche humaine",
    description: "Chaque patient est unique. Nos praticiens prennent le temps de vous écouter et de vous accompagner.",
  },
  {
    icon: Users,
    title: "Équipe pluridisciplinaire",
    description: "Une synergie entre professionnels de santé pour une prise en charge globale et coordonnée.",
  },
  {
    icon: Shield,
    title: "Excellence médicale",
    description: "Des praticiens qualifiés, formés aux dernières avancées, dans un environnement moderne.",
  },
  {
    icon: Clock,
    title: "Accessibilité",
    description: "Des horaires flexibles et un accueil attentif pour s'adapter à votre emploi du temps.",
  },
];

const WhyMedsquare = () => {
  return (
    <section className="py-20 md:py-28 bg-warm">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <span className="text-primary text-sm font-medium tracking-widest uppercase">
            Nos valeurs
          </span>
          <h2 className="font-display text-3xl md:text-4xl font-bold mt-3 mb-4">
            Pourquoi choisir Medsquare ?
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Un centre médical pensé pour votre confort et votre bien-être.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-card rounded-xl p-8 text-center shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-accent mb-5">
                <feature.icon className="h-6 w-6 text-accent-foreground" />
              </div>
              <h3 className="font-display text-xl font-semibold mb-3">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyMedsquare;
