import { setHours, setMinutes, addMinutes, isBefore, isWeekend } from "date-fns";

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

/** Returns opening hours based on day type */
export const getOpeningHours = (date: Date) => {
  if (isWeekend(date)) {
    return { start: 8, end: 21 };
  }
  return { start: 8, end: 22 };
};

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
export const generateTimeSlotsForDate = (date: Date, interval: number) => {
  const { start, end } = getOpeningHours(date);
  return generateTimeSlots(start, end, interval);
};
