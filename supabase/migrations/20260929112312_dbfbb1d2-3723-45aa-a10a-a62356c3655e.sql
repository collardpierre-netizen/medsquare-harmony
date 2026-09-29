ALTER TABLE public.practitioner_discounts ADD COLUMN applies_to text NOT NULL DEFAULT 'hourly';
ALTER TABLE public.practitioner_discounts ALTER COLUMN start_date DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.prevent_booking_overlap()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'cancelled' THEN RETURN NEW; END IF;
  IF EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.room_id = NEW.room_id AND b.id <> NEW.id AND b.status <> 'cancelled'
      AND b.start_time < NEW.end_time AND NEW.start_time < b.end_time
  ) THEN
    RAISE EXCEPTION 'Ce créneau chevauche une réservation existante dans cette salle.';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER bookings_prevent_overlap
BEFORE INSERT OR UPDATE OF room_id, start_time, end_time, status ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.prevent_booking_overlap();