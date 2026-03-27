
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS accepts_new_patients boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS avg_appointment_delay_days integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS collaboration_ids uuid[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS video_available boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS home_visit boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pmr_accessible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parking boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS languages text[] DEFAULT '{français}',
  ADD COLUMN IF NOT EXISTS payment_methods text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS conventioned boolean DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS inami_number text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tiers_payant boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS specialties text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS experiences jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS formations jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS associations text[] DEFAULT '{}';
