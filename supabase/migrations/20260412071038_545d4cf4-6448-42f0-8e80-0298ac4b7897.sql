
CREATE OR REPLACE FUNCTION public.get_auth_emails_for_users(user_ids uuid[])
RETURNS TABLE(user_id uuid, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT au.id as user_id, au.email
  FROM auth.users au
  WHERE au.id = ANY(user_ids)
    AND EXISTS (
      SELECT 1 FROM public.user_roles caller_roles
      WHERE caller_roles.user_id = auth.uid()
        AND caller_roles.role = 'admin'
    );
$$;
