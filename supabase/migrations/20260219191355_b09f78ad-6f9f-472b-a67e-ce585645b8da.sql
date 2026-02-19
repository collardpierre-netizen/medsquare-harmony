-- Add display_order column to profiles for custom practitioner ordering
ALTER TABLE public.profiles ADD COLUMN display_order integer NOT NULL DEFAULT 0;

-- Initialize display_order based on current last_name alphabetical order
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY last_name, first_name) AS rn
  FROM public.profiles
)
UPDATE public.profiles SET display_order = ordered.rn
FROM ordered WHERE public.profiles.id = ordered.id;