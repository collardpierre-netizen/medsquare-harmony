CREATE OR REPLACE FUNCTION public.is_active_practitioner(_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _profile_id
      AND is_active = true
  )
$$;

DROP POLICY IF EXISTS "Anyone can view rates" ON public.practitioner_rates;
CREATE POLICY "Anyone can view rates of active practitioners"
ON public.practitioner_rates
FOR SELECT
TO public
USING (public.is_active_practitioner(practitioner_id));

DROP POLICY IF EXISTS "Authenticated users can view all activities" ON public.activities;
CREATE POLICY "Practitioners and admins can view own or all activities"
ON public.activities
FOR SELECT
TO authenticated
USING (
  practitioner_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Anyone can view sessions" ON public.activity_sessions;
CREATE POLICY "Anyone can view sessions of active activities"
ON public.activity_sessions
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.activities a
    WHERE a.id = activity_sessions.activity_id
      AND a.is_active = true
  )
);

CREATE POLICY "Practitioners and admins can view all sessions"
ON public.activity_sessions
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'practitioner'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);