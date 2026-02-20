-- Allow admins to upload activity photos for any practitioner
DROP POLICY IF EXISTS "Users can upload activity photos" ON storage.objects;
CREATE POLICY "Users can upload activity photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'activity-photos'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Allow admins to update activity photos for any practitioner
DROP POLICY IF EXISTS "Users can update activity photos" ON storage.objects;
CREATE POLICY "Users can update activity photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'activity-photos'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Allow admins to delete activity photos for any practitioner
DROP POLICY IF EXISTS "Users can delete activity photos" ON storage.objects;
CREATE POLICY "Users can delete activity photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'activity-photos'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);