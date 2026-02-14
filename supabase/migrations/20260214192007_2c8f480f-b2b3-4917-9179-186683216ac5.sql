-- Add notification preferences to profiles
ALTER TABLE public.profiles 
ADD COLUMN notification_preferences jsonb NOT NULL DEFAULT '{"bookings": true, "activities": true, "registrations": true}'::jsonb;

-- Update triggers to check notification preferences

CREATE OR REPLACE FUNCTION public.notify_new_booking()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _room_name TEXT;
  _practitioner_user_id UUID;
  _prefs JSONB;
BEGIN
  SELECT name INTO _room_name FROM public.rooms WHERE id = NEW.room_id;
  SELECT user_id, COALESCE(notification_preferences, '{"bookings":true,"activities":true,"registrations":true}'::jsonb)
    INTO _practitioner_user_id, _prefs
    FROM public.profiles WHERE id = NEW.practitioner_id;

  IF _practitioner_user_id IS NULL THEN RETURN NEW; END IF;
  IF NOT COALESCE((_prefs->>'bookings')::boolean, true) THEN RETURN NEW; END IF;

  INSERT INTO public.notifications (user_id, title, message, type, metadata)
  VALUES (
    _practitioner_user_id,
    'Nouvelle réservation 📅',
    'Une réservation a été créée pour ' || COALESCE(_room_name, 'une salle') || ' le ' || to_char(NEW.start_time AT TIME ZONE 'Europe/Brussels', 'DD/MM/YYYY à HH24:MI') || '.',
    'info',
    jsonb_build_object('booking_id', NEW.id, 'room_id', NEW.room_id)
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_booking_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _title TEXT;
  _message TEXT;
  _type TEXT;
  _room_name TEXT;
  _practitioner_user_id UUID;
  _prefs JSONB;
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  SELECT name INTO _room_name FROM public.rooms WHERE id = NEW.room_id;
  SELECT user_id, COALESCE(notification_preferences, '{"bookings":true,"activities":true,"registrations":true}'::jsonb)
    INTO _practitioner_user_id, _prefs
    FROM public.profiles WHERE id = NEW.practitioner_id;

  IF _practitioner_user_id IS NULL THEN RETURN NEW; END IF;
  IF NOT COALESCE((_prefs->>'bookings')::boolean, true) THEN RETURN NEW; END IF;

  IF NEW.status = 'confirmed' THEN
    _title := 'Réservation confirmée ✅';
    _message := 'Votre réservation pour ' || COALESCE(_room_name, 'une salle') || ' le ' || to_char(NEW.start_time AT TIME ZONE 'Europe/Brussels', 'DD/MM/YYYY à HH24:MI') || ' a été confirmée.';
    _type := 'success';
  ELSIF NEW.status = 'cancelled' THEN
    _title := 'Réservation refusée ❌';
    _message := 'Votre réservation pour ' || COALESCE(_room_name, 'une salle') || ' le ' || to_char(NEW.start_time AT TIME ZONE 'Europe/Brussels', 'DD/MM/YYYY à HH24:MI') || ' a été refusée.';
    _type := 'error';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, metadata)
  VALUES (_practitioner_user_id, _title, _message, _type, jsonb_build_object('booking_id', NEW.id, 'status', NEW.status));
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_new_activity_session()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _activity_title TEXT;
  _practitioner_user_id UUID;
  _room_name TEXT;
  _prefs JSONB;
BEGIN
  SELECT a.title, p.user_id, COALESCE(p.notification_preferences, '{"bookings":true,"activities":true,"registrations":true}'::jsonb)
  INTO _activity_title, _practitioner_user_id, _prefs
  FROM public.activities a
  JOIN public.profiles p ON p.id = a.practitioner_id
  WHERE a.id = NEW.activity_id;

  IF NEW.room_id IS NOT NULL THEN
    SELECT name INTO _room_name FROM public.rooms WHERE id = NEW.room_id;
  END IF;

  IF _practitioner_user_id IS NULL THEN RETURN NEW; END IF;
  IF NOT COALESCE((_prefs->>'activities')::boolean, true) THEN RETURN NEW; END IF;

  INSERT INTO public.notifications (user_id, title, message, type, metadata)
  VALUES (
    _practitioner_user_id,
    'Nouvelle séance planifiée 🗓️',
    'Une séance de « ' || COALESCE(_activity_title, 'activité') || ' » a été planifiée' || 
    CASE WHEN _room_name IS NOT NULL THEN ' en ' || _room_name ELSE '' END ||
    ' le ' || to_char(NEW.start_time AT TIME ZONE 'Europe/Brussels', 'DD/MM/YYYY à HH24:MI') || '.',
    'info',
    jsonb_build_object('session_id', NEW.id, 'activity_id', NEW.activity_id, 'room_id', NEW.room_id)
  );
  RETURN NEW;
END;
$function$;

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
    _title := 'Nouvelle inscription 🎉';
    _message := 'Un participant s''est inscrit à votre activité « ' || _activity_title || ' » du ' || to_char(_session_start AT TIME ZONE 'Europe/Brussels', 'DD/MM/YYYY à HH24:MI') || '.';
    _type := 'info';
    INSERT INTO public.notifications (user_id, title, message, type, metadata)
    VALUES (_practitioner_user_id, _title, _message, _type,
      jsonb_build_object('session_id', NEW.session_id, 'registration_id', NEW.id, 'action', 'registered'));
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