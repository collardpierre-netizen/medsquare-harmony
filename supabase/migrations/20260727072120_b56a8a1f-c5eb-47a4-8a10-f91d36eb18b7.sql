CREATE TABLE public.practitioner_room_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  package_label text NOT NULL,
  monthly_fee numeric NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_prp_practitioner ON public.practitioner_room_packages(practitioner_id);
CREATE INDEX idx_prp_room ON public.practitioner_room_packages(room_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.practitioner_room_packages TO authenticated;
GRANT ALL ON public.practitioner_room_packages TO service_role;

ALTER TABLE public.practitioner_room_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all packages"
ON public.practitioner_room_packages FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Practitioners can view their own packages"
ON public.practitioner_room_packages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = practitioner_room_packages.practitioner_id
      AND p.user_id = auth.uid()
  )
);

CREATE TRIGGER update_prp_updated_at
BEFORE UPDATE ON public.practitioner_room_packages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();