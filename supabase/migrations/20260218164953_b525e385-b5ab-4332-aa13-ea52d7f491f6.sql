
-- Supprimer les anciennes politiques site-assets qui utilisent une sous-requête inline
DROP POLICY IF EXISTS "Admins can upload site assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update site assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete site assets" ON storage.objects;

-- Recréer avec has_role() comme les autres buckets
CREATE POLICY "Admins can upload site assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'site-assets'
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update site assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'site-assets'
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete site assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'site-assets'
  AND has_role(auth.uid(), 'admin'::app_role)
);
