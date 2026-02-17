-- Add break duration between appointments for practitioners
ALTER TABLE public.profiles ADD COLUMN break_minutes integer NOT NULL DEFAULT 15;

-- Add booking_enabled flag to activities so practitioners can enable patient booking
ALTER TABLE public.activities ADD COLUMN booking_enabled boolean NOT NULL DEFAULT false;