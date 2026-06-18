-- ============================================================================
-- Manual Trigger Helper for Knowledge Job Processing
-- ============================================================================
-- This migration creates a helper function that allows manual triggering
-- of the knowledge job processor. Useful for:
-- - Testing the worker
-- - Immediately processing stuck files
-- - Running on-demand without waiting for cron
--
-- Usage (from SQL Editor in Supabase Dashboard):
--   SELECT trigger_knowledge_job_processing();
--
-- Usage (from psql or any SQL client):
--   SELECT trigger_knowledge_job_processing();
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_knowledge_job_processing()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  response_id bigint;
BEGIN
  -- Trigger the edge function via pg_net
  SELECT net.http_post(
    url := 'https://tkdksyfudpzxrlnvybqz.supabase.co/functions/v1/process-knowledge-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) INTO response_id;

  -- Return success with request ID
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Knowledge job processing triggered',
    'request_id', response_id,
    'timestamp', now()
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Return error details
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'timestamp', now()
    );
END;
$$;

-- Grant execute permission to authenticated users (optional - remove if you want admin-only)
-- GRANT EXECUTE ON FUNCTION trigger_knowledge_job_processing() TO authenticated;

-- Grant execute to service role for sure
GRANT EXECUTE ON FUNCTION trigger_knowledge_job_processing() TO service_role;

COMMENT ON FUNCTION trigger_knowledge_job_processing() IS
'Manually trigger the knowledge job processing worker.
This is useful for immediately processing stuck files or testing the worker.
Returns a JSON object with success status and request ID.';
