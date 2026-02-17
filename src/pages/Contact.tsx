import { useState } from "react";
import { motion } from "framer-motion";
import { Phone, Mail, MapPin, Send } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";

const faqs = [
  {
    question: "Comment prendre rendez-vous ?",
    answer: "Vous pouvez nous contacter par téléphone au +32 498 64 41 30 ou via le formulaire de contact ci-dessus. Nous vous répondrons dans les plus brefs délais.",
  },
  {
    question: "Acceptez-vous les nouveaux patients ?",
    answer: "Oui, nous accueillons de nouveaux patients. N'hésitez pas à nous contacter pour connaître les disponibilités de nos praticiens.",
  },
  {
    question: "Quels sont vos tarifs ?",
    answer: "Nos tarifs varient selon la spécialité et le type de consultation. Nous vous invitons à nous contacter pour obtenir des informations détaillées.",
  },
  {
    question: "Est-il possible de consulter en urgence ?",
    answer: "Nous faisons notre possible pour accueillir les urgences. Appelez-nous directement au +32 498 64 41 30 pour vérifier les disponibilités.",
  },
  {
    question: "Êtes-vous conventionné ?",
    answer: "Nos praticiens sont conventionnés. Les remboursements dépendent de votre mutuelle et du type de consultation.",
  },
];

const Contact = () => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate form submission
    await new Promise((resolve) => setTimeout(resolve, 1000));

    toast({
      title: "Message envoyé !",
      description: "Nous vous répondrons dans les plus brefs délais.",
    });

    setIsSubmitting(false);
    (e.target as HTMLFormElement).reset();
  };

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
              Contact
            </span>
            <h1 className="font-display text-4xl md:text-5xl font-bold mt-3 mb-6">
              Contactez-nous
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Une question, une demande de rendez-vous ? Notre équipe est à votre écoute.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Contact Form + Info */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-5xl mx-auto">
            {/* Form */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="font-display text-2xl font-bold mb-6">Envoyez-nous un message</h2>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Nom complet</Label>
                    <Input
                      id="name"
                      placeholder="Votre nom"
                      required
                      maxLength={100}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="votre@email.com"
                      required
                      maxLength={255}
                      className="mt-1.5"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="subject">Sujet</Label>
                  <Select required>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Choisir un sujet" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rdv">Prise de rendez-vous</SelectItem>
                      <SelectItem value="info">Demande d'information</SelectItem>
                      <SelectItem value="espace">Réservation d'espace</SelectItem>
                      <SelectItem value="autre">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    placeholder="Votre message..."
                    rows={5}
                    required
                    maxLength={1000}
                    className="mt-1.5"
                  />
                </div>

                <Button type="submit" size="lg" disabled={isSubmitting}>
                  <Send className="h-4 w-4 mr-2" />
                  {isSubmitting ? "Envoi en cours..." : "Envoyer le message"}
                </Button>
              </form>
            </motion.div>

            {/* Contact Info */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <h2 className="font-display text-2xl font-bold mb-6">Nos coordonnées</h2>
              <div className="space-y-6 mb-8">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center shrink-0">
                    <Phone className="h-5 w-5 text-accent-foreground" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">Téléphone</h4>
                    <p className="text-muted-foreground text-sm">+32 498 64 41 30</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center shrink-0">
                    <Mail className="h-5 w-5 text-accent-foreground" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">Email</h4>
                    <p className="text-muted-foreground text-sm">medsquare7822@gmail.com</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center shrink-0">
                    <MapPin className="h-5 w-5 text-accent-foreground" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">Adresse</h4>
                    <p className="text-muted-foreground text-sm">25 rue de la Procession, 7822 Meslin-l'Évêque</p>
                  </div>
                </div>
              </div>

              {/* Map */}
              <div className="rounded-xl overflow-hidden">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2544.0!2d3.745!3d50.595!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47c3!2sRue%20de%20la%20Procession%2025%2C%207822%20Meslin-l%27%C3%89v%C3%AAque!5e0!3m2!1sfr!2sbe!4v1700000000000!5m2!1sfr!2sbe"
                  width="100%"
                  height="250"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Localisation Medsquare"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 md:py-28 bg-warm">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-center mb-12"
            >
              <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
                Questions fréquentes
              </h2>
              <p className="text-muted-foreground text-lg">
                Retrouvez les réponses aux questions les plus courantes.
              </p>
            </motion.div>

            <Accordion type="single" collapsible className="space-y-3">
              {faqs.map((faq, index) => (
                <AccordionItem
                  key={index}
                  value={`faq-${index}`}
                  className="bg-card rounded-xl px-6 border border-border"
                >
                  <AccordionTrigger className="text-left font-semibold text-sm hover:no-underline">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-sm">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Contact;
