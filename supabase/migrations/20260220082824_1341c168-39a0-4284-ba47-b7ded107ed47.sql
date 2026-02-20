
CREATE OR REPLACE FUNCTION public.get_practitioner_login_status()
RETURNS TABLE (
  user_id UUID,
  last_sign_in_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT au.id as user_id, au.last_sign_in_at
  FROM auth.users au
  INNER JOIN public.user_roles ur ON ur.user_id = au.id
  WHERE ur.role = 'practitioner'
    AND EXISTS (
      SELECT 1 FROM public.user_roles caller_roles
      WHERE caller_roles.user_id = auth.uid()
        AND caller_roles.role = 'admin'
    );
$$;
