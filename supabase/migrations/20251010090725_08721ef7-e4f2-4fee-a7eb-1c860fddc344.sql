-- Create sora_videos table for local metadata storage
CREATE TABLE public.sora_videos (
  id text PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- User-provided metadata
  title text,
  brand_id uuid,
  prompt text NOT NULL,
  model text DEFAULT 'sora-2',
  
  -- OpenAI response data
  status text NOT NULL DEFAULT 'processing',
  video_url text,
  thumbnail_url text,
  duration integer,
  aspect_ratio text,
  resolution text,
  has_audio boolean DEFAULT true,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  expires_at timestamptz,
  
  -- Error handling
  error jsonb,
  
  -- Additional metadata
  metadata jsonb DEFAULT '{}'
);

-- Enable RLS
ALTER TABLE public.sora_videos ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own sora videos"
  ON public.sora_videos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sora videos"
  ON public.sora_videos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sora videos"
  ON public.sora_videos FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sora videos"
  ON public.sora_videos FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_sora_videos_user_id ON public.sora_videos(user_id);
CREATE INDEX idx_sora_videos_brand_id ON public.sora_videos(brand_id);
CREATE INDEX idx_sora_videos_status ON public.sora_videos(status);