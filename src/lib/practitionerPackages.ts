/**
 * Forfaits locataires (praticien + salle, mensuel récurrent).
 *
 * Règle métier :
 *  - Un forfait actif couvre 100% des mois où le praticien occupe la salle.
 *  - Lors du calcul de CA/facturation, on ajoute le forfait mensuel et on IGNORE
 *    les réservations horaires du praticien sur cette salle pour ce mois-là.
 */

export interface PractitionerPackage {
  id: string;
  practitioner_id: string;
  room_id: string;
  package_label: string;
  monthly_fee: number;
  is_active: boolean;
  /** Début d'application (ISO). */
  start_date?: string | null;
  /** Échéance (ISO). null = permanent ; après l'échéance, retour au tarif plein. */
  end_date?: string | null;
}

/** Retourne le forfait mensuel actif d'un praticien pour une salle, ou null. */
export const findActivePackage = (
  packages: PractitionerPackage[] | null | undefined,
  practitionerId: string | null | undefined,
  roomId: string | null | undefined,
): PractitionerPackage | null => {
  if (!packages || !practitionerId || !roomId) return null;
  return (
    packages.find(
      (p) => p.is_active && p.practitioner_id === practitionerId && p.room_id === roomId,
    ) ?? null
  );
};

/** True si le booking (praticien+salle) est couvert par un forfait mensuel actif. */
export const isBookingCoveredByPackage = (
  packages: PractitionerPackage[] | null | undefined,
  practitionerId: string | null | undefined,
  roomId: string | null | undefined,
): boolean => findActivePackage(packages, practitionerId, roomId) !== null;
