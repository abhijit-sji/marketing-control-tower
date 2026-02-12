-- Reset the stuck files to pending so they can be picked up
UPDATE knowledge_files 
SET processing_status = 'pending',
    retry_count = 0,
    last_error = NULL,
    error_timestamp = NULL
WHERE processing_status = 'processing';