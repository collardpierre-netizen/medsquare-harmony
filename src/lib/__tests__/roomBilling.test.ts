import { describe, it, expect } from "vitest";
import {
  BUFFER_MINUTES,
  bookingDurationHours,
  bookingOccupiedHours,
  computePractitionerBilling,
  computeRoomStats,
  roomBlockedHours,
  roomFlatFee,
  roomOpenHours,
  type BillingBooking,
  type BillingRoom,
} from "../roomBilling";
import { getRoomOpenHoursCount } from "../roomOpeningHours";

const weekly = (cfg: Record<number, { closed?: boolean; start?: number; end?: number }>) => ({
  weekly: Object.fromEntries(
    Array.from({ length: 7 }, (_, i) => [
      String(i),
      { closed: cfg[i]?.closed ?? false, start: cfg[i]?.start ?? 8, end: cfg[i]?.end ?? 22 },
    ]),
  ),
  periods: [] as any[],
});

/** Lundi 7 septembre 2026 → dimanche 13 septembre 2026. */
const week = Array.from({ length: 7 }, (_, i) => new Date(2026, 8, 7 + i, 12, 0, 0));
const septembre = [new Date(2026, 8, 1, 12, 0, 0)];

const officeHours = weekly({
  0: { closed: true },
  1: { start: 9, end: 17 },
  2: { start: 9, end: 17 },
  3: { start: 9, end: 17 },
  4: { start: 9, end: 17 },
  5: { start: 9, end: 17 },
  6: { closed: true },
});

const roomA: BillingRoom = {
  id: "room-a",
  name: "Cabinet N°1",
  hourly_rate: 20,
  is_available: true,
  opening_hours: officeHours,
};

const roomB: BillingRoom = {
  id: "room-b",
  name: "Cabinet N°2",
  hourly_rate: 30,
  is_available: true,
  opening_hours: officeHours,
};

const booking = (
  room: string,
  practitioner: string,
  day: number,
  startH: number,
  hours: number,
  status = "confirmed",
): BillingBooking => ({
  id: `${room}-${practitioner}-${day}-${startH}`,
  room_id: room,
  practitioner_id: practitioner,
  start_time: new Date(2026, 8, day, startH, 0, 0).toISOString(),
  end_time: new Date(2026, 8, day, startH + hours, 0, 0).toISOString(),
  status,
});

describe("plages d'ouverture", () => {
  it("compte les heures ouvrables et ignore les jours fermés", () => {
    expect(getRoomOpenHoursCount(officeHours, week[0])).toBe(8); // lundi 9h-17h
    expect(getRoomOpenHoursCount(officeHours, week[5])).toBe(0); // samedi fermé
    expect(roomOpenHours(roomA, week)).toBe(40); // 5 x 8h
  });

  it("applique les périodes de fermeture exceptionnelle", () => {
    const withHoliday: BillingRoom = {
      ...roomA,
      opening_hours: {
        ...officeHours,
        periods: [{ from: "2026-09-07", to: "2026-09-08", closed: true }],
      },
    };
    expect(roomOpenHours(withHoliday, week)).toBe(24); // 3 jours ouvrés restants
  });

  it("retombe sur les horaires par défaut sans configuration", () => {
    const noConfig: BillingRoom = { ...roomA, opening_hours: null };
    // Lun-Ven 8h-22h (14h) + Sam-Dim 9h-21h (12h)
    expect(roomOpenHours(noConfig, week)).toBe(5 * 14 + 2 * 12);
  });
});

describe("durées de réservation", () => {
  it("sépare durée facturable et durée occupée (battement)", () => {
    const b = booking("room-a", "p1", 7, 10, 2);
    expect(bookingDurationHours(b)).toBe(2);
    expect(bookingOccupiedHours(b)).toBeCloseTo(2 + (2 * BUFFER_MINUTES) / 60, 6);
  });
});

