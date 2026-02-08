import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Phone, Mail, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

const ContactBand = () => {
  return (
    <section className="py-16 bg-primary text-primary-foreground">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex flex-col lg:flex-row items-center justify-between gap-8"
        >
          <div>
            <h2 className="font-display text-2xl md:text-3xl font-bold mb-2">
              Une question ? Contactez-nous.
            </h2>
            <p className="text-primary-foreground/80">
              Notre équipe est à votre disposition pour répondre à toutes vos questions.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4" />
              <span>+32 2 123 45 67</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4" />
              <span>contact@medsquare.be</span>
            </div>
            <Link to="/contact">
              <Button
                variant="secondary"
                size="lg"
                className="whitespace-nowrap"
              >
                Nous contacter
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default ContactBand;
