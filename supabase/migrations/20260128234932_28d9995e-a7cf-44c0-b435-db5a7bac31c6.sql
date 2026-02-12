-- Reset stuck files to pending
UPDATE knowledge_files 
SET processing_status = 'pending',
    retry_count = 0,
    last_error = NULL,
    error_timestamp = NULL
WHERE processing_status IN ('processing', 'failed');