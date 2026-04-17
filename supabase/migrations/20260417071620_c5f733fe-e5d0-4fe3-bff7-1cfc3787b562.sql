ALTER TABLE public.rooms 
ADD COLUMN IF NOT EXISTS privatized_from DATE,
ADD COLUMN IF NOT EXISTS privatized_until DATE;

COMMENT ON COLUMN public.rooms.privatized_from IS 'Date à partir de laquelle la salle devient privatisée (NULL = pas de programmation)';
COMMENT ON COLUMN public.rooms.privatized_until IS 'Date jusqu''à laquelle la salle reste privatisée (NULL = privatisation indéfinie)';