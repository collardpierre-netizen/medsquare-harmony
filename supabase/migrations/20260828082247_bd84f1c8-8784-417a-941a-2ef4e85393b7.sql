ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS discount_type text,
  ADD COLUMN IF NOT EXISTS discount_value numeric,
  ADD COLUMN IF NOT EXISTS discount_reason text;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_discount_type_check
  CHECK (discount_type IS NULL OR discount_type IN ('percent','amount','hourly_rate'));

CREATE TABLE IF NOT EXISTS public.practitioner_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  room_id uuid REFERENCES public.rooms(id) ON DELETE CASCADE,
  discount_type text NOT NULL DEFAULT 'percent' CHECK (discount_type IN ('percent','amount','hourly_rate')),
  discount_value numeric NOT NULL DEFAULT 0,
  label text,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.practitioner_discounts TO authenticated;
GRANT ALL ON public.practitioner_discounts TO service_role;

ALTER TABLE public.practitioner_discounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all discounts"
ON public.practitioner_discounts FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Practitioners can view their own discounts"
ON public.practitioner_discounts FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = practitioner_discounts.practitioner_id AND p.user_id = auth.uid()));

CREATE TRIGGER update_practitioner_discounts_updated_at
BEFORE UPDATE ON public.practitioner_discounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();