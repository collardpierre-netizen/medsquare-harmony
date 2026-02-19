
-- Update promote_waitlisted_on_cancel to also handle UPDATE (guest cancellation sets status='cancelled')
CREATE OR REPLACE FUNCTION public.promote_waitlisted_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _promoted RECORD;
  _activity_title TEXT;
  _session_start TIMESTAMPTZ;
  _max_participants INT;
  _registered_count INT;
  _practitioner_user_id UUID;
  _prefs JSONB;
  _session_id UUID;
  _old_status TEXT;
BEGIN
  -- Determine which operation triggered this
  IF TG_OP = 'DELETE' THEN
    _old_status := OLD.status;
    _session_id := OLD.session_id;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only act when status changes TO cancelled FROM registered
    IF NEW.status <> 'cancelled' OR OLD.status <> 'registered' THEN
      RETURN NEW;
    END IF;
    _old_status := OLD.status;
    _session_id := OLD.session_id;
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Only act when a "registered" registration is removed
  IF _old_status <> 'registered' THEN RETURN COALESCE(NEW, OLD); END IF;

  -- Get session info
  SELECT s.max_participants, s.start_time, a.title, p.user_id,
         COALESCE(p.notification_preferences, '{"bookings":true,"activities":true,"registrations":true}'::jsonb)
  INTO _max_participants, _session_start, _activity_title, _practitioner_user_id, _prefs
  FROM public.activity_sessions s
  JOIN public.activities a ON a.id = s.activity_id
  JOIN public.profiles p ON p.id = a.practitioner_id
  WHERE s.id = _session_id;

  -- Count remaining registered
  SELECT COUNT(*) INTO _registered_count
  FROM public.activity_registrations
  WHERE session_id = _session_id AND status = 'registered'
    AND id <> COALESCE(OLD.id, '00000000-0000-0000-0000-000000000000');

  -- If there's room and there are waitlisted people, promote the oldest one
  IF _max_participants IS NOT NULL AND _registered_count < _max_participants THEN
    SELECT * INTO _promoted
    FROM public.activity_registrations
    WHERE session_id = _session_id AND status = 'waitlisted'
    ORDER BY created_at ASC
    LIMIT 1;

    IF _promoted.id IS NOT NULL THEN
      UPDATE public.activity_registrations SET status = 'registered' WHERE id = _promoted.id;

      IF _promoted.user_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, metadata)
        VALUES (
          _promoted.user_id,
          'Place disponible ! 🎉',
          'Une place s''est libérée pour « ' || COALESCE(_activity_title, 'activité') || ' » du ' || to_char(_session_start AT TIME ZONE 'Europe/Brussels', 'DD/MM/YYYY à HH24:MI') || '. Vous êtes maintenant inscrit !',
          'success',
          jsonb_build_object('session_id', _session_id, 'registration_id', _promoted.id, 'action', 'promoted')
        );
      END IF;

      IF _practitioner_user_id IS NOT NULL AND COALESCE((_prefs->>'registrations')::boolean, true) THEN
        INSERT INTO public.notifications (user_id, title, message, type, metadata)
        VALUES (
          _practitioner_user_id,
          'Promotion liste d''attente ✅',
          'Un participant en liste d''attente a été automatiquement inscrit à « ' || COALESCE(_activity_title, 'activité') || ' » du ' || to_char(_session_start AT TIME ZONE 'Europe/Brussels', 'DD/MM/YYYY à HH24:MI') || '.',
          'info',
          jsonb_build_object('session_id', _session_id, 'registration_id', _promoted.id, 'action', 'promoted')
        );
      END IF;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Recreate trigger to also fire on UPDATE
DROP TRIGGER IF EXISTS promote_waitlisted_after_cancel ON public.activity_registrations;
CREATE TRIGGER promote_waitlisted_after_cancel
AFTER DELETE OR UPDATE ON public.activity_registrations
FOR EACH ROW EXECUTE FUNCTION public.promote_waitlisted_on_cancel();
