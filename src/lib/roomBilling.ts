/**
 * Calculs purs de remplissage et de facturation par salle / par praticien.
 *
 * Régime fiscal : TOUS les montants manipulés ici sont HTVA
 *  - `rooms.hourly_rate` : tarif horaire HTVA
 *  - `rooms.privatization_monthly_fee` : forfait mensuel HTVA (salle privatisée)
 *  - `practitioner_room_packages.monthly_fee` : forfait locataire mensuel HTVA
 *
 * Règle métier : pour un même praticien, le FORFAIT prend le lead sur le tarif
 * horaire. Les réservations couvertes par un forfait ne sont jamais facturées à
 * l'heure ; leur valeur horaire théorique est tracée séparément
 * (`coveredHourlyValue`) pour rester visible dans l'UI.
 */

import { isRoomBlockedOnDay } from "./roomPrivatization";
import { getRoomOpenHoursCount } from "./roomOpeningHours";

/** Battement (min) ajouté avant ET après chaque réservation pour l'occupation. */
export const BUFFER_MINUTES = 15;

export interface BillingRoom {
  id: string;
  name: string;
  hourly_rate?: number | null;
  is_available: boolean;
  privatized_from?: string | null;
  privatized_until?: string | null;
  privatization_monthly_fee?: number | null;
  opening_hours?: unknown;
}

export interface BillingBooking {
  id?: string;
  room_id: string;
  practitioner_id: string;
  start_time: string;
  end_time: string;
  status?: string;
  /** Remise ponctuelle encodée sur la réservation (prend le lead sur la remise contractuelle). */
  discount_type?: DiscountType | null;
  discount_value?: number | null;
  discount_reason?: string | null;
}

export interface BillingPackage {
  practitioner_id: string;
  room_id: string;
  monthly_fee: number;
  /** Début de validité du forfait (ISO date). Absent = toujours valable. */
  start_date?: string | null;
  /** Échéance du forfait (ISO date). Absent/null = forfait permanent. */
  end_date?: string | null;
  is_active?: boolean | null;
}

/**
 * Un forfait s'applique à un mois donné s'il chevauche ce mois
 * (échéance nulle = permanent). Après l'échéance, retour au tarif plein.
 */
export const isPackageActiveInMonth = (pkg: BillingPackage, mKey: string): boolean => {
  if (pkg.is_active === false) return false;
  const monthStart = `${mKey}-01`;
  const [y, m] = mKey.split("-").map(Number);
  const monthEnd = isoDate(new Date(y, m, 0));
  if (pkg.start_date && pkg.start_date > monthEnd) return false;
  if (pkg.end_date && pkg.end_date < monthStart) return false;
  return true;
};


/** Types de remise : % du montant, montant fixe HTVA, ou tarif horaire négocié. */
export type DiscountType = "percent" | "amount" | "hourly_rate";

/** Remise contractuelle par praticien (éventuellement limitée à une salle et à une période). */
export interface BillingDiscount {
  practitioner_id: string;
  room_id?: string | null;
  discount_type: DiscountType;
  discount_value: number;
  label?: string | null;
  start_date: string;
  end_date?: string | null;
  is_active?: boolean | null;
}

/**
 * Remise contractuelle applicable à une réservation :
 * une remise spécifique à la salle prend le lead sur une remise globale.
 */
export const findDiscount = (
  discounts: BillingDiscount[],
  practitionerId: string,
  roomId: string,
  dayIso: string,
): BillingDiscount | null => {
  const matches = discounts.filter(
    (d) =>
      d.practitioner_id === practitionerId &&
      d.is_active !== false &&
      (!d.room_id || d.room_id === roomId) &&
      d.start_date <= dayIso &&
      (!d.end_date || d.end_date >= dayIso),
  );
  if (matches.length === 0) return null;
  return matches.find((d) => d.room_id === roomId) ?? matches[0];
};

export interface DiscountedAmount {
  /** Montant HTVA avant remise (tarif horaire x heures). */
  gross: number;
  /** Montant HTVA facturé après remise. */
  net: number;
  /** Montant de la remise (gross - net, jamais négatif). */
  discount: number;
  /** Type de remise appliquée, ou null. */
  appliedType: DiscountType | null;
  /** Libellé/motif de la remise appliquée. */
  label: string | null;
}

