ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS opening_hours jsonb;

COMMENT ON COLUMN public.rooms.opening_hours IS
  'Plages d''ouverture: { weekly: { "0".."6": { closed: bool, start: int, end: int } }, periods: [ { from: "YYYY-MM-DD", to: "YYYY-MM-DD", label: text, closed: bool, start: int, end: int } ] }';