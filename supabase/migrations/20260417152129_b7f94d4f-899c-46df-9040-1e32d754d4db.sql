-- Allow practitioners to insert registrations (including guest registrations) on their own activity sessions
CREATE POLICY "Practitioners can insert registrations on own sessions"
ON public.activity_registrations
FOR INSERT
TO authenticated
WITH CHECK (
  session_id IN (
    SELECT s.id
    FROM public.activity_sessions s
    JOIN public.activities a ON a.id = s.activity_id
    JOIN public.profiles p ON p.id = a.practitioner_id
    WHERE p.user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Allow practitioners to delete registrations on their own activity sessions
CREATE POLICY "Practitioners can delete registrations on own sessions"
ON public.activity_registrations
FOR DELETE
TO authenticated
USING (
  session_id IN (
    SELECT s.id
    FROM public.activity_sessions s
    JOIN public.activities a ON a.id = s.activity_id
    JOIN public.profiles p ON p.id = a.practitioner_id
    WHERE p.user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);