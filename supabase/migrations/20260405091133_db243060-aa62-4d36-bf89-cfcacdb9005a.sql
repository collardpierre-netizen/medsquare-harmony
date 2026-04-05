CREATE POLICY "Users can update own registrations to cancel"
ON public.activity_registrations
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());