ALTER TABLE public.practitioner_room_packages
  ADD COLUMN IF NOT EXISTS start_date date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS end_date date;

CREATE TABLE public.billing_plan_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month date NOT NULL,
  practitioner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  label text NOT NULL,
  note text,
  expected_amount numeric,
  status text NOT NULL DEFAULT 'to_invoice',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_plan_notes TO authenticated;
GRANT ALL ON public.billing_plan_notes TO service_role;

ALTER TABLE public.billing_plan_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage billing plan notes"
ON public.billing_plan_notes
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_billing_plan_notes_updated_at
BEFORE UPDATE ON public.billing_plan_notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();