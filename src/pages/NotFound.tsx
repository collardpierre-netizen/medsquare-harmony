import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Layout from "@/components/layout/Layout";

const NotFound = () => (
  <Layout>
    <section className="container mx-auto px-4 py-28 md:py-40 max-w-xl">
      <p className="text-sm text-muted-foreground mb-4">Erreur 404</p>
      <h1 className="font-display font-normal text-4xl md:text-5xl tracking-tight mb-5">Cette page n'existe pas.</h1>
      <p className="text-muted-foreground text-lg mb-8">
        Le lien est peut-être ancien ou mal recopié. Repartez de l'accueil ou consultez la liste des praticiens.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link to="/"><Button className="rounded-full h-11 px-6">Retour à l'accueil</Button></Link>
        <Link to="/praticiens"><Button variant="outline" className="rounded-full h-11 px-6">Voir les praticiens</Button></Link>
      </div>
    </section>
  </Layout>
);

export default NotFound;
