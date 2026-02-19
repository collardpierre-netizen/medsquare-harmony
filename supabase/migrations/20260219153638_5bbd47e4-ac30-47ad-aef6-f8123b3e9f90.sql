-- Add optional activity link to bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS activity_id uuid REFERENCES public.activities(id) ON DELETE SET NULL;
