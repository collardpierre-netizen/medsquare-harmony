import { describe, it, expect } from "vitest";
import { checkWithinOpeningHours } from "../roomOpeningHours";

// Lundi 2026-10-19, heure de Bruxelles = UTC+2
const at = (iso: string) => new Date(iso);
const cfg = {
  weekly: {
    "0": { closed: true, start: 0, end: 0 },
    "1": { closed: false, start: 9, end: 17 },
    "2": { closed: false, start: 9, end: 17 },
    "3": { closed: false, start: 9, end: 17 },
    "4": { closed: false, start: 9, end: 17 },
    "5": { closed: false, start: 9, end: 17 },
    "6": { closed: true, start: 0, end: 0 },
  },
  periods: [{ from: "2026-12-24", to: "2026-12-26", closed: true, label: "Noël" }],
};

describe("checkWithinOpeningHours", () => {
  it("accepte un créneau dans la plage", () => {
    expect(checkWithinOpeningHours(cfg, at("2026-10-19T09:00:00+02:00"), at("2026-10-19T17:00:00+02:00"))).toBeNull();
  });
  it("refuse un créneau qui déborde", () => {
    expect(checkWithinOpeningHours(cfg, at("2026-10-19T08:30:00+02:00"), at("2026-10-19T10:00:00+02:00"))).toBe("outside");
    expect(checkWithinOpeningHours(cfg, at("2026-10-19T16:00:00+02:00"), at("2026-10-19T17:30:00+02:00"))).toBe("outside");
  });
  it("refuse un jour fermé et une période exceptionnelle", () => {
    expect(checkWithinOpeningHours(cfg, at("2026-10-18T10:00:00+02:00"), at("2026-10-18T11:00:00+02:00"))).toBe("closed");
    expect(checkWithinOpeningHours(cfg, at("2026-12-24T10:00:00+01:00"), at("2026-12-24T11:00:00+01:00"))).toBe("closed");
  });
  it("sans configuration, applique les horaires par défaut", () => {
    expect(checkWithinOpeningHours(null, at("2026-10-19T09:00:00+02:00"), at("2026-10-19T22:00:00+02:00"))).toBeNull();
    expect(checkWithinOpeningHours(null, at("2026-10-19T08:00:00+02:00"), at("2026-10-19T10:00:00+02:00"))).toBe("outside");
    expect(checkWithinOpeningHours(null, at("2026-10-18T08:00:00+02:00"), at("2026-10-18T10:00:00+02:00"))).toBe("outside");
  });
});
