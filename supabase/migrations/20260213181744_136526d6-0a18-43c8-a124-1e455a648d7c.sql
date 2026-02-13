
-- Add pricing JSONB column to rooms table for tariff packages
ALTER TABLE public.rooms
ADD COLUMN pricing jsonb DEFAULT '[]'::jsonb;

-- Add credits_info text column for credit conversion note
ALTER TABLE public.rooms
ADD COLUMN credits_info text DEFAULT '';