/**
 * Montant facturé d'une réservation, remise incluse.
 * Priorité : remise ponctuelle sur la réservation > remise contractuelle du praticien.
 */
export const bookingBilledAmount = (
  booking: BillingBooking,
  hourlyRate: number,
  discounts: BillingDiscount[] = [],
): DiscountedAmount => {
  const hours = bookingDurationHours(booking);
  const gross = Number(hourlyRate || 0) * hours;

  let type: DiscountType | null = null;
  let value = 0;
  let label: string | null = null;

  if (booking.discount_type && Number(booking.discount_value || 0) > 0) {
    type = booking.discount_type;
    value = Number(booking.discount_value);
    label = booking.discount_reason ?? "Remise sur la réservation";
  } else {
    const d = findDiscount(
      discounts,
      booking.practitioner_id,
      booking.room_id,
      isoDate(new Date(booking.start_time)),
    );
    if (d && Number(d.discount_value || 0) > 0) {
      type = d.discount_type;
      value = Number(d.discount_value);
      label = d.label ?? "Remise contractuelle";
    }
  }

  if (!type) return { gross, net: gross, discount: 0, appliedType: null, label: null };

  let net = gross;
  if (type === "percent") net = gross * (1 - Math.min(100, value) / 100);
  else if (type === "amount") net = gross - value;
  else if (type === "hourly_rate") net = value * hours;

  net = Math.max(0, net);
  return { gross, net, discount: Math.max(0, gross - net), appliedType: type, label };
};


/** Clé mois "YYYY-MM" en heure de Bruxelles. */
export const monthKey = (date: Date): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Brussels",
    year: "numeric",
    month: "2-digit",
  })
    .format(date)
    .slice(0, 7);

/** Date ISO "YYYY-MM-DD" en heure de Bruxelles. */
export const isoDate = (date: Date): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Brussels",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

