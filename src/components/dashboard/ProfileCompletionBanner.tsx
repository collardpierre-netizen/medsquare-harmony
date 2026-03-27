import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { X, Sparkles, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";

interface MissingAction {
  key: string;
  icon: string;
  label: string;
  href: string;
}

const ALL_ACTIONS: MissingAction[] = [
  { key: "Tarifs INAMI", icon: "📋", label: "Ajouter vos tarifs", href: "/dashboard/rates" },
  { key: "Questions & Réponses publiées", icon: "💬", label: "Répondre aux questions patients", href: "/dashboard/qna" },
  { key: "Photo de profil", icon: "📸", label: "Ajouter une photo de profil", href: "/dashboard/profile" },
  { key: "Description / biographie", icon: "✏️", label: "Compléter votre biographie", href: "/dashboard/profile" },
  { key: "Spécialités", icon: "🏥", label: "Renseigner vos spécialités", href: "/dashboard/profile" },
  { key: "Langues parlées", icon: "🌍", label: "Ajouter vos langues", href: "/dashboard/profile" },
  { key: "Modes de paiement", icon: "💳", label: "Configurer les modes de paiement", href: "/dashboard/profile" },
  { key: "Convention INAMI", icon: "✅", label: "Confirmer votre convention", href: "/dashboard/profile" },
  { key: "Numéro d'agrément INAMI", icon: "🔢", label: "Ajouter votre n° INAMI", href: "/dashboard/profile" },
  { key: "Délai moyen de rendez-vous", icon: "⏰", label: "Indiquer le délai moyen RDV", href: "/dashboard/profile" },
  { key: "Horaires de consultation", icon: "🕐", label: "Configurer vos horaires", href: "/dashboard/profile" },
  { key: "Collaborations avec d'autres praticiens", icon: "🤝", label: "Ajouter des collaborateurs", href: "/dashboard/profile" },
];

const DISMISS_KEY = "medsquare_banner_dismissed";

const ProfileCompletionBanner = ({ demoMode = false }: { demoMode?: boolean }) => {
  const { profile, isAdmin } = useAuth();
  const [score, setScore] = useState<number | null>(null);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [animatedScore, setAnimatedScore] = useState(0);
  const confettiFired = useRef(false);

  // Check localStorage dismiss
  useEffect(() => {
    const stored = localStorage.getItem(DISMISS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.date === new Date().toISOString().split("T")[0]) {
        setDismissed(true);
      }
    }
  }, []);

  const fetchProfileData = useCallback(async () => {
    if (demoMode) {
      setScore(35);
      setMissingFields([
        "Tarifs INAMI", "Questions & Réponses publiées", "Photo de profil",
        "Description / biographie", "Spécialités", "Langues parlées",
        "Modes de paiement", "Convention INAMI", "Numéro d'agrément INAMI",
        "Délai moyen de rendez-vous", "Horaires de consultation", "Collaborations avec d'autres praticiens"
      ]);
      return;
    }
    if (!profile?.id) return;
    const { data } = await supabase
      .from("profiles")
      .select("profile_score, missing_fields")
      .eq("id", profile.id)
      .maybeSingle();
    if (data) {
      setScore(data.profile_score ?? 0);
      setMissingFields(
        Array.isArray(data.missing_fields)
          ? (data.missing_fields as string[])
          : []
      );
    }
  }, [profile?.id, demoMode]);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  // Realtime subscription
  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel(`profile-score-${profile.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${profile.id}` },
        (payload) => {
          const p = payload.new as any;
          setScore(p.profile_score ?? 0);
          setMissingFields(Array.isArray(p.missing_fields) ? p.missing_fields : []);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id]);

  // Animate score
  useEffect(() => {
    if (score === null) return;
    const duration = 600;
    const start = performance.now();
    const from = animatedScore;
    const to = score;
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(from + (to - from) * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [score]);

  // Confetti when 100%
  useEffect(() => {
    if (score === 100 && !confettiFired.current) {
      confettiFired.current = true;
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.3 },
        colors: ["#534AB7", "#10B981", "#F59E0B", "#EC4899"],
      });
    }
  }, [score]);

  if ((!demoMode && isAdmin) || dismissed || score === null || (!demoMode && score >= 80)) return null;

  const visibleActions = ALL_ACTIONS.filter((a) =>
    missingFields.some((f) => f === a.key)
  );

  if (visibleActions.length === 0 && score >= 80) return null;

  const handleDismiss = () => {
    localStorage.setItem(
      DISMISS_KEY,
      JSON.stringify({ date: new Date().toISOString().split("T")[0] })
    );
    setDismissed(true);
  };

  const publicUrl = profile
    ? `/praticiens/${profile.id}`
    : "/praticiens";

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3 }}
      className="mb-6 rounded-xl border-l-[3px] p-5"
      style={{
        backgroundColor: "#EEEDFE",
        borderLeftColor: "#534AB7",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className="text-2xl shrink-0 mt-0.5">✨</span>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm" style={{ color: "#2D2670" }}>
              Votre fiche a été enrichie — complétez-la pour maximiser votre visibilité
            </h3>

            {/* Progress bar */}
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1">
                <Progress
                  value={animatedScore}
                  className="h-2.5 bg-white/60"
                  style={
                    {
                      "--progress-color":
                        animatedScore < 40
                          ? "#EF4444"
                          : animatedScore < 70
                          ? "#F59E0B"
                          : "#10B981",
                    } as React.CSSProperties
                  }
                />
              </div>
              <span
                className="text-sm font-bold tabular-nums shrink-0"
                style={{ color: "#534AB7" }}
              >
                {animatedScore}%
              </span>
            </div>
            <p className="text-xs mt-1" style={{ color: "#6B63C5" }}>
              Votre fiche est complète à {animatedScore}%
            </p>

            {/* Action chips */}
            <AnimatePresence>
              {visibleActions.length > 0 && (
                <motion.div className="flex flex-wrap gap-2 mt-3">
                  {visibleActions.map((action) => (
                    <motion.a
                      key={action.key}
                      href={action.href}
                      layout
                      initial={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.25 }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:shadow-md cursor-pointer"
                      style={{
                        backgroundColor: "white",
                        color: "#534AB7",
                        border: "1px solid #D4D0F0",
                      }}
                    >
                      <span>{action.icon}</span>
                      {action.label}
                    </motion.a>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Actions */}
            <div className="flex items-center gap-3 mt-4">
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium hover:underline"
                style={{ color: "#534AB7" }}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Voir ma fiche publique
              </a>
            </div>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 rounded-md hover:bg-white/50 transition-colors shrink-0"
          title="Fermer pour aujourd'hui"
        >
          <X className="h-4 w-4" style={{ color: "#8B83D4" }} />
        </button>
      </div>
    </motion.div>
  );
};

export default ProfileCompletionBanner;
