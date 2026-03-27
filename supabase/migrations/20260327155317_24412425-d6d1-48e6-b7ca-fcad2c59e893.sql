
-- Table: practitioner_rates (tarifs INAMI)
CREATE TABLE public.practitioner_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  act_label text NOT NULL,
  duration_minutes integer,
  inami_total numeric,
  patient_normal numeric,
  patient_bim numeric,
  consult_mode text NOT NULL DEFAULT 'cabinet',
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.practitioner_rates ENABLE ROW LEVEL SECURITY;

-- Public can view rates
CREATE POLICY "Anyone can view rates" ON public.practitioner_rates
  FOR SELECT TO public USING (true);

-- Practitioners can manage their own rates
CREATE POLICY "Practitioners can manage own rates" ON public.practitioner_rates
  FOR ALL TO authenticated
  USING (practitioner_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR has_role(auth.uid(), 'admin'))
  WITH CHECK (practitioner_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR has_role(auth.uid(), 'admin'));

-- Table: practitioner_reviews (avis patients)
CREATE TABLE public.practitioner_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score_global numeric NOT NULL CHECK (score_global >= 0 AND score_global <= 10),
  score_punctuality numeric CHECK (score_punctuality >= 0 AND score_punctuality <= 10),
  score_listening numeric CHECK (score_listening >= 0 AND score_listening <= 10),
  score_premises numeric CHECK (score_premises >= 0 AND score_premises <= 10),
  score_explanation numeric CHECK (score_explanation >= 0 AND score_explanation <= 10),
  review_text text,
  author_name text NOT NULL DEFAULT 'Anonyme',
  author_email text,
  is_approved boolean NOT NULL DEFAULT false,
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.practitioner_reviews ENABLE ROW LEVEL SECURITY;

-- Public can view approved reviews
CREATE POLICY "Anyone can view approved reviews" ON public.practitioner_reviews
  FOR SELECT TO public USING (is_approved = true);

-- Anyone can submit a review
CREATE POLICY "Anyone can submit reviews" ON public.practitioner_reviews
  FOR INSERT TO public WITH CHECK (true);

-- Practitioners can see and moderate reviews for their profile
CREATE POLICY "Practitioners can view own reviews" ON public.practitioner_reviews
  FOR SELECT TO authenticated
  USING (practitioner_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Practitioners can update own reviews" ON public.practitioner_reviews
  FOR UPDATE TO authenticated
  USING (practitioner_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR has_role(auth.uid(), 'admin'));

-- Table: practitioner_qna (questions & réponses)
CREATE TABLE public.practitioner_qna (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text,
  category text DEFAULT 'general',
  is_published boolean NOT NULL DEFAULT false,
  author_name text DEFAULT 'Anonyme',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.practitioner_qna ENABLE ROW LEVEL SECURITY;

-- Public can view published Q&A
CREATE POLICY "Anyone can view published qna" ON public.practitioner_qna
  FOR SELECT TO public USING (is_published = true);

-- Anyone can submit a question
CREATE POLICY "Anyone can submit questions" ON public.practitioner_qna
  FOR INSERT TO public WITH CHECK (answer IS NULL);

-- Practitioners can manage their own Q&A
CREATE POLICY "Practitioners can view own qna" ON public.practitioner_qna
  FOR SELECT TO authenticated
  USING (practitioner_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Practitioners can update own qna" ON public.practitioner_qna
  FOR UPDATE TO authenticated
  USING (practitioner_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR has_role(auth.uid(), 'admin'));
