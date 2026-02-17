import { motion } from "framer-motion";
import { Quote } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";

const TestimonialsSection = () => {
  const { settings } = useSiteSettings();
  const t = settings.testimonials;

  if (!t.visible) return null;
  return (
    <section className="py-20 md:py-28">
      <div className="container mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="text-center mb-16">
          <span className="text-primary text-sm font-medium tracking-widest uppercase">{t.badge}</span>
          <h2 className="font-display text-3xl md:text-4xl font-bold mt-3 mb-4">{t.title}</h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {t.items.map((testimonial, index) => (
            <motion.div key={index} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: index * 0.1 }} className="bg-card rounded-xl p-8 shadow-sm border border-border relative">
              <Quote className="h-8 w-8 text-primary/20 mb-4" />
              <p className="text-foreground/80 leading-relaxed mb-6 italic">"{testimonial.text}"</p>
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
