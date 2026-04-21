ALTER TABLE public.activity_registrations
ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'online';

COMMENT ON COLUMN public.activity_registrations.source IS 'Provenance de l''inscription : online (auto-inscription) ou manual (ajoutée par le praticien/admin).';