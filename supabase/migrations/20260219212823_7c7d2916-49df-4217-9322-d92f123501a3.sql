-- Drop existing INSERT policy and recreate with admin support
DROP POLICY "Practitioners can insert their own activities" ON public.activities;

CREATE POLICY "Practitioners and admins can insert activities"
ON public.activities
FOR INSERT
WITH CHECK (
  (practitioner_id IN (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()))
  OR has_role(auth.uid(), 'admin'::app_role)
);