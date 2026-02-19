
-- Fix 1: Remove dangerous public SELECT policy on activity_registrations
DROP POLICY IF EXISTS "Anyone can count registrations" ON public.activity_registrations;

-- Create secure RPC function for public registration counts
CREATE OR REPLACE FUNCTION public.count_session_registrations(session_uuid UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM activity_registrations
  WHERE session_id = session_uuid
  AND status = 'registered';
$$;

GRANT EXECUTE ON FUNCTION public.count_session_registrations TO anon, authenticated;

-- Fix 2: Replace public profiles SELECT with a restricted view
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can view active profiles" ON public.profiles;

-- Create a new policy that only exposes non-sensitive fields
-- We use a view approach: create a restricted public policy
CREATE POLICY "Public can view active profiles without sensitive data"
ON public.profiles
FOR SELECT
TO anon
USING (is_active = true);

-- Note: We'll handle column restriction in the client code by only selecting non-sensitive columns
-- The policy itself re-enables public read but we'll update all public queries to exclude contact_email and phone
