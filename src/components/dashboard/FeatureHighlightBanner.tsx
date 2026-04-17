import { useEffect, useState } from "react";
import { Sparkles, X, UserPlus } from "lucide-react";

interface FeatureHighlightBannerProps {
  /** Stable key — bump when you publish a new highlight to re-show it. */
  storageKey: string;
  title: string;
  description: string;
  icon?: React.ReactNode;
}

const FeatureHighlightBanner = ({
  storageKey,
  title,
  description,
  icon,
}: FeatureHighlightBannerProps) => {
  const fullKey = `medsquare_feature_${storageKey}_dismissed`;
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(fullKey) === "1");
  }, [fullKey]);

  if (dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(fullKey, "1");
    setDismissed(true);
  };

  return (
    <div className="relative rounded-xl border border-primary/20 bg-primary/5 p-4 pr-10">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon ?? <Sparkles className="h-4 w-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
              Nouveauté
            </span>
          </div>
          <h3 className="font-semibold text-sm text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {description}
          </p>
        </div>
      </div>
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1 rounded-md hover:bg-primary/10 transition-colors text-muted-foreground hover:text-foreground"
        aria-label="Fermer"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

export { UserPlus };
export default FeatureHighlightBanner;
