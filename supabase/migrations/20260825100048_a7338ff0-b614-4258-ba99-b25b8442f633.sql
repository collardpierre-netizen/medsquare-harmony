CREATE TYPE public.activity_billing_frequency AS ENUM (
  'unit',
  'pack_5',
  'pack_10',
  'monthly',
  'quarterly',
  'biannual',
  'annual',
  'biennial'
);

CREATE TABLE public.activity_prices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  label text NOT NULL,
  price numeric NOT NULL CHECK (price >= 0),
  billing_frequency public.activity_billing_frequency NOT NULL DEFAULT 'unit',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_prices TO authenticated;
GRANT ALL ON public.activity_prices TO service_role;
GRANT SELECT ON public.activity_prices TO anon;

ALTER TABLE public.activity_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all activity prices"
  ON public.activity_prices
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Practitioners can manage prices for their own activities"
  ON public.activity_prices
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.activities a
      WHERE a.id = activity_prices.activity_id
        AND a.practitioner_id IN (
          SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.activities a
      WHERE a.id = activity_prices.activity_id
        AND a.practitioner_id IN (
          SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()
        )
    )
  );

CREATE POLICY "Visitors can view active activity prices"
  ON public.activity_prices
  FOR SELECT
  TO anon
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.activities a
      WHERE a.id = activity_prices.activity_id AND a.is_active = true
    )
  );

CREATE TRIGGER update_activity_prices_updated_at
  BEFORE UPDATE ON public.activity_prices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();