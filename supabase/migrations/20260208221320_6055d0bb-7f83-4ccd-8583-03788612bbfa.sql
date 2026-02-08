
-- Fix bookings SELECT policies (restrictive → permissive)
DROP POLICY IF EXISTS "Practitioners can view their own bookings" ON public.bookings;
CREATE POLICY "Practitioners can view their own bookings"
ON public.bookings
FOR SELECT
TO authenticated
USING ((practitioner_id IN (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid())) OR has_role(auth.uid(), 'admin'::app_role));

-- Fix bookings UPDATE policies (restrictive → permissive)
DROP POLICY IF EXISTS "Practitioners can update their own bookings" ON public.bookings;
CREATE POLICY "Practitioners can update their own bookings"
ON public.bookings
FOR UPDATE
TO authenticated
USING ((practitioner_id IN (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid())) OR has_role(auth.uid(), 'admin'::app_role));

-- Fix bookings INSERT policy (restrictive → permissive)
DROP POLICY IF EXISTS "Practitioners can create bookings" ON public.bookings;
CREATE POLICY "Practitioners can create bookings"
ON public.bookings
FOR INSERT
TO authenticated
WITH CHECK (practitioner_id IN (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()));

-- Fix bookings DELETE policy (restrictive → permissive)
DROP POLICY IF EXISTS "Admins can delete bookings" ON public.bookings;
CREATE POLICY "Admins can delete bookings"
ON public.bookings
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix documents SELECT policies
DROP POLICY IF EXISTS "Practitioners can view their own documents" ON public.documents;
CREATE POLICY "Practitioners can view their own documents"
ON public.documents
FOR SELECT
TO authenticated
USING ((practitioner_id IN (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid())) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can insert documents" ON public.documents;
CREATE POLICY "Admins can insert documents"
ON public.documents
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete documents" ON public.documents;
CREATE POLICY "Admins can delete documents"
ON public.documents
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix profiles SELECT policies (two restrictive SELECT is problematic)
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Anyone can view active profiles"
ON public.profiles
FOR SELECT
USING (is_active = true);

CREATE POLICY "Authenticated users can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Fix profiles INSERT/UPDATE
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Fix rooms policies
DROP POLICY IF EXISTS "Rooms are viewable by everyone" ON public.rooms;
CREATE POLICY "Rooms are viewable by everyone"
ON public.rooms
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Admins can insert rooms" ON public.rooms;
CREATE POLICY "Admins can insert rooms"
ON public.rooms
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update rooms" ON public.rooms;
CREATE POLICY "Admins can update rooms"
ON public.rooms
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete rooms" ON public.rooms;
CREATE POLICY "Admins can delete rooms"
ON public.rooms
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix user_roles INSERT/DELETE
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
