
-- Trigger function to notify practitioner when someone registers or cancels
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
BEGIN
  -- Get activity info and practitioner user_id via session -> activity -> profile
  SELECT p.user_id, a.title, s.start_time
  INTO _practitioner_user_id, _activity_title, _session_start
  FROM public.activity_sessions s
  JOIN public.activities a ON a.id = s.activity_id
  JOIN public.profiles p ON p.id = a.practitioner_id
  WHERE s.id = COALESCE(NEW.session_id, OLD.session_id);

  IF _practitioner_user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'INSERT' THEN
    _title := 'Nouvelle inscription 🎉';
    _message := 'Un participant s''est inscrit à votre activité « ' || _activity_title || ' » du ' || to_char(_session_start AT TIME ZONE 'Europe/Brussels', 'DD/MM/YYYY à HH24:MI') || '.';
    _type := 'info';

    INSERT INTO public.notifications (user_id, title, message, type, metadata)
    VALUES (
      _practitioner_user_id,
      _title,
      _message,
      _type,
      jsonb_build_object('session_id', NEW.session_id, 'registration_id', NEW.id, 'action', 'registered')
    );
  ELSIF TG_OP = 'DELETE' THEN
    _title := 'Inscription annulée';
    _message := 'Un participant a annulé son inscription à votre activité « ' || _activity_title || ' » du ' || to_char(_session_start AT TIME ZONE 'Europe/Brussels', 'DD/MM/YYYY à HH24:MI') || '.';
    _type := 'warning';

    INSERT INTO public.notifications (user_id, title, message, type, metadata)
    VALUES (
      _practitioner_user_id,
      _title,
      _message,
      _type,
      jsonb_build_object('session_id', OLD.session_id, 'registration_id', OLD.id, 'action', 'cancelled')
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Trigger on INSERT (new registration)
CREATE TRIGGER on_activity_registration_insert
  AFTER INSERT ON public.activity_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_activity_registration_change();

-- Trigger on DELETE (cancellation)
CREATE TRIGGER on_activity_registration_delete
  AFTER DELETE ON public.activity_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_activity_registration_change();
