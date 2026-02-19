
-- 1. Update the registration notification to differentiate waitlist vs registered
CREATE OR REPLACE FUNCTION public.notify_activity_registration_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _practitioner_user_id UUID;
  _activity_title TEXT;
  _session_start TIMESTAMPTZ;
  _title TEXT;
  _message TEXT;
  _type TEXT;
  _prefs JSONB;
  _status TEXT;
BEGIN
  SELECT p.user_id, a.title, s.start_time, COALESCE(p.notification_preferences, '{"bookings":true,"activities":true,"registrations":true}'::jsonb)
  INTO _practitioner_user_id, _activity_title, _session_start, _prefs
  FROM public.activity_sessions s
  JOIN public.activities a ON a.id = s.activity_id
  JOIN public.profiles p ON p.id = a.practitioner_id
  WHERE s.id = COALESCE(NEW.session_id, OLD.session_id);

  IF _practitioner_user_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  IF NOT COALESCE((_prefs->>'registrations')::boolean, true) THEN RETURN COALESCE(NEW, OLD); END IF;

  IF TG_OP = 'INSERT' THEN
    _status := NEW.status;
    IF _status = 'waitlisted' THEN
      _title := 'Liste d''attente 📋';
      _message := 'Un participant s''est inscrit en liste d''attente pour « ' || _activity_title || ' » du ' || to_char(_session_start AT TIME ZONE 'Europe/Brussels', 'DD/MM/YYYY à HH24:MI') || '.';
    ELSE
      _title := 'Nouvelle inscription 🎉';
      _message := 'Un participant s''est inscrit à votre activité « ' || _activity_title || ' » du ' || to_char(_session_start AT TIME ZONE 'Europe/Brussels', 'DD/MM/YYYY à HH24:MI') || '.';
    END IF;
    _type := 'info';
    INSERT INTO public.notifications (user_id, title, message, type, metadata)
    VALUES (_practitioner_user_id, _title, _message, _type,
      jsonb_build_object('session_id', NEW.session_id, 'registration_id', NEW.id, 'action', _status));
  ELSIF TG_OP = 'DELETE' THEN
    _title := 'Inscription annulée';
    _message := 'Un participant a annulé son inscription à votre activité « ' || _activity_title || ' » du ' || to_char(_session_start AT TIME ZONE 'Europe/Brussels', 'DD/MM/YYYY à HH24:MI') || '.';
    _type := 'warning';
    INSERT INTO public.notifications (user_id, title, message, type, metadata)
    VALUES (_practitioner_user_id, _title, _message, _type,
      jsonb_build_object('session_id', OLD.session_id, 'registration_id', OLD.id, 'action', 'cancelled'));
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 2. Create function to auto-promote the oldest waitlisted person when a registered person cancels
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
BEGIN
  -- Only act when a "registered" registration is deleted
  IF OLD.status <> 'registered' THEN RETURN OLD; END IF;

  -- Get session info
  SELECT s.max_participants, s.start_time, a.title, p.user_id,
         COALESCE(p.notification_preferences, '{"bookings":true,"activities":true,"registrations":true}'::jsonb)
  INTO _max_participants, _session_start, _activity_title, _practitioner_user_id, _prefs
  FROM public.activity_sessions s
  JOIN public.activities a ON a.id = s.activity_id
  JOIN public.profiles p ON p.id = a.practitioner_id
  WHERE s.id = OLD.session_id;

  -- Count remaining registered (after deletion)
  SELECT COUNT(*) INTO _registered_count
  FROM public.activity_registrations
  WHERE session_id = OLD.session_id AND status = 'registered' AND id <> OLD.id;

  -- If there's room and there are waitlisted people, promote the oldest one
  IF _max_participants IS NOT NULL AND _registered_count < _max_participants THEN
    SELECT * INTO _promoted
    FROM public.activity_registrations
    WHERE session_id = OLD.session_id AND status = 'waitlisted'
    ORDER BY created_at ASC
    LIMIT 1;

    IF _promoted.id IS NOT NULL THEN
      -- Promote to registered
      UPDATE public.activity_registrations SET status = 'registered' WHERE id = _promoted.id;

      -- Notify the promoted person via in-app notification (if they have a user_id)
      IF _promoted.user_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, metadata)
        VALUES (
          _promoted.user_id,
          'Place disponible ! 🎉',
          'Une place s''est libérée pour « ' || COALESCE(_activity_title, 'activité') || ' » du ' || to_char(_session_start AT TIME ZONE 'Europe/Brussels', 'DD/MM/YYYY à HH24:MI') || '. Vous êtes maintenant inscrit !',
          'success',
          jsonb_build_object('session_id', OLD.session_id, 'registration_id', _promoted.id, 'action', 'promoted')
        );
      END IF;

      -- Notify practitioner about promotion
      IF _practitioner_user_id IS NOT NULL AND COALESCE((_prefs->>'registrations')::boolean, true) THEN
        INSERT INTO public.notifications (user_id, title, message, type, metadata)
        VALUES (
          _practitioner_user_id,
          'Promotion liste d''attente ✅',
          'Un participant en liste d''attente a été automatiquement inscrit à « ' || COALESCE(_activity_title, 'activité') || ' » du ' || to_char(_session_start AT TIME ZONE 'Europe/Brussels', 'DD/MM/YYYY à HH24:MI') || '.',
          'info',
          jsonb_build_object('session_id', OLD.session_id, 'registration_id', _promoted.id, 'action', 'promoted')
        );
      END IF;
    END IF;
  END IF;

  RETURN OLD;
END;
$function$;

-- 3. Recreate triggers (drop first to avoid duplicates)
DROP TRIGGER IF EXISTS on_activity_registration_change ON public.activity_registrations;
CREATE TRIGGER on_activity_registration_change
AFTER INSERT OR DELETE ON public.activity_registrations
FOR EACH ROW EXECUTE FUNCTION public.notify_activity_registration_change();

DROP TRIGGER IF EXISTS promote_waitlisted_after_cancel ON public.activity_registrations;
CREATE TRIGGER promote_waitlisted_after_cancel
AFTER DELETE ON public.activity_registrations
FOR EACH ROW EXECUTE FUNCTION public.promote_waitlisted_on_cancel();
