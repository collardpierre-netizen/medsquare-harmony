-- Add a column to link recurring bookings together
ALTER TABLE public.bookings ADD COLUMN recurrence_group_id uuid DEFAULT NULL;

-- Index for efficient group lookups
CREATE INDEX idx_bookings_recurrence_group ON public.bookings (recurrence_group_id) WHERE recurrence_group_id IS NOT NULL;