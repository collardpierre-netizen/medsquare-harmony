import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import Layout from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";

const values = [
  {
    title: "Des métiers qui se complètent",
    description: "Psychologues, thérapeutes manuels, enseignants de yoga ou de pilates : chacun garde sa pratique, tous partagent le lieu.",
  },
  {
    title: "Des espaces faits pour soigner",
    description: "Cabinets fermés au rez-de-chaussée et à l'étage, tables d'examen motorisées, une salle de 60 m² pour les cours collectifs.",
  },
  {
    title: "Facile d'accès",
    description: "Un grand parking sur place, des cabinets de plain-pied, ouvert jusqu'à 22h en semaine et tout le week-end.",
  },
];

const DEFAULT_GALLERY = [
  {
    url: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=600&h=400&fit=crop",
    alt: "Salle d'attente Medsquare",
  },
  {
    url: "https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=600&h=400&fit=crop",
    alt: "Bureau de consultation",
  },
  {
    url: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=600&h=400&fit=crop",
    alt: "Couloir du centre",
  },
  {
    url: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=600&h=400&fit=crop",
    alt: "Espace de soins",
  },
];

const Centre = () => {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [galleryImages, setGalleryImages] = useState(DEFAULT_GALLERY);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", ["centre_video", "centre_gallery"]);
      if (data) {
        for (const row of data) {
          if (row.key === "centre_video") {
            const val = row.value as Record<string, unknown>;
            if (val?.url && typeof val.url === "string") setVideoUrl(val.url);
          }
          if (row.key === "centre_gallery") {
            const val = row.value as Record<string, unknown>;
            const images = val?.images as { url: string; alt: string }[] | undefined;
            if (images && images.length > 0) setGalleryImages(images);
          }
        }
      }
    };
    fetchSettings();
  }, []);

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
            <span className="text-sm text-muted-foreground">
              Notre centre
            </span>
            <h1 className="font-display text-4xl md:text-5xl font-normal tracking-tight mt-3 mb-6">
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
            <h2 className="font-display text-3xl md:text-4xl font-normal tracking-tight mb-4">Nos valeurs</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Trois choses qu'on a voulu bien faire dès le départ.
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
                className="border-t border-foreground/15 pt-6"
              >
                <span className="text-xs tabular-nums text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                <h3 className="font-display text-2xl mt-3 mb-2">{value.title}</h3>
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
            <h2 className="font-display text-3xl md:text-4xl font-normal tracking-tight mb-4">Nos espaces</h2>
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
                className="overflow-hidden rounded-lg"
              >
                <img
                  src={img.url}
                  alt={img.alt}
                  className="w-full h-64 object-cover hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Vidéo */}
      {videoUrl && (
        <section className="py-20 md:py-28">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="relative w-full rounded-lg overflow-hidden " style={{ paddingBottom: "56.25%" }}>
                <iframe
                  src={videoUrl}
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                  title="Vidéo de présentation"
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Localisation */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="font-display text-3xl md:text-4xl font-normal tracking-tight mb-4">Nous trouver</h2>
              <p className="text-muted-foreground text-lg">
                25 rue de la Procession, 7822 Meslin-l'Évêque
              </p>
            </div>
            <div className="rounded-lg overflow-hidden ">
              <iframe
                src="https://www.google.com/maps?q=Rue+de+la+Procession+25,+7822+Meslin-l%27%C3%89v%C3%AAque,+Belgium&output=embed"
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
