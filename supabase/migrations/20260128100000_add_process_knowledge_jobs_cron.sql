-- ============================================================================
-- Add Cron Job for Knowledge Base File Processing
-- ============================================================================
-- This migration creates a cron job that triggers the process-knowledge-jobs
-- edge function every minute to process pending knowledge base file uploads.
--
-- The worker processes files in the following states:
-- - 'queued': Files that were just uploaded
-- - 'pending': Files waiting to be processed
-- - 'processing': Files that failed mid-processing (with retry logic)
--
-- Background: Files uploaded via knowledge-base-upload or brand-knowledge-upload
-- are marked with processing_status='queued'. This cron job picks them up,
-- extracts text, generates embeddings, and stores them in the vector database.
-- ============================================================================

-- Drop existing job if it exists (idempotent migration)
SELECT cron.unschedule('process-knowledge-jobs-every-minute')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'process-knowledge-jobs-every-minute'
);

-- Create cron job to process knowledge files every minute
SELECT cron.schedule(
  'process-knowledge-jobs-every-minute',
  '* * * * *', -- Every minute
  $$
  SELECT net.http_post(
    url := 'https://tkdksyfudpzxrlnvybqz.supabase.co/functions/v1/process-knowledge-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- Log the cron job creation
DO $$
BEGIN
  RAISE NOTICE 'Cron job created: process-knowledge-jobs-every-minute';
  RAISE NOTICE 'Schedule: Every minute (* * * * *)';
  RAISE NOTICE 'Function: process-knowledge-jobs';
  RAISE NOTICE 'Purpose: Process pending knowledge base file uploads and index to vector database';
END $$;
