-- Reset the 2 specific stuck files to 'failed' status by their IDs
-- These files were previously stuck in 'processing' and need to be marked as 'failed' for retry

UPDATE knowledge_files 
SET processing_status = 'failed',
    last_error = 'Reset from stuck processing state for retry',
    updated_at = NOW()
WHERE id IN (
    'c1e75b3c-f03b-42f7-ab7c-975889e56d17',  -- reddit_karma.txt
    '39db1671-f88a-4f69-b6b0-fbd1753ba589'   -- nonprofit-software.md
)
AND processing_status = 'processing';