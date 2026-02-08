import { motion } from "framer-motion";
import { Quote } from "lucide-react";

const testimonials = [
  {
    text: "Un accueil chaleureux et des praticiens à l'écoute. Je recommande vivement Medsquare à tous ceux qui cherchent un suivi médical de qualité.",
    author: "Marie D.",
    role: "Patiente depuis 2023",
  },
  {
    text: "Les locaux sont magnifiques et le personnel très professionnel. On se sent vraiment en confiance dès le premier rendez-vous.",
    author: "Jean-Pierre L.",
    role: "Patient depuis 2022",
  },
  {
    text: "Enfin un centre médical qui prend le temps de vous écouter. L'approche pluridisciplinaire fait toute la différence.",
    author: "Isabelle V.",
    role: "Patiente depuis 2024",
  },
];

const TestimonialsSection = () => {
  return (
    <section className="py-20 md:py-28">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <span className="text-primary text-sm font-medium tracking-widest uppercase">
            Témoignages
          </span>
          <h2 className="font-display text-3xl md:text-4xl font-bold mt-3 mb-4">
            Ce que disent nos patients
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.author}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-card rounded-xl p-8 shadow-sm border border-border relative"
            >
              <Quote className="h-8 w-8 text-primary/20 mb-4" />
              <p className="text-foreground/80 leading-relaxed mb-6 italic">
                "{testimonial.text}"
              </p>
              <div>
                <p className="font-semibold text-sm">{testimonial.author}</p>
                <p className="text-muted-foreground text-xs">{testimonial.role}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
