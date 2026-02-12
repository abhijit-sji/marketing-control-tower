-- Reset stuck knowledge files to allow re-processing
UPDATE knowledge_files 
SET processing_status = 'pending', 
    last_error = NULL, 
    error_timestamp = NULL, 
    retry_count = 0
WHERE processing_status = 'processing';