-- ============================================================================
-- Migration: Add claim_pending_knowledge_jobs function for async job processing
--
-- This implements atomic job locking using FOR UPDATE SKIP LOCKED pattern
-- to prevent race conditions when multiple workers process jobs simultaneously.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────
-- IMPROVEMENT 1: Atomic Job Locking with FOR UPDATE SKIP LOCKED
-- Prevents race conditions when multiple workers grab jobs
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION claim_pending_knowledge_jobs(
  job_limit INT DEFAULT 5,
  max_retries INT DEFAULT 3
)
RETURNS SETOF knowledge_files
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT id
    FROM knowledge_files
    WHERE processing_status IN ('pending', 'failed')
      AND (retry_count IS NULL OR retry_count < max_retries)
    ORDER BY
      CASE WHEN processing_status = 'failed' THEN 1 ELSE 0 END,  -- Retry failed first
      created_at ASC
    LIMIT job_limit
    FOR UPDATE SKIP LOCKED  -- Atomic lock, skip if locked by another worker
  )
  UPDATE knowledge_files f
  SET processing_status = 'processing',
      updated_at = NOW()
  FROM claimed c
  WHERE f.id = c.id
  RETURNING f.*;
END;
$$;

-- Grant execute to service role (used by edge functions)
GRANT EXECUTE ON FUNCTION claim_pending_knowledge_jobs TO service_role;

-- ─────────────────────────────────────────────────────────────────
-- Add index to speed up job claiming queries
-- ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_knowledge_files_processing_queue
ON knowledge_files (processing_status, retry_count, created_at)
WHERE processing_status IN ('pending', 'failed');

-- Add comment documenting the status values
-- Valid enum values: 'pending', 'processing', 'completed', 'failed'
COMMENT ON COLUMN knowledge_files.processing_status IS 'Job status: pending (waiting), processing (in progress), completed (done), failed (error - will retry)';
