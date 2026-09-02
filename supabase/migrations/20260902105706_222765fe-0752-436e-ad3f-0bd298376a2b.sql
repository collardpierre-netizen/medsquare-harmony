CREATE POLICY "Public can create slots for bookable activities"
ON public.activity_sessions
FOR INSERT
TO anon, authenticated
WITH CHECK (
  status = 'scheduled'
  AND activity_id IN (
    SELECT a.id FROM public.activities a
    WHERE a.is_active = true AND a.booking_enabled = true
  )
);

CREATE POLICY "Guests can register while signed in"
ON public.activity_registrations
FOR INSERT
TO authenticated
WITH CHECK (user_id IS NULL AND guest_email IS NOT NULL);