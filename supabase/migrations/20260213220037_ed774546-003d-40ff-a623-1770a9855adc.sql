
-- Notify practitioner when a booking is created for them
CREATE OR REPLACE FUNCTION public.notify_new_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _room_name TEXT;
  _practitioner_user_id UUID;
BEGIN
  SELECT name INTO _room_name FROM public.rooms WHERE id = NEW.room_id;
  SELECT user_id INTO _practitioner_user_id FROM public.profiles WHERE id = NEW.practitioner_id;

  IF _practitioner_user_id IS NULL THEN
    RETURN NEW;
  END IF;

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
$$;

DROP TRIGGER IF EXISTS on_new_booking ON public.bookings;
CREATE TRIGGER on_new_booking
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_booking();

-- Notify practitioner when a new activity session is created
CREATE OR REPLACE FUNCTION public.notify_new_activity_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _activity_title TEXT;
  _practitioner_user_id UUID;
  _room_name TEXT;
BEGIN
  SELECT a.title, p.user_id
  INTO _activity_title, _practitioner_user_id
  FROM public.activities a
  JOIN public.profiles p ON p.id = a.practitioner_id
  WHERE a.id = NEW.activity_id;

  IF NEW.room_id IS NOT NULL THEN
    SELECT name INTO _room_name FROM public.rooms WHERE id = NEW.room_id;
  END IF;

  IF _practitioner_user_id IS NULL THEN
    RETURN NEW;
  END IF;

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
$$;

DROP TRIGGER IF EXISTS on_new_activity_session ON public.activity_sessions;
CREATE TRIGGER on_new_activity_session
  AFTER INSERT ON public.activity_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_activity_session();
