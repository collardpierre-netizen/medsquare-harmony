-- Allow admins to create bookings on behalf of practitioners
DROP POLICY IF EXISTS "Practitioners can create bookings" ON public.bookings;

CREATE POLICY "Practitioners can create bookings"
ON public.bookings
FOR INSERT
WITH CHECK (
  (practitioner_id IN (
    SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()
  ))
  OR has_role(auth.uid(), 'admin'::app_role)
);