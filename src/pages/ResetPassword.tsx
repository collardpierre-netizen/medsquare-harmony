import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [checking, setChecking] = useState(true);
  const [done, setDone] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    // Listen for PASSWORD_RECOVERY event from the magic link
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        if (!active) return;
        setIsRecovery(true);
        setChecking(false);
      }
    });

    const resolveLink = async () => {
      const hash = window.location.hash;
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const tokenHash = params.get("token_hash") || params.get("token");
      const type = params.get("type");

      // 1) Hash-based link (#access_token=...&type=recovery)
      if (hash.includes("type=recovery") || hash.includes("access_token=")) {
        if (active) {
          setIsRecovery(true);
          setChecking(false);
        }
        return;
      }

      // 2) PKCE link (?code=...)
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (active) {
          setIsRecovery(!error);
          setChecking(false);
        }
        return;
      }

      // 3) Token hash link (?token_hash=...&type=recovery)
      if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: (type as any) || "recovery",
        });
        if (active) {
          setIsRecovery(!error);
          setChecking(false);
        }
        return;
      }

      // 4) Fallback: an active session (link already consumed by the SDK)
      const { data } = await supabase.auth.getSession();
      if (active) {
        setIsRecovery(!!data.session);
        setChecking(false);
      }
    };

    resolveLink();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Les mots de passe ne correspondent pas.",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Le mot de passe doit contenir au moins 6 caractères.",
      });
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message,
      });
    } else {
      setDone(true);
      toast({
        title: "Mot de passe mis à jour ✅",
        description: "Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.",
      });
      setTimeout(() => navigate("/login"), 3000);
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
              {checking && !done ? (
                <div className="flex flex-col items-center justify-center gap-3 py-8">
                  <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  <p className="text-muted-foreground text-sm">
                    Vérification du lien…
                  </p>
                </div>
              ) : done ? (
                <div className="text-center space-y-4">
                  <CheckCircle className="h-12 w-12 text-primary mx-auto" />
                  <h1 className="font-display text-2xl font-bold">Mot de passe modifié</h1>
                  <p className="text-muted-foreground text-sm">
                    Redirection vers la connexion…
                  </p>
                </div>
              ) : !isRecovery ? (
                <div className="text-center space-y-4">
                  <h1 className="font-display text-2xl font-bold">Lien invalide ou expiré</h1>
                  <p className="text-muted-foreground text-sm">
                    Ce lien de réinitialisation n'est plus valide. Veuillez en demander un nouveau.
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
                      Nouveau mot de passe
                    </h1>
                    <p className="text-muted-foreground text-sm">
                      Choisissez un nouveau mot de passe pour votre compte.
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                      <Label htmlFor="password">Nouveau mot de passe</Label>
                      <div className="relative mt-1.5">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="password"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="pl-10"
                          required
                          minLength={6}
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                      <div className="relative mt-1.5">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="confirmPassword"
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className="pl-10"
                          required
                          minLength={6}
                        />
                      </div>
                    </div>

                    <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                      {isLoading ? "Mise à jour…" : "Réinitialiser le mot de passe"}
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

export default ResetPassword;
