
-- Add pricing fields to activities
ALTER TABLE public.activities ADD COLUMN is_free boolean NOT NULL DEFAULT true;
ALTER TABLE public.activities ADD COLUMN price numeric DEFAULT null;

-- Add photos array (keep photo_url for backward compat)
ALTER TABLE public.activities ADD COLUMN photos text[] DEFAULT '{}'::text[];

-- Migrate existing photo_url to photos array
UPDATE public.activities SET photos = ARRAY[photo_url] WHERE photo_url IS NOT NULL AND photo_url != '';
