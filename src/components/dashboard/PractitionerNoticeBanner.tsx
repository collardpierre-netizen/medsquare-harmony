import { useEffect, useState } from "react";
import { AlertTriangle, Info, Megaphone, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface PractitionerNotice {
  enabled: boolean;
  type: "info" | "works" | "warning" | "announcement";
  title: string;
  message: string;
}

export const DEFAULT_PRACTITIONER_NOTICE: PractitionerNotice = {
  enabled: false,
  type: "info",
  title: "",
  message: "",
};

export const NOTICE_TYPES: {
  value: PractitionerNotice["type"];
  label: string;
}[] = [
  { value: "info", label: "Information" },
  { value: "works", label: "Travaux" },
  { value: "warning", label: "Avertissement" },
  { value: "announcement", label: "Annonce" },
];

const styles: Record<PractitionerNotice["type"], { icon: typeof Info; card: string; badge: string; text: string }> = {
  info: {
    icon: Info,
    card: "border-primary/20 bg-primary/5",
    badge: "bg-primary/10 text-primary",
    text: "text-primary",
  },
  works: {
    icon: Wrench,
    card: "border-amber-200 bg-amber-50/60",
    badge: "bg-amber-100 text-amber-700",
    text: "text-amber-700",
  },
  warning: {
    icon: AlertTriangle,
    card: "border-destructive/30 bg-destructive/5",
    badge: "bg-destructive/10 text-destructive",
    text: "text-destructive",
  },
  announcement: {
    icon: Megaphone,
    card: "border-border bg-muted/50",
    badge: "bg-muted text-foreground",
    text: "text-foreground",
  },
};

export function usePractitionerNotice() {
  const [notice, setNotice] = useState<PractitionerNotice | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "practitioner_notice")
        .maybeSingle();
      setNotice(data?.value ? { ...DEFAULT_PRACTITIONER_NOTICE, ...(data.value as any) } : DEFAULT_PRACTITIONER_NOTICE);
      setLoading(false);
    };
    fetch();
  }, []);

  return { notice, loading };
}

const PractitionerNoticeBanner = ({ notice }: { notice?: PractitionerNotice }) => {
  const fetched = usePractitionerNotice();
  const value = notice ?? fetched.notice;

  if (!value || !value.enabled || (!value.title && !value.message)) return null;

  const style = styles[value.type] || styles.info;
  const Icon = style.icon;

  return (
    <Card className={cn("shadow-none", style.card)}>
      <CardContent className="flex items-start gap-4 pt-6 pb-5">
        <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center shrink-0", style.badge)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          {value.title && (
            <p className={cn("font-semibold", style.text)}>{value.title}</p>
          )}
          {value.message && (
            <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{value.message}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default PractitionerNoticeBanner;
