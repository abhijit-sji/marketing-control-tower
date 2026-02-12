-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Create cron job to sync Control Tower data every 6 hours
SELECT cron.schedule(
  'control-tower-sync-6h',
  '0 */6 * * *', -- At minute 0 past every 6th hour (12am, 6am, 12pm, 6pm)
  $$
  SELECT net.http_post(
    url := 'https://fzknasqrludvoyxdzbxl.supabase.co/functions/v1/employee-sync',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6a25hc3FybHVkdm95eGR6YnhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2NjgzNDQsImV4cCI6MjA3NDI0NDM0NH0.dY6cDep2gXHzCz4SVD2741oupXjjzMSyIcmSn8HsigI',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);