/** Durée facturable (heures, sans battement). */
export const bookingDurationHours = (b: BillingBooking): number =>
  (new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 3600000;

/** Durée occupée (heures, battement inclus). */
export const bookingOccupiedHours = (b: BillingBooking): number =>
  bookingDurationHours(b) + (2 * BUFFER_MINUTES) / 60;

/** Heures ouvrables d'une salle sur une liste de jours (selon plages d'ouverture). */
export const roomOpenHours = (room: BillingRoom, days: Date[]): number =>
  days.reduce((sum, d) => sum + getRoomOpenHoursCount(room.opening_hours, d), 0);

/** Heures bloquées (privatisation active) d'une salle sur une liste de jours. */
export const roomBlockedHours = (room: BillingRoom, days: Date[]): number =>
  days.reduce(
    (sum, d) =>
      sum + (isRoomBlockedOnDay(room as any, d) ? getRoomOpenHoursCount(room.opening_hours, d) : 0),
    0,
  );

/**
 * Forfait de privatisation applicable à une salle sur les mois donnés.
 * `months` : un Date par mois concerné.
 */
export const roomFlatFee = (
  room: BillingRoom,
  months: Date[],
): { revenue: number; months: Set<string> } => {
  const fee = Number(room.privatization_monthly_fee || 0);
  const applied = new Set<string>();
  if (fee <= 0) return { revenue: 0, months: applied };
  months.forEach((m) => {
    const mKey = monthKey(m);
    const mStart = `${mKey}-01`;
    const mEnd = `${mKey}-31`;
    let applies = false;
    if (!room.is_available) {
      applies = true;
    } else if (room.privatized_from) {
      const startsBeforeEnd = room.privatized_from <= mEnd;
      const endsAfterStart = !room.privatized_until || room.privatized_until >= mStart;
      applies = startsBeforeEnd && endsAfterStart;
    }
    if (applies) applied.add(mKey);
  });
  return { revenue: applied.size * fee, months: applied };
};

export interface RoomStats {
  id: string;
  name: string;
  /** Heures ouvrables (plages d'ouverture) sur la période. */
  totalHours: number;
  /** Heures réservées (battement inclus) — confirmées + pré-réservations. */
  bookedHours: number;
  /** Heures réservées confirmées (battement inclus). */
  confirmedHours: number;
  /** Heures pré-réservées (statut « en attente », battement inclus). */
  pendingHours: number;
  /** Heures bloquées par privatisation. */
  privatizedHours: number;
  /** Heures encore disponibles à la vente. */
  availableHours: number;
  bookingCount: number;
  /** Nombre de pré-réservations (en attente de validation). */
  pendingCount: number;
  occupancyPct: number;
  /** Occupation confirmée (réservations confirmées + privatisation). */
  confirmedOccupancyPct: number;
  /** Occupation liée aux pré-réservations uniquement. */
  pendingOccupancyPct: number;
  /** CA forfaitaire HTVA (privatisation + forfaits locataires). */
  flatRevenue: number;
  /** CA horaire HTVA réellement facturé (hors forfait, remises déduites). */
  hourlyRevenue: number;
  /** CA horaire HTVA potentiel des pré-réservations (non validé). */
  pendingHourlyRevenue: number;
  /** Remises accordées sur la période (HTVA). */
  discountTotal: number;
  /** Valeur horaire déjà couverte par un forfait (informatif, non facturé). */
  coveredHourlyValue: number;
  /** flatRevenue + hourlyRevenue */
  revenue: number;
}


/**
 * Statistiques d'occupation et de revenus par salle.
 * `days` : jours de la période ; `months` : mois couverts par la période.
 */
export const computeRoomStats = ({
  rooms,
  bookings,
  packages = [],
  discounts = [],
  days,
  months,
}: {
  rooms: BillingRoom[];
  bookings: BillingBooking[];
  packages?: BillingPackage[];
  discounts?: BillingDiscount[];
  days: Date[];
  months: Date[];
}): RoomStats[] => {
  const dayKeys = new Set(days.map(isoDate));
  const monthKeys = new Set(months.map(monthKey));

  const stats = new Map<
    string,
    RoomStats & { flatMonths: Set<string>; packagedKeys: Set<string> }
  >();

  rooms.forEach((room) => {
    const totalHours = roomOpenHours(room, days);
    const privatizedHours = roomBlockedHours(room, days);
    const flat = roomFlatFee(room, months);
    stats.set(room.id, {
      id: room.id,
      name: room.name,
      totalHours,
      bookedHours: 0,
      confirmedHours: 0,
      pendingHours: 0,
      privatizedHours,
      availableHours: 0,
      bookingCount: 0,
      pendingCount: 0,
      occupancyPct: 0,
      confirmedOccupancyPct: 0,
      pendingOccupancyPct: 0,
      flatRevenue: flat.revenue,
      hourlyRevenue: 0,
      pendingHourlyRevenue: 0,
      discountTotal: 0,
      coveredHourlyValue: 0,
      revenue: 0,
      flatMonths: flat.months,
      packagedKeys: new Set<string>(),
    });
  });

  // Forfaits locataires : ajoutés pour chaque mois de la période où le forfait est
  // valide (échéance incluse) et si la salle n'est pas déjà facturée via un forfait
  // de privatisation ce mois-là.
  packages.forEach((pkg) => {
    const s = stats.get(pkg.room_id);
    if (!s) return;
    monthKeys.forEach((mKey) => {
      if (s.flatMonths.has(mKey)) return;
      if (!isPackageActiveInMonth(pkg, mKey)) return;
      s.flatRevenue += Number(pkg.monthly_fee || 0);
      s.packagedKeys.add(`${pkg.practitioner_id}|${mKey}`);
    });
  });


  bookings.forEach((b) => {
    if (b.status === "cancelled") return;
    if (!dayKeys.has(isoDate(new Date(b.start_time)))) return;
    const s = stats.get(b.room_id);
    if (!s) return;
    const room = rooms.find((r) => r.id === b.room_id)!;
    const occupied = bookingOccupiedHours(b);
    const isPending = b.status === "pending";
    s.bookedHours += occupied;
    s.bookingCount += 1;
    if (isPending) {
      s.pendingHours += occupied;
      s.pendingCount += 1;
    } else {
      s.confirmedHours += occupied;
    }

    const mKey = monthKey(new Date(b.start_time));
    const amount = bookingBilledAmount(b, Number(room.hourly_rate || 0), discounts);
    const coveredByFlat =
      s.flatMonths.has(mKey) || s.packagedKeys.has(`${b.practitioner_id}|${mKey}`);
    if (coveredByFlat) {
      s.coveredHourlyValue += amount.gross;
    } else if (isPending) {
      s.pendingHourlyRevenue += amount.net;
    } else {
      s.hourlyRevenue += amount.net;
      s.discountTotal += amount.discount;
    }
  });

  return Array.from(stats.values())
    .map(({ flatMonths, packagedKeys, ...s }) => {
      const occupied = Math.min(s.totalHours, s.bookedHours + s.privatizedHours);
      const confirmedOccupied = Math.min(s.totalHours, s.confirmedHours + s.privatizedHours);
      const pct = (h: number) =>
        s.totalHours > 0 ? Math.min(100, Math.round((h / s.totalHours) * 100)) : 0;
      return {
        ...s,
        availableHours: Math.max(0, s.totalHours - occupied),
        occupancyPct: pct(occupied),
        confirmedOccupancyPct: pct(confirmedOccupied),
        pendingOccupancyPct: Math.max(0, pct(occupied) - pct(confirmedOccupied)),
        revenue: s.flatRevenue + s.hourlyRevenue,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "fr", { numeric: true }));
};


/**
 * Forfait locataire d'un praticien pour une salle, valide au mois demandé.
 * `mKey` (format YYYY-MM) omis = validité ignorée (compatibilité).
 */
export const findPackage = (
  packages: BillingPackage[],
  practitionerId: string,
  roomId: string,
  mKey?: string,
): BillingPackage | null =>
  packages.find(
    (p) =>
      p.practitioner_id === practitionerId &&
      p.room_id === roomId &&
      (!mKey || isPackageActiveInMonth(p, mKey)),
  ) ?? null;

export interface PractitionerBilling {
  /** Forfaits mensuels HTVA (une fois par salle et par mois). */
  flat: number;
  /** Réservations horaires HTVA hors forfait, confirmées, remises déduites. */
  hourly: number;
  /** Réservations horaires HTVA en pré-réservation (non validées). */
  pendingHourly: number;
  /** Heures pré-réservées (non validées). */
  pendingHours: number;
  /** Remises accordées (HTVA) sur les réservations confirmées. */
  discountTotal: number;
  /** Valeur horaire incluse au forfait (informatif). */
  coveredHourlyValue: number;
  /** Heures incluses au forfait. */
  coveredHours: number;
  /** Heures facturées à l'heure (confirmées). */
  billedHours: number;
  total: number;
  hasFlat: boolean;
}

/**
 * Facturation d'un praticien : forfaits (lead) + réservations horaires non couvertes,
 * remises (contractuelles ou ponctuelles) déduites. Les pré-réservations
 * (statut « en attente ») sont comptabilisées séparément et hors total facturé.
 */
export const computePractitionerBilling = ({
  bookings,
  rooms,
  packages = [],
  discounts = [],
}: {
  bookings: BillingBooking[];
  rooms: BillingRoom[];
  packages?: BillingPackage[];
  discounts?: BillingDiscount[];
}): PractitionerBilling => {
  let flat = 0;
  let hourly = 0;
  let pendingHourly = 0;
  let pendingHours = 0;
  let discountTotal = 0;
  let coveredHourlyValue = 0;
  let coveredHours = 0;
  let billedHours = 0;
  const flatKeys = new Set<string>();

  bookings.forEach((b) => {
    if (b.status === "cancelled") return;
    const room = rooms.find((r) => r.id === b.room_id);
    const rate = Number(room?.hourly_rate || 0);
    const hours = bookingDurationHours(b);
    const amount = bookingBilledAmount(b, rate, discounts);
    const isPending = b.status === "pending";
    const bMonth = monthKey(new Date(b.start_time));
    const pkg = findPackage(packages, b.practitioner_id, b.room_id, bMonth);
    if (pkg) {
      const key = `${b.room_id}|${monthKey(new Date(b.start_time))}`;
      if (!flatKeys.has(key)) {
        flatKeys.add(key);
        flat += Number(pkg.monthly_fee || 0);
      }
      coveredHourlyValue += amount.gross;
      coveredHours += hours;
    } else if (isPending) {
      pendingHourly += amount.net;
      pendingHours += hours;
    } else {
      hourly += amount.net;
      discountTotal += amount.discount;
      billedHours += hours;
    }
  });

  return {
    flat,
    hourly,
    pendingHourly,
    pendingHours,
    discountTotal,
    coveredHourlyValue,
    coveredHours,
    billedHours,
    total: flat + hourly,
    hasFlat: flatKeys.size > 0,
  };
};

