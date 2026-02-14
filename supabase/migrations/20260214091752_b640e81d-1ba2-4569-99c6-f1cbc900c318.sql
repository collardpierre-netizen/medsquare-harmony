
-- Add contact_email to profiles for external notification preferences
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS contact_email text DEFAULT NULL;

-- Add guest fields to activity_registrations for non-authenticated visitors
ALTER TABLE public.activity_registrations 
  ADD COLUMN IF NOT EXISTS guest_name text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS guest_email text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS guest_phone text DEFAULT NULL;

-- Make user_id nullable so guests can register without an account
ALTER TABLE public.activity_registrations ALTER COLUMN user_id DROP NOT NULL;

-- Allow anonymous inserts for guest registrations (public access)
CREATE POLICY "Guests can register for sessions"
ON public.activity_registrations
FOR INSERT
TO anon
WITH CHECK (user_id IS NULL AND guest_email IS NOT NULL);

-- Allow public read for counting registrations
CREATE POLICY "Anyone can count registrations"
ON public.activity_registrations
FOR SELECT
TO anon
USING (true);
