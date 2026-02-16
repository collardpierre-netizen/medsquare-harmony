
-- Fix 1: Restrict profiles - drop the overly permissive authenticated policy
-- "Anyone can view active profiles" already exists for public listings
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;

-- Add policy for owner/admin to see all profiles (including inactive)
CREATE POLICY "Owner and admins can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

-- Fix 2: Restrict notification INSERT to admins only (triggers use SECURITY DEFINER)
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

CREATE POLICY "Admins can create notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
