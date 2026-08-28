CREATE TABLE public.billing_plan_locks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month date NOT NULL UNIQUE,
  locked_by uuid,
  locked_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_plan_locks TO authenticated;
GRANT ALL ON public.billing_plan_locks TO service_role;

ALTER TABLE public.billing_plan_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage billing plan locks"
ON public.billing_plan_locks FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_billing_plan_locks_updated_at
BEFORE UPDATE ON public.billing_plan_locks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.prevent_locked_billing_plan_notes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_month date;
BEGIN
  target_month := COALESCE(NEW.month, OLD.month);
  IF EXISTS (SELECT 1 FROM public.billing_plan_locks l WHERE l.month = date_trunc('month', target_month)::date) THEN
    RAISE EXCEPTION 'Le plan de facturation de ce mois est validé et verrouillé.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER billing_plan_notes_lock_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.billing_plan_notes
FOR EACH ROW EXECUTE FUNCTION public.prevent_locked_billing_plan_notes();