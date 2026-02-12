-- Add processing status enum type
DO $$ BEGIN
  CREATE TYPE processing_status AS ENUM ('pending', 'processing', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add processing status and error tracking columns to knowledge_files
ALTER TABLE public.knowledge_files
ADD COLUMN IF NOT EXISTS processing_status processing_status DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS last_error text,
ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS error_timestamp timestamp with time zone;