-- Allow anonymous users to create activity sessions for bookable activities
CREATE POLICY "Anyone can create sessions for bookable activities"
ON public.activity_sessions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.activities
    WHERE activities.id = activity_id
    AND activities.booking_enabled = true
    AND activities.is_active = true
  )
);