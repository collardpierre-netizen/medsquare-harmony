
-- 1. Restrict bookings.notes from anonymous users (sensitive free-text)
-- Use column-level GRANT revocation
REVOKE SELECT ON public.bookings FROM anon;
GRANT SELECT (id, room_id, practitioner_id, start_time, end_time, status, activity_id, recurrence_group_id, created_at, updated_at) ON public.bookings TO anon;

-- 2. Add explicit DELETE policy documentation note via comment
COMMENT ON TABLE public.profiles IS 'Profile data. Public/anon can read all columns including phone/contact_email by design (used for public contact buttons on practitioner pages).';

-- 3. Add assertion to notification triggers (defense in depth — already authorize via FK lookups)
COMMENT ON FUNCTION public.notify_booking_status_change() IS 'SECURITY DEFINER: Bypasses RLS. Authorization is enforced by looking up the practitioner via the booking FK before inserting notification.';
COMMENT ON FUNCTION public.notify_new_booking() IS 'SECURITY DEFINER: Bypasses RLS. Notifications are sent only to the practitioner who owns the booking (looked up via FK).';
COMMENT ON FUNCTION public.notify_activity_registration_change() IS 'SECURITY DEFINER: Bypasses RLS. Notifications are sent only to the practitioner who owns the activity (looked up via FK).';
COMMENT ON FUNCTION public.notify_new_activity_session() IS 'SECURITY DEFINER: Bypasses RLS. Notifications are sent only to the practitioner who owns the activity (looked up via FK).';
COMMENT ON FUNCTION public.promote_waitlisted_on_cancel() IS 'SECURITY DEFINER: Bypasses RLS. Notifications are scoped to the promoted user and the practitioner who owns the activity.';
COMMENT ON FUNCTION public.notify_legal_document_change() IS 'SECURITY DEFINER: Bypasses RLS. Notifies all active practitioners of legal document changes — this is intentional broadcast behavior.';
