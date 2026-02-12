-- Add error tracking columns to ai_generated_images table

ALTER TABLE ai_generated_images
ADD COLUMN IF NOT EXISTS error_type text,
ADD COLUMN IF NOT EXISTS error_message text,
ADD COLUMN IF NOT EXISTS error_details jsonb,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'completed' CHECK (status IN ('completed', 'failed', 'blocked'));

-- Create indexes for querying errors
CREATE INDEX IF NOT EXISTS idx_ai_images_status ON ai_generated_images(status);
CREATE INDEX IF NOT EXISTS idx_ai_images_error_type ON ai_generated_images(error_type) WHERE error_type IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN ai_generated_images.error_type IS 'Type of error: content_safety, api_error, quota_exceeded, validation_error, unexpected_error';
COMMENT ON COLUMN ai_generated_images.error_message IS 'User-friendly error message';
COMMENT ON COLUMN ai_generated_images.error_details IS 'Full error details from Gemini API for debugging';
COMMENT ON COLUMN ai_generated_images.status IS 'Generation status: completed, failed, or blocked';