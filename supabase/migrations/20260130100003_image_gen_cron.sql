-- Migration: Cron jobs for Nano Banana Image Generation System
-- Description: Sets up pg_cron jobs for stats aggregation and quota resets
-- Note: pg_cron must be enabled in Supabase dashboard (Database > Extensions)

-- Check if pg_cron extension is available (it's usually pre-installed in Supabase)
-- If not available, these will fail gracefully

-- Daily quota reset (runs at midnight UTC)
-- Resets current_daily_count for all users
DO $outer$
BEGIN
  -- Try to unschedule if exists (idempotent)
  PERFORM cron.unschedule('reset-daily-image-quotas');
EXCEPTION WHEN OTHERS THEN
  -- Ignore if job doesn't exist or cron not enabled
  NULL;
END $outer$;

DO $outer$
BEGIN
  PERFORM cron.schedule(
    'reset-daily-image-quotas',
    '0 0 * * *',
    'UPDATE public.image_user_quotas SET current_daily_count = 0, last_reset_date = CURRENT_DATE, updated_at = NOW() WHERE last_reset_date < CURRENT_DATE;'
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron not available or job creation failed: %', SQLERRM;
END $outer$;

-- Monthly cost reset (runs on 1st of each month at midnight UTC)
DO $outer$
BEGIN
  PERFORM cron.unschedule('reset-monthly-image-costs');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $outer$;

DO $outer$
BEGIN
  PERFORM cron.schedule(
    'reset-monthly-image-costs',
    '0 0 1 * *',
    'UPDATE public.image_user_quotas SET current_monthly_cost_cents = 0, last_monthly_reset = date_trunc(''month'', CURRENT_DATE)::DATE, updated_at = NOW() WHERE last_monthly_reset < date_trunc(''month'', CURRENT_DATE)::DATE;'
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron not available or job creation failed: %', SQLERRM;
END $outer$;

-- Nightly stats aggregation (runs at 2 AM UTC)
-- Aggregates previous day's generation data into stats table
DO $outer$
BEGIN
  PERFORM cron.unschedule('aggregate-image-stats');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $outer$;

DO $outer$
BEGIN
  PERFORM cron.schedule(
    'aggregate-image-stats',
    '0 2 * * *',
    'INSERT INTO public.image_generation_stats (date, user_id, total_generations, successful_generations, failed_generations, blocked_generations, total_cost_cents, avg_generation_time_ms, model_name) SELECT (CURRENT_DATE - INTERVAL ''1 day'')::DATE as date, user_id, COUNT(*) as total_generations, COUNT(*) FILTER (WHERE generation_status = ''completed'') as successful_generations, COUNT(*) FILTER (WHERE generation_status = ''failed'') as failed_generations, COUNT(*) FILTER (WHERE status = ''blocked'') as blocked_generations, COALESCE(SUM(cost_cents), 0) as total_cost_cents, AVG(generation_time_ms)::INTEGER as avg_generation_time_ms, COALESCE(model_name, ''gemini-2.5-flash-image'') as model_name FROM public.ai_generated_images WHERE created_at >= CURRENT_DATE - INTERVAL ''1 day'' AND created_at < CURRENT_DATE AND deleted_at IS NULL GROUP BY user_id, model_name ON CONFLICT (date, user_id, model_name) DO UPDATE SET total_generations = EXCLUDED.total_generations, successful_generations = EXCLUDED.successful_generations, failed_generations = EXCLUDED.failed_generations, blocked_generations = EXCLUDED.blocked_generations, total_cost_cents = EXCLUDED.total_cost_cents, avg_generation_time_ms = EXCLUDED.avg_generation_time_ms, computed_at = NOW();'
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron not available or job creation failed: %', SQLERRM;
END $outer$;

-- Weekly cleanup of old failed/pending records (runs Sunday 3 AM UTC)
-- Removes zombie "processing" records older than 1 hour (they failed silently)
DO $outer$
BEGIN
  PERFORM cron.unschedule('cleanup-zombie-image-records');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $outer$;

DO $outer$
BEGIN
  PERFORM cron.schedule(
    'cleanup-zombie-image-records',
    '0 3 * * 0',
    'UPDATE public.ai_generated_images SET generation_status = ''failed'', error_type = ''timeout'', error_message = ''Generation timed out (cleanup job)'' WHERE generation_status = ''processing'' AND created_at < NOW() - INTERVAL ''1 hour''; UPDATE public.ai_generated_images SET deleted_at = NOW() WHERE generation_status = ''pending'' AND created_at < NOW() - INTERVAL ''24 hours'' AND deleted_at IS NULL;'
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron not available or job creation failed: %', SQLERRM;
END $outer$;

-- Cleanup expired images (30 days old) - runs weekly on Monday 4 AM UTC
DO $outer$
BEGIN
  PERFORM cron.unschedule('cleanup-expired-images');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $outer$;

DO $outer$
BEGIN
  PERFORM cron.schedule(
    'cleanup-expired-images',
    '0 4 * * 1',
    'UPDATE public.ai_generated_images SET deleted_at = NOW() WHERE expires_at < NOW() AND deleted_at IS NULL;'
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron not available or job creation failed: %', SQLERRM;
END $outer$;

-- Manual function to run stats aggregation (useful for backfilling)
CREATE OR REPLACE FUNCTION aggregate_image_stats_for_date(p_date DATE)
RETURNS void AS $$
BEGIN
  INSERT INTO public.image_generation_stats (
    date,
    user_id,
    total_generations,
    successful_generations,
    failed_generations,
    blocked_generations,
    total_cost_cents,
    avg_generation_time_ms,
    model_name
  )
  SELECT
    p_date as date,
    user_id,
    COUNT(*) as total_generations,
    COUNT(*) FILTER (WHERE generation_status = 'completed') as successful_generations,
    COUNT(*) FILTER (WHERE generation_status = 'failed') as failed_generations,
    COUNT(*) FILTER (WHERE status = 'blocked') as blocked_generations,
    COALESCE(SUM(cost_cents), 0) as total_cost_cents,
    AVG(generation_time_ms)::INTEGER as avg_generation_time_ms,
    COALESCE(model_name, 'gemini-2.5-flash-image') as model_name
  FROM public.ai_generated_images
  WHERE created_at >= p_date
    AND created_at < p_date + INTERVAL '1 day'
    AND deleted_at IS NULL
  GROUP BY user_id, model_name
  ON CONFLICT (date, user_id, model_name)
  DO UPDATE SET
    total_generations = EXCLUDED.total_generations,
    successful_generations = EXCLUDED.successful_generations,
    failed_generations = EXCLUDED.failed_generations,
    blocked_generations = EXCLUDED.blocked_generations,
    total_cost_cents = EXCLUDED.total_cost_cents,
    avg_generation_time_ms = EXCLUDED.avg_generation_time_ms,
    computed_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to backfill stats for a date range
CREATE OR REPLACE FUNCTION backfill_image_stats(p_start_date DATE, p_end_date DATE)
RETURNS INTEGER AS $$
DECLARE
  v_date DATE;
  v_count INTEGER := 0;
BEGIN
  v_date := p_start_date;
  WHILE v_date <= p_end_date LOOP
    PERFORM aggregate_image_stats_for_date(v_date);
    v_count := v_count + 1;
    v_date := v_date + INTERVAL '1 day';
  END LOOP;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- View for admin dashboard - aggregated stats summary
CREATE OR REPLACE VIEW public.image_stats_summary AS
SELECT
  date,
  SUM(total_generations) as total_generations,
  SUM(successful_generations) as successful_generations,
  SUM(failed_generations) as failed_generations,
  SUM(blocked_generations) as blocked_generations,
  SUM(total_cost_cents) as total_cost_cents,
  AVG(avg_generation_time_ms)::INTEGER as avg_generation_time_ms,
  COUNT(DISTINCT user_id) as unique_users
FROM public.image_generation_stats
GROUP BY date
ORDER BY date DESC;

-- View for top users by generation count
CREATE OR REPLACE VIEW public.image_top_users AS
SELECT
  s.user_id,
  CONCAT(u.first_name, ' ', u.last_name) as full_name,
  u.email,
  SUM(s.total_generations) as total_generations,
  SUM(s.successful_generations) as successful_generations,
  SUM(s.total_cost_cents) as total_cost_cents,
  MAX(s.date) as last_generation_date
FROM public.image_generation_stats s
LEFT JOIN public.users u ON s.user_id = u.id
WHERE s.date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY s.user_id, u.first_name, u.last_name, u.email
ORDER BY total_generations DESC;

-- Comments
COMMENT ON FUNCTION aggregate_image_stats_for_date IS 'Manually aggregate stats for a specific date';
COMMENT ON FUNCTION backfill_image_stats IS 'Backfill stats for a date range (start_date to end_date inclusive)';
COMMENT ON VIEW public.image_stats_summary IS 'Daily aggregated stats for admin dashboard';
COMMENT ON VIEW public.image_top_users IS 'Top users by generation count in last 30 days';
