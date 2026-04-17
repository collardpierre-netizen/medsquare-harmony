/**
 * Helpers for room privatization (immediate or scheduled).
 *
 * Logic:
 * - `is_available = false` → permanently privatized (immediate, no end date)
 * - `is_available = true` + `privatized_from` set → scheduled privatization
 *   - active when today >= privatized_from AND (privatized_until is null OR today <= privatized_until)
 */

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

/** True if the room is privatized RIGHT NOW (immediate or scheduled-active). */
export const isRoomCurrentlyPrivatized = (room: RoomPrivatizationFields): boolean => {
  if (!room.is_available) return true;
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

/** True if the room is privatized on a specific given day (immediate or scheduled). */
export const isRoomPrivatizedOnDay = (room: RoomPrivatizationFields, day: Date): boolean => {
  if (!room.is_available) return true;
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

/** Format a date string (YYYY-MM-DD) as DD/MM/YYYY (Brussels). */
export const formatPrivatizationDate = (iso: string): string => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

/** Human-readable label about the privatization status. */
export const getPrivatizationLabel = (room: RoomPrivatizationFields): string | null => {
  if (!room.is_available) return "Privatisé";
  if (!room.privatized_from) return null;

  const today = todayISO();
  const from = formatPrivatizationDate(room.privatized_from);
  const until = room.privatized_until ? formatPrivatizationDate(room.privatized_until) : null;

  if (today < room.privatized_from) {
    return until
      ? `Privatisé du ${from} au ${until}`
      : `Privatisé à partir du ${from}`;
  }
  // Currently active scheduled privatization
  if (until) {
    if (today <= room.privatized_until!) return `Privatisé jusqu'au ${until}`;
    return null; // expired
  }
  return `Privatisé depuis le ${from}`;
};
