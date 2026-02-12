-- Reset stuck processing files to 'failed' so they can be retried
-- These files have been in 'processing' for too long and need a retry

UPDATE knowledge_files 
SET processing_status = 'failed',
    last_error = 'Reset from stuck processing state for retry',
    retry_count = COALESCE(retry_count, 0) + 1,
    updated_at = NOW()
WHERE processing_status = 'processing' 
  AND updated_at < NOW() - INTERVAL '5 minutes';