-- Garde-fou serveur : toute nouvelle réservation (ou tout déplacement d'une réservation)
-- doit respecter les plages d'ouverture de la salle (rooms.opening_hours).
-- Même logique que src/lib/roomOpeningHours.ts :
--   * périodes exceptionnelles prioritaires sur la grille hebdomadaire ;
--   * opening_hours NULL => 8h–22h en semaine, 9h–21h le week-end ;
--   * heures exprimées en heure locale Europe/Brussels ; 0 = dimanche.

CREATE OR REPLACE FUNCTION public.room_day_hours(_opening_hours jsonb, _day date)
RETURNS TABLE (is_closed boolean, open_hour numeric, close_hour numeric)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  _dow int := EXTRACT(DOW FROM _day)::int;
  _def_start numeric := CASE WHEN _dow IN (0, 6) THEN 9 ELSE 8 END;
  _def_end numeric := CASE WHEN _dow IN (0, 6) THEN 21 ELSE 22 END;
  _week jsonb;
  _period jsonb;
  _w_start numeric;
  _w_end numeric;
  _w_closed boolean;
BEGIN
  _week := _opening_hours -> 'weekly' -> _dow::text;
  _w_closed := COALESCE((_week ->> 'closed')::boolean, false);
  _w_start := COALESCE((_week ->> 'start')::numeric, _def_start);
  _w_end := COALESCE((_week ->> 'end')::numeric, _def_end);

  IF _opening_hours IS NOT NULL AND jsonb_typeof(_opening_hours -> 'periods') = 'array' THEN
    SELECT p INTO _period
    FROM jsonb_array_elements(_opening_hours -> 'periods') AS p
    WHERE (p ->> 'from') IS NOT NULL AND (p ->> 'to') IS NOT NULL
      AND _day BETWEEN (p ->> 'from')::date AND (p ->> 'to')::date
    LIMIT 1;
  END IF;

  IF _period IS NOT NULL THEN
    IF COALESCE((_period ->> 'closed')::boolean, false) THEN
      RETURN QUERY SELECT true, 0::numeric, 0::numeric;
    ELSE
      RETURN QUERY SELECT false,
        COALESCE((_period ->> 'start')::numeric, _w_start),
        COALESCE((_period ->> 'end')::numeric, _w_end);
    END IF;
    RETURN;
  END IF;

  IF _w_closed OR _w_end <= _w_start THEN
    RETURN QUERY SELECT true, 0::numeric, 0::numeric;
  ELSE
    RETURN QUERY SELECT false, _w_start, _w_end;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_booking_opening_hours()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _oh jsonb;
  _local_start timestamp := NEW.start_time AT TIME ZONE 'Europe/Brussels';
  _local_end timestamp := NEW.end_time AT TIME ZONE 'Europe/Brussels';
  _day date;
  _start_h numeric;
  _end_h numeric;
  _hours record;
BEGIN
  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- Sur UPDATE, on ne contrôle que si le créneau ou la salle change
  IF TG_OP = 'UPDATE'
     AND NEW.start_time = OLD.start_time
     AND NEW.end_time = OLD.end_time
     AND NEW.room_id = OLD.room_id THEN
    RETURN NEW;
  END IF;

  SELECT opening_hours INTO _oh FROM public.rooms WHERE id = NEW.room_id;

  _day := _local_start::date;
  _start_h := EXTRACT(EPOCH FROM (_local_start - _day::timestamp)) / 3600;
  IF _local_end::date = _day THEN
    _end_h := EXTRACT(EPOCH FROM (_local_end - _day::timestamp)) / 3600;
  ELSIF _local_end = (_day + 1)::timestamp THEN
    _end_h := 24;
  ELSE
    RAISE EXCEPTION 'Une réservation ne peut pas s''étendre sur plusieurs jours.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO _hours FROM public.room_day_hours(_oh, _day);

  IF _hours.is_closed THEN
    RAISE EXCEPTION 'Le local est fermé le %.', to_char(_day, 'DD/MM/YYYY')
      USING ERRCODE = 'check_violation';
  END IF;

  IF _start_h < _hours.open_hour OR _end_h > _hours.close_hour THEN
    RAISE EXCEPTION 'En dehors des heures d''ouverture : le % le local est ouvert de %h à %h.',
      to_char(_day, 'DD/MM/YYYY'), _hours.open_hour, _hours.close_hour
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_booking_opening_hours ON public.bookings;
CREATE TRIGGER trg_enforce_booking_opening_hours
  BEFORE INSERT OR UPDATE OF start_time, end_time, room_id, status ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_booking_opening_hours();
