import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message,
      });
    } else {
      setSent(true);
    }
    setIsLoading(false);
  };

  return (
    <Layout>
      <section className="py-20 md:py-28 bg-warm min-h-[70vh] flex items-center">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-md mx-auto"
          >
            <div className="bg-card rounded-2xl shadow-lg p-8 border border-border">
              {sent ? (
                <div className="text-center space-y-4">
                  <CheckCircle className="h-12 w-12 text-primary mx-auto" />
                  <h1 className="font-display text-2xl font-bold">Email envoyé !</h1>
                  <p className="text-muted-foreground text-sm">
                    Si un compte existe avec l'adresse <strong>{email}</strong>, vous recevrez un lien pour réinitialiser votre mot de passe.
                  </p>
                  <Link
                    to="/login"
                    className="text-primary text-sm hover:underline inline-block mt-2"
                  >
                    ← Retour à la connexion
                  </Link>
                </div>
              ) : (
                <>
                  <div className="text-center mb-8">
                    <h1 className="font-display text-2xl font-bold mb-2">
                      Mot de passe oublié
                    </h1>
                    <p className="text-muted-foreground text-sm">
                      Entrez votre adresse email pour recevoir un lien de réinitialisation.
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                      <Label htmlFor="email">Adresse email</Label>
                      <div className="relative mt-1.5">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="votre@email.com"
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>

                    <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                      {isLoading ? "Envoi…" : "Envoyer le lien"}
                    </Button>
                  </form>

                  <div className="mt-6 text-center">
                    <Link
                      to="/login"
                      className="text-muted-foreground text-sm hover:text-foreground transition-colors"
                    >
                      ← Retour à la connexion
                    </Link>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
};

export default ForgotPassword;
