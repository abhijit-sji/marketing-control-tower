-- Fix sora-videos bucket to allow thumbnail image uploads
UPDATE storage.buckets 
SET allowed_mime_types = ARRAY['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'image/jpeg', 'image/png', 'image/jpg']
WHERE name = 'sora-videos';