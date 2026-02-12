-- Add audience and post_url columns to content_performance_metrics
ALTER TABLE content_performance_metrics
ADD COLUMN IF NOT EXISTS audience text,
ADD COLUMN IF NOT EXISTS post_url text;

-- Create index for faster audience-based queries
CREATE INDEX IF NOT EXISTS idx_content_performance_audience 
ON content_performance_metrics(leader_id, audience);

-- Create index for post URL lookups
CREATE INDEX IF NOT EXISTS idx_content_performance_post_url 
ON content_performance_metrics(post_url);