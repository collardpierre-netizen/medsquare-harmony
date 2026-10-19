import { getRoomDayHours } from "@/lib/roomOpeningHours";
import { setHours, setMinutes, addMinutes, isBefore } from "date-fns";

export interface Booking {
  id: string;
  practitioner_id: string;
  room_id: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  recurrence_group_id: string | null;
  profiles?: {
    first_name: string;
    last_name: string;
  };
}

export interface ActivitySessionSlot {
  id: string;
  activity_id: string;
  room_id: string | null;
  start_time: string;
  end_time: string;
  status: string;
  max_participants: number | null;
  activities?: {
    title: string;
    category: string;
    profiles?: {
      first_name: string;
      last_name: string;
    };
  };
}

/**
 * Plages d'ouverture d'un jour donné.
 * Si `roomOpeningHours` (rooms.opening_hours) est fourni, les horaires propres
 * à la salle (grille hebdo + périodes exceptionnelles) sont utilisés ; sinon
 * fallback sur les horaires par défaut (8h–22h en semaine, 9h–21h le week-end).
 * Un jour fermé renvoie { closed: true, start: 0, end: 0 }.
 */
export const getOpeningHours = (date: Date, roomOpeningHours?: unknown) =>
  getRoomDayHours(roomOpeningHours, date);

export const generateTimeSlots = (
  startHour: number,
  endHour: number,
  interval: number
) => {
  const slots: Date[] = [];
  const base = new Date(2000, 0, 1);
  let current = setMinutes(setHours(base, startHour), 0);
  const end = setMinutes(setHours(base, endHour), 0);
  while (isBefore(current, end)) {
    slots.push(current);
    current = addMinutes(current, interval);
  }
  return slots;
};

/** Generate time slots for a specific date, respecting weekday/weekend hours */
export const generateTimeSlotsForDate = (date: Date, interval: number, roomOpeningHours?: unknown) => {
  const { start, end } = getOpeningHours(date, roomOpeningHours);
  return generateTimeSlots(start, end, interval);
};
