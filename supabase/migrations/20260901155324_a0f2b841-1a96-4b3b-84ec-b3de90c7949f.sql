DROP POLICY IF EXISTS "Practitioners can insert sessions" ON public.activity_sessions;
CREATE POLICY "Practitioners can insert sessions"
ON public.activity_sessions
FOR INSERT
TO authenticated
WITH CHECK (
  activity_id IN (
    SELECT a.id FROM public.activities a
    JOIN public.profiles p ON p.id = a.practitioner_id
    WHERE p.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);