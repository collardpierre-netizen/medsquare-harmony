-- 1. practitioner_reviews: hide author_email from authenticated table-wide SELECT
REVOKE SELECT ON public.practitioner_reviews FROM authenticated;
GRANT SELECT (id, practitioner_id, score_global, score_punctuality, score_listening,
  score_premises, score_explanation, review_text, author_name, is_approved, is_verified, created_at)
  ON public.practitioner_reviews TO authenticated;

CREATE OR REPLACE FUNCTION public.get_review_author_emails(review_ids uuid[])
RETURNS TABLE(review_id uuid, author_email text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT r.id, r.author_email
  FROM public.practitioner_reviews r
  WHERE r.id = ANY(review_ids)
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR r.practitioner_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
    );
$$;

REVOKE EXECUTE ON FUNCTION public.get_review_author_emails(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_review_author_emails(uuid[]) TO authenticated;

-- 2. legal_document_versions: restrict broad access
DROP POLICY IF EXISTS "Authenticated users can view versions" ON public.legal_document_versions;

CREATE POLICY "Admins can view all versions"
ON public.legal_document_versions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view versions of active documents"
ON public.legal_document_versions
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.legal_documents d
  WHERE d.id = legal_document_versions.document_id AND d.is_active = true
));

-- 3. generate_recurring_sessions: in-function authorization check
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
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'practitioner'::app_role)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

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
