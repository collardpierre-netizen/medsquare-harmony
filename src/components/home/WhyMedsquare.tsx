import { motion } from "framer-motion";
import { Heart, Users, Shield, Clock, Star, Zap, Award, Smile, ThumbsUp, CheckCircle, LucideIcon } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";

const iconMap: Record<string, LucideIcon> = {
  Heart, Users, Shield, Clock, Star, Zap, Award, Smile, ThumbsUp, CheckCircle,
};

const WhyMedsquare = () => {
  const { settings } = useSiteSettings();
  const why = settings.why;

  return (
    <section className="py-20 md:py-28 bg-warm">
      <div className="container mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="text-center mb-16">
          <span className="text-primary text-sm font-medium tracking-widest uppercase">{why.badge}</span>
          <h2 className="font-display text-3xl md:text-4xl font-bold mt-3 mb-4">{why.title}</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">{why.subtitle}</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {why.features.map((feature, index) => {
            const Icon = iconMap[feature.icon] || Heart;
            return (
              <motion.div key={index} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: index * 0.1 }} className="bg-card rounded-xl p-8 text-center shadow-sm hover:shadow-md transition-shadow">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-accent mb-5">
                  <Icon className="h-6 w-6 text-accent-foreground" />
                </div>
                <h3 className="font-display text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default WhyMedsquare;
