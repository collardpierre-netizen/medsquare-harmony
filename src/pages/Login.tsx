import { useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Lock, Mail, UserPlus, Stethoscope, Heart } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const Login = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [accountType, setAccountType] = useState<"patient" | "practitioner">("patient");
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const notifyAdminsByEmail = async (firstName: string, lastName: string, email: string) => {
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      await fetch(`https://${projectId}.supabase.co/functions/v1/notify-practitioner-signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ first_name: firstName, last_name: lastName, email }),
      });
    } catch (e) {
      // Non-blocking
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (isSignUp) {
      const { error } = await signUp(email, password, {
        first_name: firstName,
        last_name: lastName,
        account_type: accountType,
      });
      if (error) {
        toast({
          variant: "destructive",
          title: "Erreur d'inscription",
          description: error.message,
        });
      } else {
        if (accountType === "practitioner") {
          notifyAdminsByEmail(firstName, lastName, email);
        }
        toast({
          title: "Inscription réussie !",
          description: accountType === "practitioner"
            ? "Vérifiez votre email. Votre compte professionnel sera activé après validation par l'administration."
            : "Vérifiez votre email pour confirmer votre compte.",
        });
        setIsSignUp(false);
      }
    } else {
      const { error } = await signIn(email, password);
      if (error) {
        toast({
          variant: "destructive",
          title: "Erreur de connexion",
          description: error.message,
        });
      } else {
        navigate("/dashboard");
      }
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
              <div className="text-center mb-8">
                <h1 className="font-display text-2xl font-bold mb-2">
                  {isSignUp ? "Créer un compte" : "Espace praticien"}
                </h1>
                <p className="text-muted-foreground text-sm">
                  {isSignUp
                    ? "Inscrivez-vous pour accéder à votre espace"
                    : "Connectez-vous pour accéder à votre tableau de bord"}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {isSignUp && (
                  <>
                    <div>
                      <Label className="mb-3 block">Je suis</Label>
                      <RadioGroup
                        value={accountType}
                        onValueChange={(v) => setAccountType(v as "patient" | "practitioner")}
                        className="grid grid-cols-2 gap-3"
                      >
                        <label
                          htmlFor="type-patient"
                          className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                            accountType === "patient"
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-muted-foreground/30"
                          }`}
                        >
                          <RadioGroupItem value="patient" id="type-patient" className="sr-only" />
                          <Heart className="h-6 w-6 text-primary" />
                          <span className="text-sm font-medium">Patient</span>
                        </label>
                        <label
                          htmlFor="type-practitioner"
                          className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                            accountType === "practitioner"
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-muted-foreground/30"
                          }`}
                        >
                          <RadioGroupItem value="practitioner" id="type-practitioner" className="sr-only" />
                          <Stethoscope className="h-6 w-6 text-primary" />
                          <span className="text-sm font-medium">Professionnel</span>
                        </label>
                      </RadioGroup>
                      {accountType === "practitioner" && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Votre compte sera activé après validation par l'administration.
                        </p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="firstName">Prénom</Label>
                        <Input
                          id="firstName"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="Prénom"
                          required
                          className="mt-1.5"
                        />
                      </div>
                      <div>
                        <Label htmlFor="lastName">Nom</Label>
                        <Input
                          id="lastName"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Nom"
                          required
                          className="mt-1.5"
                        />
                      </div>
                    </div>
                  </>
                )}

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

                <div>
                  <Label htmlFor="password">Mot de passe</Label>
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

                <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                  {isLoading
                    ? "Chargement..."
                    : isSignUp
                    ? "S'inscrire"
                    : "Se connecter"}
                </Button>
              </form>

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-primary text-sm hover:underline"
                >
                  {isSignUp
                    ? "Déjà un compte ? Se connecter"
                    : "Pas encore de compte ? S'inscrire"}
                </button>
              </div>

              <div className="mt-6 text-center">
                <Link
                  to="/"
                  className="text-muted-foreground text-sm hover:text-foreground transition-colors"
                >
                  ← Retour au site
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
};

export default Login;
