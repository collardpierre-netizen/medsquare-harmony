
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;
END $$;

-- Re-grant only the functions actually called via PostgREST RPC by the app
GRANT EXECUTE ON FUNCTION public.count_session_registrations(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_recurring_sessions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_emails_for_users(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_practitioner_login_status() TO authenticated;
