import { setHours, setMinutes, addMinutes, isBefore } from "date-fns";

export interface Booking {
  id: string;
  practitioner_id: string;
  room_id: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  profiles?: {
    first_name: string;
    last_name: string;
  };
}

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
