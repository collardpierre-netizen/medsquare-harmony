
-- Function to auto-generate activity_sessions from activity recurrence
-- Generates sessions for the next 4 weeks
CREATE OR REPLACE FUNCTION public.generate_recurring_sessions()
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
  _week_start := date_trunc('week', CURRENT_DATE)::date; -- Monday

  FOR _activity IN
    SELECT id, recurrence, max_participants
    FROM public.activities
    WHERE is_active = true AND recurrence IS NOT NULL
  LOOP
    -- recurrence is a JSONB array like [{"day":"vendredi","start":"20:30","end":"21:30"}]
    FOR _rec IN
      SELECT * FROM jsonb_array_elements(_activity.recurrence) AS r
    LOOP
      _day_num := (_day_map->>(_rec.value->>'day'))::int;
      
      -- Generate for 4 weeks starting from current week
      FOR _i IN 0..3 LOOP
        -- Calculate target date: week_start + i weeks + day offset
        -- week_start is Monday (ISO day 1), we need to map to correct offset
        IF _day_num = 0 THEN
          -- Sunday = 6 days after Monday
          _target_date := _week_start + (_i * 7) + 6;
        ELSE
          -- Monday=0, Tuesday=1, etc.
          _target_date := _week_start + (_i * 7) + (_day_num - 1);
        END IF;

        -- Skip past dates
        IF _target_date < CURRENT_DATE THEN
          CONTINUE;
        END IF;

        _start_ts := (_target_date || 'T' || (_rec.value->>'start') || ':00')::timestamp AT TIME ZONE 'Europe/Brussels';
        _end_ts := (_target_date || 'T' || (_rec.value->>'end') || ':00')::timestamp AT TIME ZONE 'Europe/Brussels';

        -- Insert only if session doesn't already exist for this activity+time
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

-- Run it once now to populate existing sessions
SELECT public.generate_recurring_sessions();
