/**
 * Plages d'ouverture par salle.
 *
 * Modèle stocké dans `rooms.opening_hours` (jsonb) :
 * {
 *   weekly: { "0".."6": { closed: boolean, start: number, end: number } },  // 0 = dimanche
 *   periods: [ { from: "YYYY-MM-DD", to: "YYYY-MM-DD", label?: string, closed: boolean, start?: number, end?: number } ]
 * }
 *
 * Fallback quand rien n'est encodé : semaine 8h–22h, week-end 9h–21h
 * (l'ancien comportement codé en dur).
 */

export interface DayHours {
  closed: boolean;
  start: number;
  end: number;
}

export interface OpeningPeriod {
  from: string;
  to: string;
  label?: string;
  closed: boolean;
  start?: number;
  end?: number;
}

export interface RoomOpeningHours {
  weekly: Record<string, DayHours>;
  periods: OpeningPeriod[];
}

export const DAY_LABELS = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
];

/** Horaires par défaut (identiques à l'ancienne logique globale). */
export const defaultDayHours = (weekday: number): DayHours =>
  weekday === 0 || weekday === 6
    ? { closed: false, start: 9, end: 21 }
    : { closed: false, start: 8, end: 22 };

export const defaultOpeningHours = (): RoomOpeningHours => ({
  weekly: Object.fromEntries(
    Array.from({ length: 7 }, (_, i) => [String(i), defaultDayHours(i)]),
  ),
  periods: [],
});

/** Normalise une valeur jsonb (potentiellement nulle/partielle) en structure complète. */
export const parseOpeningHours = (raw: unknown): RoomOpeningHours => {
  const base = defaultOpeningHours();
  if (!raw || typeof raw !== "object") return base;
  const val = raw as Partial<RoomOpeningHours>;
  const weekly = { ...base.weekly };
  if (val.weekly && typeof val.weekly === "object") {
    for (let i = 0; i < 7; i++) {
      const d = (val.weekly as Record<string, DayHours>)[String(i)];
      if (d && typeof d === "object") {
        weekly[String(i)] = {
          closed: !!d.closed,
          start: Number.isFinite(d.start) ? Number(d.start) : base.weekly[String(i)].start,
          end: Number.isFinite(d.end) ? Number(d.end) : base.weekly[String(i)].end,
        };
      }
    }
  }
  const periods = Array.isArray(val.periods)
    ? (val.periods.filter((p) => p && p.from && p.to) as OpeningPeriod[])
    : [];
  return { weekly, periods };
};

const brusselsISODate = (date: Date): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Brussels",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

const brusselsWeekday = (date: Date): number => {
  const iso = brusselsISODate(date);
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

/**
 * Retourne les heures d'ouverture effectives d'une salle pour un jour donné.
 * Les périodes exceptionnelles ont priorité sur la grille hebdomadaire.
 */
export const getRoomDayHours = (
  openingHours: unknown,
  date: Date,
): DayHours => {
  const cfg = parseOpeningHours(openingHours);
  const iso = brusselsISODate(date);
  const period = cfg.periods.find((p) => iso >= p.from && iso <= p.to);
  if (period) {
    if (period.closed) return { closed: true, start: 0, end: 0 };
    const weekday = brusselsWeekday(date);
    const fallback = cfg.weekly[String(weekday)] ?? defaultDayHours(weekday);
    return {
      closed: false,
      start: Number.isFinite(period.start) ? Number(period.start) : fallback.start,
      end: Number.isFinite(period.end) ? Number(period.end) : fallback.end,
    };
  }
  const weekday = brusselsWeekday(date);
  const day = cfg.weekly[String(weekday)] ?? defaultDayHours(weekday);
  if (day.closed || day.end <= day.start) return { closed: true, start: 0, end: 0 };
  return day;
};

/** Nombre d'heures ouvrables d'une salle pour un jour donné (0 si fermée). */
export const getRoomOpenHoursCount = (openingHours: unknown, date: Date): number => {
  const { closed, start, end } = getRoomDayHours(openingHours, date);
  return closed ? 0 : Math.max(0, end - start);
};

/** Résumé lisible de la grille hebdomadaire (ex. "Lun–Ven 8h–22h • Sam-Dim fermé"). */
export const summarizeOpeningHours = (openingHours: unknown): string => {
  const cfg = parseOpeningHours(openingHours);
  const parts: string[] = [];
  const order = [1, 2, 3, 4, 5, 6, 0];
  let i = 0;
  while (i < order.length) {
    const d = cfg.weekly[String(order[i])];
    let j = i;
    while (
      j + 1 < order.length &&
      cfg.weekly[String(order[j + 1])].closed === d.closed &&
      cfg.weekly[String(order[j + 1])].start === d.start &&
      cfg.weekly[String(order[j + 1])].end === d.end
    ) {
      j++;
    }
    const label =
      i === j
        ? DAY_LABELS[order[i]].slice(0, 3)
        : `${DAY_LABELS[order[i]].slice(0, 3)}–${DAY_LABELS[order[j]].slice(0, 3)}`;
    parts.push(d.closed ? `${label} fermé` : `${label} ${d.start}h–${d.end}h`);
    i = j + 1;
  }
  return parts.join(" • ");
};

const brusselsMinutesOfDay = (date: Date): number => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Brussels",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
};

export type OpeningHoursViolation = "closed" | "outside" | "multi_day";

/**
 * Vérifie qu'un créneau [start, end[ respecte les plages d'ouverture de la salle
 * (grille hebdomadaire + périodes exceptionnelles). Retourne null si OK,
 * sinon le motif du refus.
 */
export const checkWithinOpeningHours = (
  openingHours: unknown,
  start: Date,
  end: Date,
): OpeningHoursViolation | null => {
  if (brusselsISODate(start) !== brusselsISODate(end) && brusselsMinutesOfDay(end) !== 0) {
    return "multi_day";
  }
  const day = getRoomDayHours(openingHours, start);
  if (day.closed) return "closed";
  const s = brusselsMinutesOfDay(start);
  const e = brusselsISODate(start) !== brusselsISODate(end) ? 24 * 60 : brusselsMinutesOfDay(end);
  if (s < day.start * 60 || e > day.end * 60 || e <= s) return "outside";
  return null;
};

/** Message lisible (FR) pour un refus lié aux horaires d'ouverture. */
export const describeOpeningHoursViolation = (
  openingHours: unknown,
  date: Date,
  violation: OpeningHoursViolation,
): string => {
  const label = new Intl.DateTimeFormat("fr-BE", {
    timeZone: "Europe/Brussels",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
  if (violation === "closed") return `Le local est fermé le ${label}.`;
  if (violation === "multi_day") return "Une réservation ne peut pas s'étendre sur plusieurs jours.";
  const { start, end } = getRoomDayHours(openingHours, date);
  return `Le ${label}, le local est ouvert de ${start}h à ${end}h.`;
};
