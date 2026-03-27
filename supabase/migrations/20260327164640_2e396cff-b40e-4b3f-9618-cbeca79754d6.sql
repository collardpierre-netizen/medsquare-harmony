
-- Add profile_score and missing_fields to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_score numeric DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS missing_fields jsonb DEFAULT '[]'::jsonb;

-- Create compute_profile_score function
CREATE OR REPLACE FUNCTION public.compute_profile_score(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _profile RECORD;
  _score numeric := 0;
  _missing jsonb := '[]'::jsonb;
  _has_rate boolean;
  _has_qna boolean;
  _has_collab boolean;
BEGIN
  SELECT * INTO _profile FROM public.profiles WHERE id = p_profile_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- === BASE FIELDS (50 pts) ===
  -- avatar_url: 10 pts
  IF _profile.avatar_url IS NOT NULL AND _profile.avatar_url <> '' THEN
    _score := _score + 10;
  ELSE
    _missing := _missing || '"Photo de profil"'::jsonb;
  END IF;

  -- bio: 10 pts
  IF _profile.bio IS NOT NULL AND length(trim(_profile.bio)) > 10 THEN
    _score := _score + 10;
  ELSE
    _missing := _missing || '"Description / biographie"'::jsonb;
  END IF;

  -- specialties: 5 pts
  IF _profile.specialties IS NOT NULL AND array_length(_profile.specialties, 1) > 0 THEN
    _score := _score + 5;
  ELSE
    _missing := _missing || '"Spécialités"'::jsonb;
  END IF;

  -- languages: 5 pts
  IF _profile.languages IS NOT NULL AND array_length(_profile.languages, 1) > 0 THEN
    _score := _score + 5;
  ELSE
    _missing := _missing || '"Langues parlées"'::jsonb;
  END IF;

  -- payment_methods: 5 pts
  IF _profile.payment_methods IS NOT NULL AND array_length(_profile.payment_methods, 1) > 0 THEN
    _score := _score + 5;
  ELSE
    _missing := _missing || '"Modes de paiement"'::jsonb;
  END IF;

  -- conventioned: 5 pts
  IF _profile.conventioned IS NOT NULL THEN
    _score := _score + 5;
  ELSE
    _missing := _missing || '"Convention INAMI"'::jsonb;
  END IF;

  -- inami_number: 5 pts
  IF _profile.inami_number IS NOT NULL AND _profile.inami_number <> '' THEN
    _score := _score + 5;
  ELSE
    _missing := _missing || '"Numéro d''agrément INAMI"'::jsonb;
  END IF;

  -- specialty (main): 5 pts
  IF _profile.specialty IS NOT NULL AND _profile.specialty <> '' THEN
    _score := _score + 5;
  ELSE
    _missing := _missing || '"Spécialité principale"'::jsonb;
  END IF;

  -- === NEW FEATURES (50 pts) ===
  -- practitioner_rates: 15 pts
  SELECT EXISTS(SELECT 1 FROM public.practitioner_rates WHERE practitioner_id = p_profile_id LIMIT 1) INTO _has_rate;
  IF _has_rate THEN
    _score := _score + 15;
  ELSE
    _missing := _missing || '"Tarifs INAMI"'::jsonb;
  END IF;

  -- accepts_new_patients configured: 5 pts (always configured, so check if true or explicitly set)
  _score := _score + 5;

  -- avg_appointment_delay_days: 5 pts
  IF _profile.avg_appointment_delay_days IS NOT NULL THEN
    _score := _score + 5;
  ELSE
    _missing := _missing || '"Délai moyen de rendez-vous"'::jsonb;
  END IF;

  -- schedule with at least 1 entry: 10 pts
  IF _profile.schedule IS NOT NULL AND jsonb_array_length(_profile.schedule) > 0 THEN
    _score := _score + 10;
  ELSE
    _missing := _missing || '"Horaires de consultation"'::jsonb;
  END IF;

  -- Q&A published: 10 pts
  SELECT EXISTS(SELECT 1 FROM public.practitioner_qna WHERE practitioner_id = p_profile_id AND is_published = true LIMIT 1) INTO _has_qna;
  IF _has_qna THEN
    _score := _score + 10;
  ELSE
    _missing := _missing || '"Questions & Réponses publiées"'::jsonb;
  END IF;

  -- collaboration: 5 pts
  IF _profile.collaboration_ids IS NOT NULL AND array_length(_profile.collaboration_ids, 1) > 0 THEN
    _score := _score + 5;
  ELSE
    _missing := _missing || '"Collaborations avec d''autres praticiens"'::jsonb;
  END IF;

  -- Update profile
  UPDATE public.profiles SET profile_score = _score, missing_fields = _missing WHERE id = p_profile_id;
END;
$$;

-- Trigger function for profiles update
CREATE OR REPLACE FUNCTION public.trigger_compute_profile_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.compute_profile_score(NEW.id);
  RETURN NEW;
END;
$$;

-- Trigger on profiles (deferred to avoid recursion)
DROP TRIGGER IF EXISTS trg_compute_profile_score ON public.profiles;
CREATE TRIGGER trg_compute_profile_score
  AFTER INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (pg_trigger_depth() < 1)
  EXECUTE FUNCTION public.trigger_compute_profile_score();

-- Trigger function for practitioner_rates changes
CREATE OR REPLACE FUNCTION public.trigger_recompute_score_on_rate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.compute_profile_score(OLD.practitioner_id);
    RETURN OLD;
  ELSE
    PERFORM public.compute_profile_score(NEW.practitioner_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_recompute_score_on_rate ON public.practitioner_rates;
CREATE TRIGGER trg_recompute_score_on_rate
  AFTER INSERT OR UPDATE OR DELETE ON public.practitioner_rates
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_recompute_score_on_rate();

-- Trigger for Q&A changes
CREATE OR REPLACE FUNCTION public.trigger_recompute_score_on_qna()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.compute_profile_score(OLD.practitioner_id);
    RETURN OLD;
  ELSE
    PERFORM public.compute_profile_score(NEW.practitioner_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_recompute_score_on_qna ON public.practitioner_qna;
CREATE TRIGGER trg_recompute_score_on_qna
  AFTER INSERT OR UPDATE OR DELETE ON public.practitioner_qna
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_recompute_score_on_qna();
