CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.generate_recurring_sessions_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _activity RECORD;
  _rec RECORD;
  _day_num INT;
  _week_start DATE;
  _target_date DATE;
  _start_ts TIMESTAMPTZ;
  _end_ts TIMESTAMPTZ;
  _i INT;
  _day_map JSONB := '{"lundi":1,"mardi":2,"mercredi":3,"jeudi":4,"vendredi":5,"samedi":6,"dimanche":0}'::jsonb;
BEGIN
  _week_start := date_trunc('week', CURRENT_DATE)::date;

  FOR _activity IN
    SELECT id, recurrence, max_participants, start_date, end_date
    FROM public.activities
    WHERE is_active = true AND recurrence IS NOT NULL
  LOOP
    FOR _rec IN
      SELECT * FROM jsonb_array_elements(_activity.recurrence) AS r
    LOOP
      _day_num := (_day_map->>(_rec.value->>'day'))::int;
      IF _day_num IS NULL THEN
        CONTINUE;
      END IF;

      FOR _i IN 0..3 LOOP
        IF _day_num = 0 THEN
          _target_date := _week_start + (_i * 7) + 6;
        ELSE
          _target_date := _week_start + (_i * 7) + (_day_num - 1);
        END IF;

        IF _target_date < CURRENT_DATE THEN
          CONTINUE;
        END IF;

        IF _activity.start_date IS NOT NULL AND _target_date < _activity.start_date THEN
          CONTINUE;
        END IF;

        IF _activity.end_date IS NOT NULL AND _target_date > _activity.end_date THEN
          CONTINUE;
        END IF;

        _start_ts := (_target_date || 'T' || (_rec.value->>'start') || ':00')::timestamp AT TIME ZONE 'Europe/Brussels';
        _end_ts := (_target_date || 'T' || (_rec.value->>'end') || ':00')::timestamp AT TIME ZONE 'Europe/Brussels';

        INSERT INTO public.activity_sessions (activity_id, start_time, end_time, max_participants, status)
        SELECT _activity.id, _start_ts, _end_ts, _activity.max_participants, 'scheduled'
        WHERE NOT EXISTS (
          SELECT 1 FROM public.activity_sessions
          WHERE activity_id = _activity.id
            AND start_time = _start_ts
            AND end_time = _end_ts
        );
      END LOOP;
    END LOOP;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.generate_recurring_sessions_cron() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule(
  'generate-recurring-sessions-weekly',
  '0 1 * * 1',
  $$SELECT public.generate_recurring_sessions_cron();$$
);

SELECT public.generate_recurring_sessions_cron();