describe("taux de remplissage par salle", () => {
  it("calcule occupation, heures disponibles et CA horaire HTVA", () => {
    const bookings = [
      booking("room-a", "p1", 7, 10, 2),
      booking("room-a", "p2", 8, 14, 2),
      booking("room-a", "p2", 9, 14, 2, "cancelled"), // exclue
    ];
    const [a] = computeRoomStats({ rooms: [roomA], bookings, days: week, months: septembre });
    expect(a.totalHours).toBe(40);
    expect(a.bookingCount).toBe(2);
    expect(a.bookedHours).toBeCloseTo(5, 6); // 2 x (2h + 30 min de battement)
    expect(a.availableHours).toBeCloseTo(35, 6);
    expect(a.occupancyPct).toBe(13);
    expect(a.hourlyRevenue).toBe(80); // 4h x 20 €
    expect(a.coveredHourlyValue).toBe(0);
    expect(a.revenue).toBe(80);
  });

  it("compte une privatisation active comme 100% occupée", () => {
    const privatized: BillingRoom = {
      ...roomB,
      privatized_from: "2026-09-01",
      privatized_until: "2026-09-30",
      privatization_monthly_fee: 550,
    };
    const [b] = roomBlockedHours(privatized, week) === 40
      ? computeRoomStats({ rooms: [privatized], bookings: [], days: week, months: septembre })
      : [];
    expect(b.privatizedHours).toBe(40);
    expect(b.occupancyPct).toBe(100);
    expect(b.availableHours).toBe(0);
    expect(b.flatRevenue).toBe(550); // forfait HTVA
  });

  it("n'ajoute pas de facturation horaire sur un mois déjà couvert par le forfait de privatisation", () => {
    const privatized: BillingRoom = {
      ...roomB,
      privatized_from: "2026-09-01",
      privatization_monthly_fee: 550,
    };
    const [b] = computeRoomStats({
      rooms: [privatized],
      bookings: [booking("room-b", "p1", 7, 9, 3)],
      days: week,
      months: septembre,
    });
    expect(b.flatRevenue).toBe(550);
    expect(b.hourlyRevenue).toBe(0);
    expect(b.coveredHourlyValue).toBe(90); // 3h x 30 € tracées mais non facturées
    expect(b.revenue).toBe(550);
  });

  it("applique un forfait locataire une seule fois par mois et neutralise l'horaire du praticien", () => {
    const [a] = computeRoomStats({
      rooms: [roomA],
      bookings: [
        booking("room-a", "p1", 7, 9, 4),
        booking("room-a", "p1", 8, 9, 4),
        booking("room-a", "p2", 9, 9, 2), // autre praticien → facturé à l'heure
      ],
      packages: [{ practitioner_id: "p1", room_id: "room-a", monthly_fee: 275 }],
      days: week,
      months: septembre,
    });
    expect(a.flatRevenue).toBe(275);
    expect(a.coveredHourlyValue).toBe(160); // 8h x 20 €
    expect(a.hourlyRevenue).toBe(40); // 2h x 20 €
    expect(a.revenue).toBe(315);
  });

  it("trie les salles par ordre naturel", () => {
    const rooms = [
      { ...roomB, name: "Cabinet N°10" },
      { ...roomA, name: "Cabinet N°2" },
    ];
    const stats = computeRoomStats({ rooms, bookings: [], days: week, months: septembre });
    expect(stats.map((s) => s.name)).toEqual(["Cabinet N°2", "Cabinet N°10"]);
  });
});

describe("forfait de privatisation par mois", () => {
  it("ne compte que les mois concernés", () => {
    const room: BillingRoom = {
      ...roomA,
      privatized_from: "2026-10-01",
      privatization_monthly_fee: 600,
    };
    const months = [new Date(2026, 8, 15), new Date(2026, 9, 15), new Date(2026, 10, 15)];
    const res = roomFlatFee(room, months);
    expect(res.revenue).toBe(1200); // octobre + novembre
    expect([...res.months].sort()).toEqual(["2026-10", "2026-11"]);
  });

  it("facture tous les mois pour une salle indisponible en permanence", () => {
    const room: BillingRoom = {
      ...roomA,
      is_available: false,
      privatization_monthly_fee: 625,
    };
    expect(roomFlatFee(room, [new Date(2026, 8, 1), new Date(2026, 9, 1)]).revenue).toBe(1250);
  });
});

describe("facturation par praticien", () => {
  const rooms = [roomA, roomB];

  it("facture à l'heure sans forfait (HTVA)", () => {
    const res = computePractitionerBilling({
      bookings: [booking("room-a", "p1", 7, 9, 2), booking("room-b", "p1", 8, 9, 2)],
      rooms,
    });
    expect(res.hasFlat).toBe(false);
    expect(res.flat).toBe(0);
    expect(res.hourly).toBe(100); // 2h x 20 € + 2h x 30 €
    expect(res.billedHours).toBe(4);
    expect(res.total).toBe(100);
  });

  it("donne le lead au forfait sur le tarif horaire pour un même praticien", () => {
    const res = computePractitionerBilling({
      bookings: [
        booking("room-a", "p1", 7, 9, 4),
        booking("room-a", "p1", 8, 9, 4),
        booking("room-a", "p1", 14, 9, 4),
      ],
      rooms,
      packages: [{ practitioner_id: "p1", room_id: "room-a", monthly_fee: 275 }],
    });
    expect(res.hasFlat).toBe(true);
    expect(res.flat).toBe(275); // une seule fois pour le mois
    expect(res.hourly).toBe(0);
    expect(res.coveredHours).toBe(12);
    expect(res.coveredHourlyValue).toBe(240);
    expect(res.total).toBe(275);
  });

  it("cumule forfait (salle A) et horaire (salle B) pour un même praticien", () => {
    const res = computePractitionerBilling({
      bookings: [booking("room-a", "p1", 7, 9, 4), booking("room-b", "p1", 8, 9, 3)],
      rooms,
      packages: [{ practitioner_id: "p1", room_id: "room-a", monthly_fee: 275 }],
    });
    expect(res.flat).toBe(275);
    expect(res.hourly).toBe(90);
    expect(res.coveredHours).toBe(4);
    expect(res.billedHours).toBe(3);
    expect(res.total).toBe(365);
  });

  it("compte le forfait par mois distinct", () => {
    const bookings: BillingBooking[] = [
      booking("room-a", "p1", 7, 9, 2),
      {
        room_id: "room-a",
        practitioner_id: "p1",
        start_time: new Date(2026, 9, 5, 9, 0, 0).toISOString(),
        end_time: new Date(2026, 9, 5, 11, 0, 0).toISOString(),
        status: "confirmed",
      },
    ];
    const res = computePractitionerBilling({
      bookings,
      rooms,
      packages: [{ practitioner_id: "p1", room_id: "room-a", monthly_fee: 275 }],
    });
    expect(res.flat).toBe(550);
    expect(res.total).toBe(550);
  });

  it("exclut les réservations annulées", () => {
    const res = computePractitionerBilling({
      bookings: [booking("room-a", "p1", 7, 9, 2, "cancelled")],
      rooms,
    });
    expect(res.total).toBe(0);
    expect(res.billedHours).toBe(0);
  });
});
