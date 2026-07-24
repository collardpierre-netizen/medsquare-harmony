
-- 1) activity_sessions: remove public INSERT policy
DROP POLICY IF EXISTS "Anyone can create sessions for bookable activities" ON public.activity_sessions;

-- 2) profiles: hide contact_email and phone from anonymous users
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (
  id, user_id, first_name, last_name, specialty, bio, avatar_url, schedule,
  is_active, created_at, updated_at, notification_preferences, break_minutes,
  social_links, display_order, accepts_new_patients, avg_appointment_delay_days,
  collaboration_ids, video_available, home_visit, pmr_accessible, parking,
  languages, payment_methods, conventioned, inami_number, tiers_payant,
  specialties, experiences, formations, associations, profile_score,
  missing_fields, external_booking_url
) ON public.profiles TO anon;

-- 3) bookings: hide notes column from anonymous users (only availability fields exposed)
REVOKE SELECT ON public.bookings FROM anon;
GRANT SELECT (
  id, practitioner_id, room_id, start_time, end_time, status,
  created_at, updated_at, activity_id, recurrence_group_id
) ON public.bookings TO anon;

-- 4) practitioner_reviews: hide author_email from anonymous users
REVOKE SELECT ON public.practitioner_reviews FROM anon;
GRANT SELECT (
  id, practitioner_id, score_global, score_punctuality, score_listening,
  score_premises, score_explanation, review_text, author_name,
  is_approved, is_verified, created_at
) ON public.practitioner_reviews TO anon;

-- 5) SECURITY DEFINER functions: revoke default EXECUTE and re-grant only where needed
REVOKE EXECUTE ON FUNCTION public.compute_profile_score(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_auth_emails_for_users(uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_practitioner_login_status() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_recurring_sessions() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.count_session_registrations(uuid) FROM PUBLIC;

-- Re-grant what the app actually calls via RPC
GRANT EXECUTE ON FUNCTION public.count_session_registrations(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_recurring_sessions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_emails_for_users(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_practitioner_login_status() TO authenticated;
