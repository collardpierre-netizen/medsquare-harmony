-- 1. Restrict public.settings SELECT access by key and role
DROP POLICY IF EXISTS "Anyone can read settings" ON public.settings;

CREATE POLICY "Anyone can read public settings"
ON public.settings
FOR SELECT
TO public
USING (
  key = ANY (ARRAY[
    'hero',
    'why',
    'testimonials',
    'contact',
    'faq',
    'centre_video',
    'centre_gallery',
    'medsquare_socials',
    'activity_categories',
    'widgets'
  ])
);

CREATE POLICY "Practitioners can read portal settings"
ON public.settings
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'practitioner'::public.app_role)
  AND key = ANY (ARRAY[
    'practitioner_notice',
    'legal_notice'
  ])
);

CREATE POLICY "Admins can read all settings"
ON public.settings
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2. Restrict public.rooms SELECT access so visitors only see available rooms
DROP POLICY IF EXISTS "Rooms are viewable by everyone" ON public.rooms;

CREATE POLICY "Anyone can view available rooms"
ON public.rooms
FOR SELECT
TO public
USING (is_available = true);

CREATE POLICY "Practitioners and admins can view all rooms"
ON public.rooms
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'practitioner'::public.app_role)
);