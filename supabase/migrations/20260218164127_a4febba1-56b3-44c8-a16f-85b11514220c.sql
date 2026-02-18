
-- Add cancellation_token to activity_registrations for guest link-based cancellation
ALTER TABLE public.activity_registrations
  ADD COLUMN IF NOT EXISTS cancellation_token UUID DEFAULT gen_random_uuid() NOT NULL;

-- Backfill any existing rows that may have NULL (shouldn't happen with DEFAULT, but just in case)
UPDATE public.activity_registrations
  SET cancellation_token = gen_random_uuid()
  WHERE cancellation_token IS NULL;

-- Unique index for fast lookup by token
CREATE UNIQUE INDEX IF NOT EXISTS idx_activity_registrations_cancellation_token
  ON public.activity_registrations(cancellation_token);
