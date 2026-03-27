
-- Tighten the overly permissive INSERT policy on reviews to require at least an author_name
DROP POLICY "Anyone can submit reviews" ON public.practitioner_reviews;
CREATE POLICY "Anyone can submit reviews" ON public.practitioner_reviews
  FOR INSERT TO public WITH CHECK (author_name IS NOT NULL AND score_global IS NOT NULL);

-- Tighten Q&A insert to require question text
DROP POLICY "Anyone can submit questions" ON public.practitioner_qna;
CREATE POLICY "Anyone can submit questions" ON public.practitioner_qna
  FOR INSERT TO public WITH CHECK (question IS NOT NULL AND answer IS NULL);
