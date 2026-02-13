
-- Create storage bucket for room photos
INSERT INTO storage.buckets (id, name, public) VALUES ('room-photos', 'room-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view room photos
CREATE POLICY "Room photos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'room-photos');

-- Allow admins to upload room photos
CREATE POLICY "Admins can upload room photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'room-photos' AND has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update room photos
CREATE POLICY "Admins can update room photos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'room-photos' AND has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete room photos
CREATE POLICY "Admins can delete room photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'room-photos' AND has_role(auth.uid(), 'admin'::app_role));
