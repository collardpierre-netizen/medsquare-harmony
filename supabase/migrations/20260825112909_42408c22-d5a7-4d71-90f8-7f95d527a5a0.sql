ALTER TABLE public.activity_registrations
  ADD COLUMN price_id uuid REFERENCES public.activity_prices(id) ON DELETE SET NULL;

GRANT SELECT, INSERT, UPDATE ON public.activity_registrations TO authenticated;
GRANT ALL ON public.activity_registrations TO service_role;

COMMENT ON COLUMN public.activity_registrations.price_id IS 'Prix/palier choisi lors de l inscription (HTVA ou TTC).';
