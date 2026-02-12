UPDATE knowledge_files 
SET processing_status = 'pending', retry_count = 0, last_error = NULL
WHERE processing_status IN ('processing', 'failed');