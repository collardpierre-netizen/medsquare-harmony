
-- Add floor and surface_area columns to rooms table
ALTER TABLE public.rooms ADD COLUMN floor text DEFAULT '';
ALTER TABLE public.rooms ADD COLUMN surface_area integer;
