
-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false);

-- Practitioners can view their own documents
CREATE POLICY "Practitioners can view own documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    -- user can access files in their own folder
    auth.uid()::text = (storage.foldername(name))[1]
    -- or admin can access all files
    OR public.has_role(auth.uid(), 'admin')
  )
);

-- Practitioners can upload to their own folder
CREATE POLICY "Practitioners can upload own documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin')
  )
);

-- Practitioners can delete their own documents
CREATE POLICY "Practitioners can delete own documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin')
  )
);

-- Admins can upload to any practitioner's folder
CREATE POLICY "Admins can upload documents for practitioners"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents'
  AND public.has_role(auth.uid(), 'admin')
);

-- Allow practitioners to insert their own documents in the documents table
CREATE POLICY "Practitioners can insert own documents"
ON public.documents FOR INSERT
TO authenticated
WITH CHECK (
  practitioner_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

-- Allow practitioners to delete their own documents
CREATE POLICY "Practitioners can delete own documents"
ON public.documents FOR DELETE
TO authenticated
USING (
  practitioner_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);
