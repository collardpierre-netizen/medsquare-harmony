/**
 * Helpers for room status (available / unavailable / privatized).
 *
 * Three distinct statuses (NEVER conflate them):
 *  1. "available"    → `is_available = true`, no privatization → bookable
 *  2. "unavailable"  → `is_available = false`, no dates       → permanently OUT of the rental park
 *                       (e.g. room demolished, under renovation, removed from offer)
 *  3. "privatized"   → `is_available = true` + `privatized_from` set, today within range
 *                       → reserved for a specific tenant on a date range
 *  4. "scheduled"    → `is_available = true` + `privatized_from` set, today before range
 *                       → privatization upcoming, still bookable until then
 *
 * Visual contract:
 *  - "unavailable" uses a NEUTRAL/MUTED grey badge (it's not a privatization, the room just isn't part of the offer)
 *  - "privatized"  uses the DESTRUCTIVE/RED badge (active reservation block)
 *  - "scheduled"   uses a WARNING/AMBER badge (upcoming, informational)
 */

export type RoomStatus = "available" | "unavailable" | "privatized" | "scheduled";

export interface RoomPrivatizationFields {
  is_available: boolean;
  privatized_from?: string | null;
  privatized_until?: string | null;
}

const todayISO = () => {
  const d = new Date();
  // Use Brussels date (YYYY-MM-DD)
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Brussels",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d);
};

/** True if the room is permanently UNAVAILABLE (removed from rental offer). NOT a privatization. */
export const isRoomUnavailable = (room: RoomPrivatizationFields): boolean => {
  return !room.is_available;
};

/** True if the room is privatized RIGHT NOW (scheduled-active). Excludes "unavailable" rooms. */
export const isRoomCurrentlyPrivatized = (room: RoomPrivatizationFields): boolean => {
  if (!room.is_available) return false;
  if (!room.privatized_from) return false;
  const today = todayISO();
  if (today < room.privatized_from) return false;
  if (room.privatized_until && today > room.privatized_until) return false;
  return true;
};

/** True if there's a future privatization scheduled (not active yet). */
export const isPrivatizationScheduled = (room: RoomPrivatizationFields): boolean => {
  if (!room.is_available) return false;
  if (!room.privatized_from) return false;
  return todayISO() < room.privatized_from;
};

/** Single source of truth: returns the room's current status. */
export const getRoomStatus = (room: RoomPrivatizationFields): RoomStatus => {
  if (!room.is_available) return "unavailable";
  if (isRoomCurrentlyPrivatized(room)) return "privatized";
  if (isPrivatizationScheduled(room)) return "scheduled";
  return "available";
};

/** True if the room is BLOCKED (can't be booked) RIGHT NOW — either unavailable or privatized. */
export const isRoomBlockedNow = (room: RoomPrivatizationFields): boolean => {
  const s = getRoomStatus(room);
  return s === "unavailable" || s === "privatized";
};

/** True if the room is privatized on a specific given day (scheduled). Excludes "unavailable" rooms. */
export const isRoomPrivatizedOnDay = (room: RoomPrivatizationFields, day: Date): boolean => {
  if (!room.is_available) return false;
  if (!room.privatized_from) return false;
  const dayISO = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Brussels",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(day);
  if (dayISO < room.privatized_from) return false;
  if (room.privatized_until && dayISO > room.privatized_until) return false;
  return true;
};

/** True if the room is BLOCKED on a specific day (unavailable OR privatized that day). */
export const isRoomBlockedOnDay = (room: RoomPrivatizationFields, day: Date): boolean => {
  if (!room.is_available) return true;
  return isRoomPrivatizedOnDay(room, day);
};

/** Format a date string (YYYY-MM-DD) as DD/MM/YYYY (Brussels). */
export const formatPrivatizationDate = (iso: string): string => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

/** Human-readable label about the PRIVATIZATION status only (returns null for "unavailable"). */
export const getPrivatizationLabel = (room: RoomPrivatizationFields): string | null => {
  if (!room.is_available) return null; // "unavailable" is NOT a privatization
  if (!room.privatized_from) return null;

  const today = todayISO();
  const from = formatPrivatizationDate(room.privatized_from);
  const until = room.privatized_until ? formatPrivatizationDate(room.privatized_until) : null;

  if (today < room.privatized_from) {
    return until
      ? `Privatisé du ${from} au ${until}`
      : `Privatisé à partir du ${from}`;
  }
  if (until) {
    if (today <= room.privatized_until!) return `Privatisé jusqu'au ${until}`;
    return null;
  }
  return `Privatisé depuis le ${from}`;
};

/** Human-readable label for ANY status (including "Indisponible"). */
export const getRoomStatusLabel = (room: RoomPrivatizationFields): string | null => {
  const status = getRoomStatus(room);
  if (status === "available") return null;
  if (status === "unavailable") return "Indisponible";
  return getPrivatizationLabel(room);
};
