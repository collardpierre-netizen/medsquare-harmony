
-- Create public bucket for avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Create public bucket for activity photos
INSERT INTO storage.buckets (id, name, public) VALUES ('activity-photos', 'activity-photos', true);

-- Avatars: anyone can view (public bucket)
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Avatars: authenticated users can upload to their own folder
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Avatars: users can update their own avatar
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Avatars: users can delete their own avatar
CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Activity photos: anyone can view (public bucket)
CREATE POLICY "Activity photos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'activity-photos');

-- Activity photos: authenticated users can upload to their own folder
CREATE POLICY "Users can upload activity photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'activity-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Activity photos: users can update their own photos
CREATE POLICY "Users can update activity photos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'activity-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Activity photos: users can delete their own photos
CREATE POLICY "Users can delete activity photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'activity-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
