-- Step 1: Create storage bucket for Sora videos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sora-videos',
  'sora-videos',
  true,
  524288000,
  ARRAY['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm']
)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for sora-videos bucket

-- Users can view their own videos
CREATE POLICY "Users can view own sora videos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'sora-videos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can upload their own videos
CREATE POLICY "Users can upload own sora videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'sora-videos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can delete their own videos
CREATE POLICY "Users can delete own sora videos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'sora-videos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Service role has full access (for edge function uploads)
CREATE POLICY "Service role has full access to sora videos"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'sora-videos')
WITH CHECK (bucket_id = 'sora-videos');

-- Step 2: Update sora_videos table schema
ALTER TABLE public.sora_videos
  DROP COLUMN IF EXISTS expires_at,
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS file_size_bytes bigint,
  ADD COLUMN IF NOT EXISTS thumbnail_storage_path text;

COMMENT ON COLUMN public.sora_videos.video_url IS 'Permanent Supabase Storage URL';
COMMENT ON COLUMN public.sora_videos.thumbnail_url IS 'Permanent Supabase Storage URL for thumbnail';
COMMENT ON COLUMN public.sora_videos.storage_path IS 'Storage bucket path: {user_id}/{video_id}.mp4';
COMMENT ON COLUMN public.sora_videos.thumbnail_storage_path IS 'Storage bucket path for thumbnail';