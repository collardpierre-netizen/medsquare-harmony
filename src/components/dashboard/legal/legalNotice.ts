import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const LEGAL_NOTICE_KEY = "legal_notice";

export interface LegalNotice {
  enabled: boolean;
  title: string;
  message: string;
  /** Date d'effet (format ISO yyyy-MM-dd), vide si non définie */
  effectiveDate: string;
  /** Date de dernière mise à jour de l'encart (ISO), vide si jamais enregistré */
  updatedAt: string;
}

export const DEFAULT_LEGAL_NOTICE: LegalNotice = {
  enabled: true,
  title: "Tarifs horaires et réductions",
  message:
    "Les tarifs horaires et réductions accordées restent évolutifs et peuvent faire l'objet d'une adaptation annuelle pour tenir compte des variations des coûts d'exploitation (chauffage, énergie, nettoyage, services partagés). Toute modification sera notifiée par écrit avec un préavis de trois (3) mois. Le locataire conserve le droit de résilier son bail si la révision lui est inacceptable.",
  effectiveDate: "",
  updatedAt: "",
};

export const fetchLegalNotice = async (): Promise<LegalNotice> => {
  const { data } = await supabase
    .from("settings")
    .select("value, updated_at")
    .eq("key", LEGAL_NOTICE_KEY)
    .maybeSingle();

  const value = (data?.value as Partial<LegalNotice> | null) || null;
  if (!value) return DEFAULT_LEGAL_NOTICE;

  return {
    enabled: value.enabled ?? DEFAULT_LEGAL_NOTICE.enabled,
    title: value.title || DEFAULT_LEGAL_NOTICE.title,
    message: value.message || DEFAULT_LEGAL_NOTICE.message,
    effectiveDate: value.effectiveDate || "",
    updatedAt: (data as any)?.updated_at || "",
  };
};


export const useLegalNotice = () => {
  const [notice, setNotice] = useState<LegalNotice | null>(null);

  useEffect(() => {
    fetchLegalNotice().then(setNotice);
  }, []);

  return notice;
};

/** Formatage FR/Bruxelles d'une date ISO (jour/mois/année). */
export const formatNoticeDate = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("fr-BE", {
    timeZone: "Europe/Brussels",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
};


/** jsPDF built-in fonts don't support accents — strip diacritics for PDF output. */
export const toPdfSafeText = (text: string) =>
  text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
